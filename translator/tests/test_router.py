"""Pure demand-computation tests for TranslationRouter."""

from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from livekit import rtc

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from config import NATIVE_LANG, PARTICIPANT_LANG_ATTR  # noqa: E402
from router import TranslationRouter  # noqa: E402


def _audio_pub(
    source: rtc.TrackSource,
    *,
    muted: bool = False,
):
    pub = MagicMock()
    pub.kind = rtc.TrackKind.KIND_AUDIO
    pub.source = source
    pub.muted = muted
    pub.track = MagicMock(name=f"track-{source}")
    return pub


def _fake_participant(
    identity: str,
    lang: str | None,
    *,
    mic_muted: bool = False,
    share_audio: bool = False,
    share_muted: bool = False,
):
    participant = MagicMock()
    participant.identity = identity
    participant.attributes = (
        {PARTICIPANT_LANG_ATTR: lang}
        if lang
        else {}
    )

    publications = {
        "mic": _audio_pub(
            rtc.TrackSource.SOURCE_MICROPHONE,
            muted=mic_muted,
        )
    }
    if share_audio:
        publications["share"] = _audio_pub(
            rtc.TrackSource.SOURCE_SCREENSHARE_AUDIO,
            muted=share_muted,
        )

    participant.track_publications = publications
    return participant


def _fake_room(participants):
    room = MagicMock()
    room.remote_participants = {
        participant.identity: participant
        for participant in participants
    }
    return room


def _router_with(participants):
    router = TranslationRouter(
        room=_fake_room(participants),
        gemini_api_key="test-key",
    )

    for participant in participants:
        for pub in participant.track_publications.values():
            source_kind = router._source_kind(pub)
            if (
                source_kind
                and pub.kind == rtc.TrackKind.KIND_AUDIO
                and pub.track
            ):
                router._speaker_tracks[
                    (participant.identity, source_kind)
                ] = pub.track

    return router


def test_empty_room_has_no_sessions():
    router = _router_with([])
    assert router._compute_desired_sessions() == set()


def test_native_only_listener_has_no_sessions():
    participant = _fake_participant("alice", NATIVE_LANG)
    router = _router_with([participant])
    assert router._compute_desired_sessions() == set()


def test_same_language_mics_stay_native():
    p1 = _fake_participant("p1", "de")
    p2 = _fake_participant("p2", "de")
    router = _router_with([p1, p2])
    assert router._compute_desired_sessions() == set()


def test_two_different_microphone_languages_create_pair():
    p1 = _fake_participant("p1", "en")
    p2 = _fake_participant("p2", "es")
    router = _router_with([p1, p2])

    assert router._compute_desired_sessions() == {
        ("p1", "mic", "es"),
        ("p2", "mic", "en"),
    }


def test_four_participants_mic_demand():
    p1 = _fake_participant("p1", "en")
    p2 = _fake_participant("p2", "es")
    p3 = _fake_participant("p3", "de")
    p4 = _fake_participant("p4", "de")
    router = _router_with([p1, p2, p3, p4])

    assert router._compute_desired_sessions() == {
        ("p1", "mic", "es"),
        ("p1", "mic", "de"),
        ("p2", "mic", "en"),
        ("p2", "mic", "de"),
        ("p3", "mic", "en"),
        ("p3", "mic", "es"),
        ("p4", "mic", "en"),
        ("p4", "mic", "es"),
    }


def test_muted_mic_does_not_translate_from_speaker():
    p1 = _fake_participant(
        "p1",
        "en",
        mic_muted=True,
    )
    p2 = _fake_participant("p2", "es")
    router = _router_with([p1, p2])

    assert router._compute_desired_sessions() == {
        ("p2", "mic", "en")
    }


def test_all_mics_muted_no_sessions():
    p1 = _fake_participant(
        "p1",
        "en",
        mic_muted=True,
    )
    p2 = _fake_participant(
        "p2",
        "es",
        mic_muted=True,
    )
    router = _router_with([p1, p2])
    assert router._compute_desired_sessions() == set()


def test_native_listener_does_not_block_other_mic_translation():
    p1 = _fake_participant("p1", "en")
    p2 = _fake_participant("p2", "es")
    p3 = _fake_participant("p3", NATIVE_LANG)
    router = _router_with([p1, p2, p3])

    assert router._compute_desired_sessions() == {
        ("p1", "mic", "es"),
        ("p2", "mic", "en"),
    }


def test_screen_share_audio_translates_without_declared_sharer_language():
    sharer = _fake_participant(
        "sharer",
        NATIVE_LANG,
        mic_muted=True,
        share_audio=True,
    )
    listener = _fake_participant(
        "listener",
        "es",
        mic_muted=True,
    )
    router = _router_with([sharer, listener])

    assert router._compute_desired_sessions() == {
        ("sharer", "share", "es"),
    }


def test_mic_and_screen_share_audio_coexist():
    sharer = _fake_participant(
        "sharer",
        "en",
        share_audio=True,
    )
    listener = _fake_participant("listener", "es")
    router = _router_with([sharer, listener])

    assert router._compute_desired_sessions() == {
        ("sharer", "mic", "es"),
        ("listener", "mic", "en"),
        ("sharer", "share", "en"),
        ("sharer", "share", "es"),
    }


def test_muted_screen_share_audio_is_not_translated():
    sharer = _fake_participant(
        "sharer",
        "en",
        mic_muted=True,
        share_audio=True,
        share_muted=True,
    )
    listener = _fake_participant(
        "listener",
        "fr",
        mic_muted=True,
    )
    router = _router_with([sharer, listener])

    assert router._compute_desired_sessions() == set()


@pytest.mark.parametrize(
    "speaker_lang,listener_lang,expected",
    [
        ("en", "es", {("speaker", "mic", "es")}),
        ("de", "de", set()),
        ("fr", NATIVE_LANG, set()),
    ],
)
def test_single_mic_pair(
    speaker_lang,
    listener_lang,
    expected,
):
    speaker = _fake_participant(
        "speaker",
        speaker_lang,
    )
    listener = _fake_participant(
        "listener",
        listener_lang,
        mic_muted=True,
    )
    router = _router_with([speaker, listener])

    assert router._compute_desired_sessions() == expected
