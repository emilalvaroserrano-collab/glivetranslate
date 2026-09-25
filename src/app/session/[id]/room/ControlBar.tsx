"use client";

import { useEffect, useRef, useState } from "react";
import { useLocalParticipant, useRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  CamOffIcon,
  CamOnIcon,
  CaptionsIcon,
  FullscreenIcon,
  LeaveIcon,
  LinkIcon,
  MicOffIcon,
  MicOnIcon,
  MoreIcon,
  ScreenShareIcon,
} from "./icons";

export default function ControlBar({
  onLeave,
  inviteUrl,
  captionsOpen,
  onToggleCaptions,
}: {
  onLeave: () => void;
  inviteUrl: string;
  captionsOpen: boolean;
  onToggleCaptions: () => void;
}) {
  const { localParticipant, microphoneTrack, cameraTrack, isScreenShareEnabled } =
    useLocalParticipant();
  const room = useRoomContext();
  const [copied, setCopied] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const micOn = !!microphoneTrack && !microphoneTrack.isMuted;
  const camOn =
    !!cameraTrack &&
    cameraTrack.source === Track.Source.Camera &&
    !cameraTrack.isMuted;
  const sharing = isScreenShareEnabled;

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  async function toggleMic() {
    await localParticipant.setMicrophoneEnabled(!micOn);
  }

  async function toggleCam() {
    await localParticipant.setCameraEnabled(!camOn);
  }

  async function toggleScreenShare() {
    if (sharing) {
      await localParticipant.setScreenShareEnabled(false);
      return;
    }

    // Ask LiveKit for screen-share audio as well as video. Browsers still let
    // the user decide whether the selected tab/window/system audio is shared.
    await localParticipant.setScreenShareEnabled(true, { audio: true });
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignored
    }
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen().catch(() => undefined);
    } else {
      await document.exitFullscreen().catch(() => undefined);
    }
    setMoreOpen(false);
  }

  async function leave() {
    await room.disconnect();
    onLeave();
  }

  return (
    <div className="jitsi-toolbox-wrap">
      <div className="jitsi-toolbox" role="toolbar" aria-label="Meeting controls">
        <ToolButton
          toggled={false}
          onClick={toggleMic}
          label={micOn ? "Mute" : "Unmute"}
          icon={micOn ? <MicOnIcon /> : <MicOffIcon />}
        />
        <ToolButton
          toggled={false}
          onClick={toggleCam}
          label={camOn ? "Stop video" : "Start video"}
          icon={camOn ? <CamOnIcon /> : <CamOffIcon />}
        />
        <ToolButton
          toggled={sharing}
          onClick={toggleScreenShare}
          label={sharing ? "Stop screen sharing" : "Share your screen"}
          icon={<ScreenShareIcon />}
        />
        <ToolButton
          toggled={captionsOpen}
          onClick={onToggleCaptions}
          label="Captions"
          icon={<CaptionsIcon />}
        />
        <ToolButton
          toggled={false}
          onClick={copyInvite}
          label={copied ? "Meeting link copied" : "Copy meeting link"}
          icon={<LinkIcon />}
        />

        <div className="jitsi-more-wrap" ref={moreRef}>
          <ToolButton
            toggled={moreOpen}
            onClick={() => setMoreOpen((value) => !value)}
            label="More actions"
            icon={<MoreIcon />}
          />
          {moreOpen ? (
            <div className="jitsi-more-menu">
              <button onClick={toggleFullscreen}>
                <FullscreenIcon />
                <span>View full screen</span>
              </button>
              <button onClick={copyInvite}>
                <LinkIcon />
                <span>{copied ? "Meeting link copied" : "Copy meeting link"}</span>
              </button>
            </div>
          ) : null}
        </div>

        <button
          className="jitsi-hangup"
          onClick={leave}
          title="Leave meeting"
          aria-label="Leave meeting"
        >
          <LeaveIcon />
        </button>
      </div>
    </div>
  );
}

function ToolButton({
  toggled,
  onClick,
  label,
  icon,
}: {
  toggled: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      className={`jitsi-tool-button${toggled ? " is-on" : ""}`}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={toggled}
    >
      {icon}
      <span className="jitsi-tool-label">{label}</span>
    </button>
  );
}
