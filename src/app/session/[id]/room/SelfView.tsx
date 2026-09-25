"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { MicOffIcon } from "./icons";

export default function SelfView({ compact = false }: { compact?: boolean }) {
  const { localParticipant, cameraTrack, microphoneTrack } = useLocalParticipant();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const track = cameraTrack?.track;
    const on =
      !!track &&
      cameraTrack?.source === Track.Source.Camera &&
      !cameraTrack.isMuted;

    if (on && track) {
      track.attach(video);
      setCameraOn(true);
      return () => {
        track.detach(video);
      };
    }

    video.srcObject = null;
    setCameraOn(false);
  }, [cameraTrack]);

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
