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
}: {
  participant: RemoteParticipant;
  myLang: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoOn, setVideoOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [isScreenShare, setIsScreenShare] = useState(false);
  const isSpeaking = useIsSpeaking(participant);
  const { attributes } = useParticipantAttributes({ participant });
  const speakerLang = attributes?.[PARTICIPANT_LANG_ATTR];
  const langInfo = speakerLang ? getLanguageByCode(speakerLang) : undefined;
  const needsTranslation = myLang !== NATIVE_LANG && !!speakerLang && speakerLang !== myLang;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const sync = () => {
      let selectedTrack: { attach: (element: HTMLVideoElement) => unknown } | null = null;
      let selectedSource: Track.Source | null = null;
      let mic = false;

      for (const publication of participant.videoTrackPublications.values()) {
        if (!publication.track || publication.isMuted) continue;
        if (publication.source === Track.Source.ScreenShare) {
          selectedTrack = publication.track;
          selectedSource = Track.Source.ScreenShare;
          break;
        }
        if (publication.source === Track.Source.Camera) {
          selectedTrack = publication.track;
          selectedSource = Track.Source.Camera;
        }
      }

      for (const publication of participant.audioTrackPublications.values()) {
        if (publication.source === Track.Source.Microphone && !publication.isMuted) mic = true;
      }

      for (const publication of participant.videoTrackPublications.values()) {
        publication.track?.detach(video);
      }

      if (selectedTrack) selectedTrack.attach(video);
      else video.srcObject = null;

      setVideoOn(!!selectedTrack);
      setIsScreenShare(selectedSource === Track.Source.ScreenShare);
      setMicOn(mic);
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
    <article className={`participant-tile${isSpeaking && micOn ? " is-speaking" : ""}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`participant-video${isScreenShare ? " is-screen-share" : ""}`}
        style={{ display: videoOn ? "block" : "none" }}
      />
      {!videoOn ? (
        <div className="participant-placeholder">
          <span>{initial}</span>
        </div>
      ) : null}

      {!micOn ? (
        <span className="participant-mic-off" title="Microphone off"><MicOffIcon /></span>
      ) : null}

      <div className="participant-label-row">
        <span className="participant-name">{displayName}</span>
        {isScreenShare ? <span className="participant-tag">Screen</span> : null}
        {langInfo ? (
          <span className="participant-tag">
            {langInfo.flag} {needsTranslation ? `→ ${myLang.toUpperCase()}` : langInfo.code.toUpperCase()}
          </span>
        ) : null}
      </div>
    </article>
  );
}
