"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useLocalParticipant,
  useRemoteParticipants,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, ParticipantKind, RoomEvent } from "livekit-client";
import { PARTICIPANT_LANG_ATTR } from "@/lib/config";
import { useTranslationRouting } from "./useTranslationRouting";
import VideoGrid from "./VideoGrid";
import SelfView from "./SelfView";
import ControlBar from "./ControlBar";
import LanguagePill from "./LanguagePill";
import CaptionsSidebar from "./CaptionsSidebar";

export default function InCall({
  initialLang,
  onLeave,
}: {
  initialLang: string;
  onLeave: () => void;
}) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const remotes = useRemoteParticipants();
  const [lang, setLang] = useState(initialLang);
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const interval = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!localParticipant || !room) return;
    const apply = () => {
      if (room.state === ConnectionState.Connected) {
        localParticipant.setAttributes({ [PARTICIPANT_LANG_ATTR]: lang });
      }
    };
    apply();
    room.on(RoomEvent.Connected, apply);
    return () => {
      room.off(RoomEvent.Connected, apply);
    };
  }, [room, localParticipant, lang]);

  useTranslationRouting(lang);

  const humanRemotes = useMemo(
    () => remotes.filter((participant) => participant.kind !== ParticipantKind.AGENT),
    [remotes],
  );

  const peerLangs = useMemo(() => {
    const map = new Map<string, string | undefined>();
    for (const participant of humanRemotes) {
      map.set(participant.identity, participant.attributes?.[PARTICIPANT_LANG_ATTR]);
    }
    return map;
  }, [humanRemotes]);

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/session/${room.name}`
      : "";

  const roomLabel = room.name ? room.name.slice(0, 8) : "meeting";

  return (
    <div className={`room-shell${captionsOpen ? " room-shell--captions-open" : ""}`}>
      <section className="room">
        <header className="meeting-header">
          <div className="meeting-brand">
            <span className="orbit-mark orbit-mark--small" aria-hidden>
              <span className="orbit-mark-core" />
              <span className="orbit-mark-ring" />
            </span>
            <span>Orbit Meeting</span>
          </div>

          <div className="meeting-title-block">
            <strong>Orbit · {roomLabel}</strong>
            <span>{formatElapsed(elapsed)}</span>
          </div>

          <div className="meeting-header-actions">
            <span className="meeting-participant-count">
              {humanRemotes.length + 1} participant{humanRemotes.length === 0 ? "" : "s"}
            </span>
            <LanguagePill value={lang} onChange={setLang} />
          </div>
        </header>

        <main className="room-stage">
          {humanRemotes.length === 0 ? (
            <EmptyStage inviteUrl={inviteUrl} />
          ) : (
            <VideoGrid participants={humanRemotes} myLang={lang} />
          )}
          <SelfView />
        </main>

        <ControlBar
          onLeave={onLeave}
          inviteUrl={inviteUrl}
          captionsOpen={captionsOpen}
          onToggleCaptions={() => setCaptionsOpen((value) => !value)}
        />
      </section>

      <CaptionsSidebar
        open={captionsOpen}
        onClose={() => setCaptionsOpen(false)}
        myLang={lang}
        peerLangs={peerLangs}
      />
    </div>
  );
}

function EmptyStage({ inviteUrl }: { inviteUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignored
    }
  }

  return (
    <div className="jitsi-empty-stage">
      <div className="jitsi-empty-avatar">O</div>
      <h2>You&apos;re the only one in the meeting</h2>
      <p>Invite others to join using the meeting link.</p>
      <button className="jitsi-primary-button jitsi-invite-button" onClick={copy}>
        {copied ? "Meeting link copied" : "Invite people"}
      </button>
    </div>
  );
}

function formatElapsed(total: number) {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const padded = [minutes, seconds].map((value) => String(value).padStart(2, "0"));
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${padded.join(":")}`
    : padded.join(":");
}
