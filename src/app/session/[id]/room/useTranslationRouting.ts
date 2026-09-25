"use client";

import { useEffect } from "react";
import { useRoomContext } from "@livekit/components-react";
import {
  ParticipantKind,
  RoomEvent,
  type RemoteParticipant,
  type RemoteTrackPublication,
  Track,
} from "livekit-client";
import { NATIVE_LANG, PARTICIPANT_LANG_ATTR } from "@/lib/config";

const TRANSLATION_TRACK_PREFIX = "tx:";
type TranslationSource = "mic" | "share";

function parseTranslationTrackName(
  name: string,
): {
  sourceIdentity: string;
  sourceKind: TranslationSource;
  targetLang: string;
} | null {
  if (!name.startsWith(TRANSLATION_TRACK_PREFIX)) return null;

  const parts = name.slice(TRANSLATION_TRACK_PREFIX.length).split(":");
  if (parts.length < 2) return null;

  // New format: tx:<mic|share>:<speaker_identity>:<target_lang>.
  // Keep the previous tx:<speaker_identity>:<target_lang> format readable
  // during rolling deployments.
  let sourceKind: TranslationSource = "mic";
  if (parts[0] === "mic" || parts[0] === "share") {
    sourceKind = parts.shift() as TranslationSource;
  }

  const targetLang = parts.pop()!;
  const sourceIdentity = parts.join(":");
  if (!sourceIdentity || !targetLang) return null;

  return { sourceIdentity, sourceKind, targetLang };
}

/**
 * Client-side subscription routing:
 * - microphone audio stays native for native listeners or same-language peers
 * - screen-share audio stays native only for listeners who explicitly choose
 *   native passthrough; translated listeners hear the agent's share track
 * - translator tracks are selected by source kind + target language
 */
export function useTranslationRouting(myLang: string) {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;

    const apply = () => {
      const remotes = Array.from(room.remoteParticipants.values());
      const peerLangs = new Map<string, string | undefined>();

      for (const participant of remotes) {
        if (participant.kind === ParticipantKind.AGENT) continue;
        peerLangs.set(
          participant.identity,
          participant.attributes?.[PARTICIPANT_LANG_ATTR],
        );
      }

      for (const participant of remotes) {
        if (participant.kind === ParticipantKind.AGENT) {
          applyAgentSubscriptions(participant, myLang, peerLangs);
        } else {
          applyHumanSubscriptions(participant, myLang);
        }
      }
    };

    apply();

    const events = [
      RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected,
      RoomEvent.ParticipantAttributesChanged,
      RoomEvent.TrackPublished,
      RoomEvent.TrackUnpublished,
      RoomEvent.TrackSubscribed,
      RoomEvent.TrackUnsubscribed,
      RoomEvent.LocalTrackPublished,
    ] as const;

    for (const event of events) room.on(event, apply);
    return () => {
      for (const event of events) room.off(event, apply);
    };
  }, [room, myLang]);
}

function applyHumanSubscriptions(
  participant: RemoteParticipant,
  myLang: string,
) {
  const theirLang =
    participant.attributes?.[PARTICIPANT_LANG_ATTR];
  const hearMicNative =
    myLang === NATIVE_LANG || theirLang === myLang;
  const hearShareNative = myLang === NATIVE_LANG;

  for (const publication of participant.audioTrackPublications.values()) {
    if (publication.source === Track.Source.Microphone) {
      setSubscribed(publication, hearMicNative);
      continue;
    }

    if (publication.source === Track.Source.ScreenShareAudio) {
      setSubscribed(publication, hearShareNative);
    }
  }
}

function applyAgentSubscriptions(
  agent: RemoteParticipant,
  myLang: string,
  peerLangs: Map<string, string | undefined>,
) {
  for (const publication of agent.audioTrackPublications.values()) {
    const parsed = parseTranslationTrackName(publication.trackName);
    if (!parsed) continue;

    if (myLang === NATIVE_LANG) {
      setSubscribed(publication, false);
      continue;
    }

    const matchesTarget = parsed.targetLang === myLang;

    // Screen-share media can be in a different language from the sharer's
    // participant language, so always route a matching translated share track.
    if (parsed.sourceKind === "share") {
      setSubscribed(publication, matchesTarget);
      continue;
    }

    const speakerLang = peerLangs.get(parsed.sourceIdentity);
    setSubscribed(
      publication,
      matchesTarget && speakerLang !== myLang,
    );
  }
}

function setSubscribed(
  publication: RemoteTrackPublication,
  desired: boolean,
) {
  if (publication.isSubscribed !== desired) {
    publication.setSubscribed(desired);
  }
}
