"""Reconciles active Gemini translation sessions to room demand.

Microphone audio and screen-share audio are independent translation sources.
That distinction is important because one participant may publish both at the
same time and shared media may be in a different language from the sharer.
"""

from __future__ import annotations

import asyncio
import logging

from livekit import rtc

from config import (
    NATIVE_LANG,
    PARTICIPANT_LANG_ATTR,
    RECONCILE_DEBOUNCE_SEC,
    SESSION_GRACE_SEC,
)
from session import GeminiSession

logger = logging.getLogger("translator.router")

# (speaker_identity, source_kind, target_lang)
# source_kind is "mic" or "share".
SessionKey = tuple[str, str, str]
TrackKey = tuple[str, str]


class TranslationRouter:
    """Own the room's translation-session lifecycle.

    Microphone sessions are created only when the speaker has a declared
    language different from the target language.

    Screen-share-audio sessions are created for every requested target
    language. We intentionally do not assume the shared media language equals
    the sharer's participant language.
    """

    def __init__(self, room: rtc.Room, gemini_api_key: str) -> None:
        self._room = room
        self._gemini_api_key = gemini_api_key

        # A participant may publish mic + screen-share audio simultaneously.
        self._speaker_tracks: dict[TrackKey, rtc.RemoteAudioTrack] = {}

        self._sessions: dict[SessionKey, GeminiSession] = {}
        self._grace_tasks: dict[SessionKey, asyncio.Task] = {}
        self._detached_tasks: set[asyncio.Task] = set()

        self._reconcile_handle: asyncio.TimerHandle | None = None
        self._reconcile_lock = asyncio.Lock()

    # --- Lifecycle ---------------------------------------------------------

    def start(self) -> None:
        room = self._room

        @room.on("participant_connected")
        def _on_conn(_: rtc.RemoteParticipant) -> None:
            self._schedule_reconcile()

        @room.on("participant_disconnected")
        def _on_disc(p: rtc.RemoteParticipant) -> None:
            self._on_participant_left(p.identity)
            self._schedule_reconcile()

        @room.on("participant_attributes_changed")
        def _on_attrs(_changed: dict[str, str], _p: rtc.Participant) -> None:
            self._schedule_reconcile()

        @room.on("track_subscribed")
        def _on_subscribed(
            track: rtc.Track,
            pub: rtc.RemoteTrackPublication,
            participant: rtc.RemoteParticipant,
        ) -> None:
            source_kind = self._source_kind(pub)
            if (
                source_kind
                and track.kind == rtc.TrackKind.KIND_AUDIO
                and isinstance(track, rtc.RemoteAudioTrack)
            ):
                self._speaker_tracks[(participant.identity, source_kind)] = track
                logger.info(
                    "audio source subscribed participant=%s source=%s",
                    participant.identity,
                    source_kind,
                )
                self._schedule_reconcile()

        @room.on("track_unsubscribed")
        def _on_unsubscribed(
            track: rtc.Track,
            pub: rtc.RemoteTrackPublication,
            participant: rtc.RemoteParticipant,
        ) -> None:
            source_kind = self._source_kind(pub)
            if not source_kind or track.kind != rtc.TrackKind.KIND_AUDIO:
                return

            key = (participant.identity, source_kind)
            current = self._speaker_tracks.get(key)
            if current is track:
                self._speaker_tracks.pop(key, None)
            self._schedule_reconcile()

        @room.on("track_muted")
        def _on_muted(_pub: rtc.TrackPublication, _p: rtc.Participant) -> None:
            self._schedule_reconcile()

        @room.on("track_unmuted")
        def _on_unmuted(_pub: rtc.TrackPublication, _p: rtc.Participant) -> None:
            self._schedule_reconcile()

        # Backfill tracks that were already subscribed before the router started.
        for participant in room.remote_participants.values():
            for pub in participant.track_publications.values():
                source_kind = self._source_kind(pub)
                if (
                    source_kind
                    and pub.track
                    and pub.kind == rtc.TrackKind.KIND_AUDIO
                    and isinstance(pub.track, rtc.RemoteAudioTrack)
                ):
                    self._speaker_tracks[
                        (participant.identity, source_kind)
                    ] = pub.track

        self._schedule_reconcile()

    async def aclose(self) -> None:
        if self._reconcile_handle:
            self._reconcile_handle.cancel()
            self._reconcile_handle = None

        for task in self._grace_tasks.values():
            task.cancel()
        self._grace_tasks.clear()

        await asyncio.gather(
            *(session.aclose() for session in self._sessions.values()),
            return_exceptions=True,
        )
        self._sessions.clear()
        self._speaker_tracks.clear()

    # --- Reconciliation ----------------------------------------------------

    def _schedule_reconcile(self) -> None:
        loop = asyncio.get_event_loop()
        if self._reconcile_handle is not None:
            self._reconcile_handle.cancel()
        self._reconcile_handle = loop.call_later(
            RECONCILE_DEBOUNCE_SEC,
            lambda: asyncio.create_task(self._reconcile()),
        )

    async def _reconcile(self) -> None:
        async with self._reconcile_lock:
            desired = self._compute_desired_sessions()
            existing = set(self._sessions.keys())

            for key in desired & set(self._grace_tasks.keys()):
                task = self._grace_tasks.pop(key)
                task.cancel()

            for key in existing - desired:
                if key not in self._grace_tasks:
                    self._grace_tasks[key] = asyncio.create_task(
                        self._grace_teardown(key)
                    )

            for key in desired - existing:
                if key in self._grace_tasks:
                    continue

                speaker_identity, source_kind, target_lang = key
                track = self._speaker_tracks.get(
                    (speaker_identity, source_kind)
                )
                if track is None:
                    continue

                session = GeminiSession(
                    room=self._room,
                    speaker_identity=speaker_identity,
                    source_kind=source_kind,
                    speaker_track=track,
                    target_lang=target_lang,
                    gemini_api_key=self._gemini_api_key,
                )
                self._sessions[key] = session
                try:
                    await session.start()
                except Exception as exc:
                    logger.exception(
                        "failed to start session %s/%s -> %s: %s",
                        speaker_identity,
                        source_kind,
                        target_lang,
                        exc,
                    )
                    self._sessions.pop(key, None)

    def _compute_desired_sessions(self) -> set[SessionKey]:
        target_langs = self._listener_target_langs()
        if not target_langs:
            return set()

        desired: set[SessionKey] = set()
        for speaker_identity, source_kind, source_lang in self._active_sources():
            for target_lang in target_langs:
                if (
                    source_kind == "mic"
                    and source_lang
                    and target_lang == source_lang
                ):
                    continue
                desired.add(
                    (speaker_identity, source_kind, target_lang)
                )
        return desired

    def _listener_target_langs(self) -> set[str]:
        """Languages requested by human listeners, excluding native passthrough."""
        langs: set[str] = set()
        for participant in self._room.remote_participants.values():
            lang = (participant.attributes or {}).get(
                PARTICIPANT_LANG_ATTR
            )
            if lang and lang != NATIVE_LANG:
                langs.add(lang)
        return langs

    def _active_sources(self) -> list[tuple[str, str, str | None]]:
        """Return active (identity, source_kind, declared_language) sources."""
        out: list[tuple[str, str, str | None]] = []

        for participant in self._room.remote_participants.values():
            lang = (participant.attributes or {}).get(
                PARTICIPANT_LANG_ATTR
            )

            mic_key = (participant.identity, "mic")
            if (
                lang
                and lang != NATIVE_LANG
                and mic_key in self._speaker_tracks
                and self._is_source_unmuted(participant, "mic")
            ):
                out.append((participant.identity, "mic", lang))

            share_key = (participant.identity, "share")
            if (
                share_key in self._speaker_tracks
                and self._is_source_unmuted(participant, "share")
            ):
                # The language of the shared movie/tab/app is unknown; do not
                # equate it with the sharer's microphone language.
                out.append((participant.identity, "share", None))

        return out

    def _source_kind(
        self,
        pub: rtc.TrackPublication,
    ) -> str | None:
        if pub.source == rtc.TrackSource.SOURCE_MICROPHONE:
            return "mic"
        if pub.source == rtc.TrackSource.SOURCE_SCREENSHARE_AUDIO:
            return "share"
        return None

    def _is_source_unmuted(
        self,
        participant: rtc.RemoteParticipant,
        source_kind: str,
    ) -> bool:
        for pub in participant.track_publications.values():
            if self._source_kind(pub) == source_kind and not pub.muted:
                return True
        return False

    # --- Teardown ----------------------------------------------------------

    async def _grace_teardown(self, key: SessionKey) -> None:
        try:
            await asyncio.sleep(SESSION_GRACE_SEC)
        except asyncio.CancelledError:
            return

        if (
            key in self._sessions
            and key not in self._compute_desired_sessions()
        ):
            session = self._sessions.pop(key)
            await session.aclose()
        self._grace_tasks.pop(key, None)

    def _on_participant_left(self, identity: str) -> None:
        for track_key in list(self._speaker_tracks.keys()):
            if track_key[0] == identity:
                self._speaker_tracks.pop(track_key, None)

        for key in list(self._sessions.keys()):
            if key[0] != identity:
                continue

            session = self._sessions.pop(key)
            pending = self._grace_tasks.pop(key, None)
            if pending:
                pending.cancel()

            task = asyncio.create_task(session.aclose())
            self._detached_tasks.add(task)
            task.add_done_callback(self._detached_tasks.discard)
