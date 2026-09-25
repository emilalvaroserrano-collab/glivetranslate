"use client";

import { useEffect, useRef, useState } from "react";
import { useIsSpeaking, useParticipantAttributes } from "@livekit/components-react";
import { Track, type RemoteParticipant } from "livekit-client";
import { NATIVE_LANG, PARTICIPANT_LANG_ATTR } from "@/lib/config";
import { getLanguageByCode } from "@/lib/languages";
import { MicOffIcon } from "./icons";

export default function ParticipantTile({
  participant,
  myLang,
  compact = false,
}: {
  participant: RemoteParticipant;
  myLang: string;
  compact?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoOn, setVideoOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const isSpeaking = useIsSpeaking(participant);
  const { attributes } = useParticipantAttributes({ participant });
  const speakerLang = attributes?.[PARTICIPANT_LANG_ATTR];
  const langInfo = speakerLang ? getLanguageByCode(speakerLang) : undefined;
  const needsTranslation =
    myLang !== NATIVE_LANG && !!speakerLang && speakerLang !== myLang;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const sync = () => {
      const cameraPublication = Array.from(
        participant.videoTrackPublications.values(),
      ).find(
        (publication) =>
          publication.source === Track.Source.Camera &&
          !!publication.track &&
          !publication.isMuted,
      );

      for (const publication of participant.videoTrackPublications.values()) {
        publication.track?.detach(video);
      }

      if (cameraPublication?.track) cameraPublication.track.attach(video);
      else video.srcObject = null;

      const micPublication = Array.from(
        participant.audioTrackPublications.values(),
      ).find(
        (publication) =>
          publication.source === Track.Source.Microphone &&
          !publication.isMuted,
      );

      setVideoOn(!!cameraPublication?.track);
      setMicOn(!!micPublication);
    };

    sync();
    participant.on("trackSubscribed", sync);
    participant.on("trackUnsubscribed", sync);
    participant.on("trackPublished", sync);
    participant.on("trackUnpublished", sync);
    participant.on("trackMuted", sync);
    participant.on("trackUnmuted", sync);

    return () => {
      participant.off("trackSubscribed", sync);
      participant.off("trackUnsubscribed", sync);
      participant.off("trackPublished", sync);
      participant.off("trackUnpublished", sync);
      participant.off("trackMuted", sync);
      participant.off("trackUnmuted", sync);
      for (const publication of participant.videoTrackPublications.values()) {
        publication.track?.detach(video);
      }
    };
  }, [participant]);

  const displayName = participant.name || participant.identity;
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <article
      className={`participant-tile${compact ? " filmstrip-tile" : ""}${
        isSpeaking && micOn ? " is-speaking" : ""
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="participant-video"
        style={{ display: videoOn ? "block" : "none" }}
      />
      {!videoOn ? (
        <div className="participant-placeholder">
          <span>{initial}</span>
        </div>
      ) : null}

      {!micOn ? (
        <span className="participant-mic-off" title="Microphone off">
          <MicOffIcon />
        </span>
      ) : null}

      <div className="participant-label-row">
        <span className="participant-name">{displayName}</span>
        {!compact && langInfo ? (
          <span className="participant-tag">
            {langInfo.flag}{" "}
            {needsTranslation
              ? `→ ${myLang.toUpperCase()}`
              : langInfo.code.toUpperCase()}
          </span>
        ) : null}
      </div>
    </article>
  );
}
