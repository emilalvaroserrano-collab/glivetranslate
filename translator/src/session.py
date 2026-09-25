"""One bidirectional Gemini Live session translating one audio source.

A source can be a participant microphone ("mic") or captured screen-share audio
("share"). Each source/target pair publishes an independent translated audio
track so both can coexist in the same meeting.
"""

from __future__ import annotations

import asyncio
import base64
import contextlib
import json
import logging
import random

import websockets
from livekit import rtc

from audio import iter_pcm_for_gemini, make_audio_source, push_pcm_to_source
from config import (
    GEMINI_INPUT_SAMPLE_RATE,
    GEMINI_MAX_FAILURES_BEFORE_LONG_BACKOFF,
    GEMINI_MODEL,
    GEMINI_RECONNECT_BACKOFF_SEC,
)

logger = logging.getLogger("translator.session")

GEMINI_WS_URL = (
    "wss://generativelanguage.googleapis.com/ws/"
    "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent"
)


class GeminiSession:
    """Bridges one LiveKit audio source to one translated target-language track."""

    def __init__(
        self,
        *,
        room: rtc.Room,
        speaker_identity: str,
        source_kind: str,
        speaker_track: rtc.RemoteAudioTrack,
        target_lang: str,
        gemini_api_key: str,
    ) -> None:
        self._room = room
        self._speaker_identity = speaker_identity
        self._source_kind = source_kind
        self._speaker_track = speaker_track
        self._target_lang = target_lang
        self._gemini_api_key = gemini_api_key

        self._audio_source = make_audio_source()
        self._local_track: rtc.LocalAudioTrack | None = None
        self._track_sid: str | None = None
        self._consecutive_failures = 0
        self._tasks: list[asyncio.Task] = []
        self._closed = asyncio.Event()

    async def start(self) -> None:
        """Publish the translated track and start the Gemini pump."""
        track_name = (
            f"tx:{self._source_kind}:"
            f"{self._speaker_identity}:{self._target_lang}"
        )
        self._local_track = rtc.LocalAudioTrack.create_audio_track(
            track_name, self._audio_source
        )
        publish_opts = rtc.TrackPublishOptions(
            source=rtc.TrackSource.SOURCE_MICROPHONE
        )

        pub = await self._room.local_participant.publish_track(
            self._local_track, publish_opts
        )
        self._track_sid = pub.sid

        logger.info(
            "started translation sid=%s source=%s/%s -> %s",
            self._track_sid,
            self._speaker_identity,
            self._source_kind,
            self._target_lang,
        )

        self._tasks.append(
            asyncio.create_task(
                self._run(),
                name=f"session/{track_name}",
            )
        )

    async def aclose(self) -> None:
        if self._closed.is_set():
            return
        self._closed.set()

        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
        self._tasks.clear()

        if self._track_sid:
            try:
                await self._room.local_participant.unpublish_track(
                    self._track_sid
                )
            except Exception as exc:
                logger.debug(
                    "unpublish failed for %s: %s",
                    self._track_sid,
                    exc,
                )

        with contextlib.suppress(Exception):
            await self._audio_source.aclose()

        logger.info(
            "closed translation %s/%s -> %s",
            self._speaker_identity,
            self._source_kind,
            self._target_lang,
        )

    async def _run(self) -> None:
        while not self._closed.is_set():
            try:
                await self._connect_and_pump()
                return
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self._consecutive_failures += 1
                idx = min(
                    self._consecutive_failures - 1,
                    len(GEMINI_RECONNECT_BACKOFF_SEC) - 1,
                )
                delay = GEMINI_RECONNECT_BACKOFF_SEC[idx]
                delay += random.uniform(0, delay * 0.2)

                if (
                    self._consecutive_failures
                    >= GEMINI_MAX_FAILURES_BEFORE_LONG_BACKOFF
                ):
                    logger.error(
                        "Gemini %s/%s -> %s failed %d times; "
                        "continuing with long backoff",
                        self._speaker_identity,
                        self._source_kind,
                        self._target_lang,
                        self._consecutive_failures,
                    )

                logger.warning(
                    "Gemini error (%s/%s -> %s) attempt #%d: %s; "
                    "backing off %.2fs",
                    self._speaker_identity,
                    self._source_kind,
                    self._target_lang,
                    self._consecutive_failures,
                    exc,
                    delay,
                )

                try:
                    await asyncio.wait_for(
                        self._closed.wait(),
                        timeout=delay,
                    )
                    return
                except asyncio.TimeoutError:
                    pass

    async def _connect_and_pump(self) -> None:
        url = f"{GEMINI_WS_URL}?key={self._gemini_api_key}"

        async with websockets.connect(
            url,
            max_size=2**22,
            ping_interval=20,
            ping_timeout=20,
        ) as ws:
            await ws.send(json.dumps(self._build_setup_payload()))
            logger.info(
                "Gemini WS connected: %s/%s -> %s",
                self._speaker_identity,
                self._source_kind,
                self._target_lang,
            )

            setup_complete = asyncio.Event()
            send_task = asyncio.create_task(
                self._pump_input(ws, setup_complete),
                name="gemini-input",
            )
            recv_task = asyncio.create_task(
                self._pump_output(ws, setup_complete),
                name="gemini-output",
            )

            done, pending = await asyncio.wait(
                {send_task, recv_task},
                return_when=asyncio.FIRST_EXCEPTION,
            )
            for task in pending:
                task.cancel()
            for task in done:
                exc = task.exception()
                if exc is not None:
                    raise exc

    def _build_setup_payload(self) -> dict:
        return {
            "setup": {
                "model": f"models/{GEMINI_MODEL}",
                "outputAudioTranscription": {},
                "generationConfig": {
                    "responseModalities": ["AUDIO"],
                    "translationConfig": {
                        "targetLanguageCode": self._target_lang,
                        "echoTargetLanguage": False,
                    },
                },
                "realtimeInputConfig": {
                    "automaticActivityDetection": {
                        "disabled": False
                    },
                },
            }
        }

    async def _pump_input(
        self,
        ws: websockets.WebSocketClientProtocol,
        setup_complete: asyncio.Event,
    ) -> None:
        await setup_complete.wait()
        sent = 0
        mime = f"audio/pcm;rate={GEMINI_INPUT_SAMPLE_RATE}"

        async for pcm in iter_pcm_for_gemini(self._speaker_track):
            if self._closed.is_set():
                return

            b64 = base64.b64encode(pcm).decode("ascii")
            await ws.send(
                json.dumps(
                    {
                        "realtimeInput": {
                            "audio": {
                                "mimeType": mime,
                                "data": b64,
                            }
                        }
                    }
                )
            )
            sent += 1

            if sent in (1, 50) or sent % 500 == 0:
                logger.info(
                    "gemini <- %s frames=%d (%s/%s in)",
                    self._target_lang,
                    sent,
                    self._speaker_identity,
                    self._source_kind,
                )

    async def _pump_output(
        self,
        ws: websockets.WebSocketClientProtocol,
        setup_complete: asyncio.Event,
    ) -> None:
        audio_frames = 0
        text_chunks = 0

        async for raw in ws:
            if self._closed.is_set():
                return

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                logger.debug("ignoring non-JSON WS frame")
                continue

            if msg.get("setupComplete") is not None:
                logger.info(
                    "Gemini setup complete: %s/%s -> %s",
                    self._speaker_identity,
                    self._source_kind,
                    self._target_lang,
                )
                self._consecutive_failures = 0
                setup_complete.set()
                continue

            sc = msg.get("serverContent")
            if not sc:
                continue

            model_turn = sc.get("modelTurn")
            if model_turn is not None:
                for part in model_turn.get("parts", []) or []:
                    inline = part.get("inlineData")
                    if inline and inline.get("data"):
                        pcm = base64.b64decode(inline["data"])
                        await push_pcm_to_source(
                            self._audio_source,
                            pcm,
                        )
                        audio_frames += 1

                        if (
                            audio_frames in (1, 10, 100)
                            or audio_frames % 500 == 0
                        ):
                            logger.info(
                                "gemini -> %s frames=%d "
                                "(%s/%s -> %s)",
                                self._target_lang,
                                audio_frames,
                                self._speaker_identity,
                                self._source_kind,
                                self._target_lang,
                            )

            output_transcription = sc.get("outputTranscription")
            if (
                output_transcription
                and output_transcription.get("text")
            ):
                await self._publish_transcript(
                    output_transcription["text"],
                    final=False,
                )
                text_chunks += 1

                if (
                    text_chunks in (1, 10)
                    or text_chunks % 50 == 0
                ):
                    logger.info(
                        "transcript #%d for %s/%s -> %s: %r",
                        text_chunks,
                        self._speaker_identity,
                        self._source_kind,
                        self._target_lang,
                        output_transcription["text"][:60],
                    )

            if sc.get("turnComplete"):
                await self._publish_transcript(
                    "",
                    final=True,
                )

    async def _publish_transcript(
        self,
        text: str,
        *,
        final: bool,
    ) -> None:
        if not text and not final:
            return

        try:
            writer = await self._room.local_participant.stream_text(
                topic="lk.translation",
                sender_identity=self._speaker_identity,
                attributes={
                    "target_lang": self._target_lang,
                    "source_identity": self._speaker_identity,
                    "source_kind": self._source_kind,
                    "final": "true" if final else "false",
                },
            )
            if text:
                await writer.write(text)
            await writer.aclose()
        except Exception as exc:
            logger.debug(
                "text-stream publish failed: %s",
                exc,
            )
