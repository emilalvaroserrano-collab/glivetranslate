"use client";

import { useEffect, useRef } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { MicOffIcon } from "./icons";

export default function SelfView({ compact = false }: { compact?: boolean }) {
  const { localParticipant, cameraTrack, microphoneTrack } = useLocalParticipant();
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const cameraOn =
    !!cameraTrack?.track &&
    cameraTrack.source === Track.Source.Camera &&
    !cameraTrack.isMuted;

  useEffect(() => {
    const video = videoRef.current;
    const track = cameraTrack?.track;
    if (!video) return;

    if (cameraOn && track) {
      track.attach(video);
      return () => {
        track.detach(video);
      };
    }

    video.srcObject = null;
  }, [cameraTrack, cameraOn]);

  const displayName = localParticipant?.name || "You";
  const initial = displayName.slice(0, 1).toUpperCase();
  const micOn = !!microphoneTrack && !microphoneTrack.isMuted;

  return (
    <article
      className={`participant-tile self-view${compact ? " filmstrip-tile" : ""}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="participant-video self-view-video"
        style={{ display: cameraOn ? "block" : "none" }}
      />
      {!cameraOn ? (
        <div className="participant-placeholder self-view-empty">
          <span className="self-view-avatar">{initial}</span>
        </div>
      ) : null}
      {!micOn ? (
        <span className="participant-mic-off self-view-mic" title="Microphone off">
          <MicOffIcon />
        </span>
      ) : null}
      <div className="participant-label-row">
        <span className="participant-name self-view-name">{displayName} (you)</span>
      </div>
    </article>
  );
}
