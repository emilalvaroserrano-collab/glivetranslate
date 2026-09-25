"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalParticipant } from "@livekit/components-react";
import { Track } from "livekit-client";
import { MicOffIcon } from "./icons";

export default function SelfView() {
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
  }, [cameraTrack, localParticipant]);

  const displayName = localParticipant?.name || "You";
  const initial = displayName.slice(0, 1).toUpperCase();
  const micOn = !!microphoneTrack && !microphoneTrack.isMuted;

  return (
    <div className="self-view">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="self-view-video"
        style={{ display: cameraOn ? "block" : "none" }}
      />
      {!cameraOn ? (
        <div className="self-view-empty">
          <span className="self-view-avatar">{initial}</span>
        </div>
      ) : null}
      {!micOn ? (
        <span className="self-view-mic" title="Microphone off"><MicOffIcon /></span>
      ) : null}
      <span className="self-view-name">{displayName} (you)</span>
    </div>
  );
}
