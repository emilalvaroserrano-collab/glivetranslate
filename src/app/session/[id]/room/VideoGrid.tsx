"use client";

import { useMemo } from "react";
import { useTracks, VideoTrack } from "@livekit/components-react";
import { Track, type RemoteParticipant } from "livekit-client";
import ParticipantTile from "./ParticipantTile";
import SelfView from "./SelfView";

export default function VideoGrid({
  participants,
  myLang,
}: {
  participants: RemoteParticipant[];
  myLang: string;
}) {
  const screenShares = useTracks([Track.Source.ScreenShare]);
  const activeScreenShare = screenShares[0];

  const layout = useMemo(
    () => deriveLayout(participants.length + 1),
    [participants.length],
  );

  if (activeScreenShare) {
    const sharerName =
      activeScreenShare.participant.name ||
      activeScreenShare.participant.identity ||
      "Participant";

    return (
      <div className="jitsi-stage-layout">
        <section className="jitsi-large-video" aria-label={`${sharerName} screen share`}>
          <VideoTrack trackRef={activeScreenShare} />
          <div className="jitsi-share-label">
            <span className="jitsi-share-dot" />
            {sharerName} is sharing
          </div>
        </section>

        <aside className="jitsi-filmstrip" aria-label="Participants">
          <SelfView compact />
          {participants.map((participant) => (
            <ParticipantTile
              compact
              key={participant.identity}
              participant={participant}
              myLang={myLang}
            />
          ))}
        </aside>
      </div>
    );
  }

  return (
    <div
      className="tile-grid"
      style={{
        gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
        maxWidth: layout.maxWidth,
      }}
    >
      <SelfView />
      {participants.map((participant) => (
        <ParticipantTile
          key={participant.identity}
          participant={participant}
          myLang={myLang}
        />
      ))}
    </div>
  );
}

function deriveLayout(n: number): { cols: number; maxWidth: string } {
  if (n <= 1) return { cols: 1, maxWidth: "min(900px, 88vw)" };
  if (n <= 2) return { cols: 2, maxWidth: "min(1400px, 94vw)" };
  if (n <= 4) return { cols: 2, maxWidth: "min(1200px, 94vw)" };
  if (n <= 6) return { cols: 3, maxWidth: "min(1400px, 96vw)" };
  if (n <= 9) return { cols: 3, maxWidth: "min(1600px, 96vw)" };
  return { cols: 4, maxWidth: "min(1700px, 96vw)" };
}
