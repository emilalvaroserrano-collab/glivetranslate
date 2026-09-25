"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  useRemoteParticipants,
  useTextStream,
} from "@livekit/components-react";
import { getLanguageByCode } from "@/lib/languages";
import { CloseIcon } from "./icons";

const TRANSLATION_TOPIC = "lk.translation";

export default function CaptionsSidebar({
  open,
  onClose,
  myLang,
  peerLangs,
}: {
  open: boolean;
  onClose: () => void;
  myLang: string;
  peerLangs: Map<string, string | undefined>;
}) {
  const { textStreams } = useTextStream(TRANSLATION_TOPIC);
  const remotes = useRemoteParticipants();
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const participant of remotes) {
      map.set(
        participant.identity,
        participant.name || participant.identity,
      );
    }
    return map;
  }, [remotes]);

  const entries = useMemo(() => {
    const matching = textStreams
      .filter(
        (stream) =>
          stream.streamInfo.attributes?.target_lang === myLang,
      )
      .sort(
        (a, b) =>
          a.streamInfo.timestamp - b.streamInfo.timestamp,
      );

    type Entry = {
      key: string;
      sourceIdentity: string;
      sourceKind: string;
      text: string;
      sourceLang: string | undefined;
    };

    const out: Entry[] = [];
    const openIdxBySource = new Map<string, number>();

    for (const stream of matching) {
      const source =
        stream.streamInfo.attributes?.source_identity ??
        stream.participantInfo.identity;
      const sourceKind =
        stream.streamInfo.attributes?.source_kind ?? "mic";
      const groupingKey = `${sourceKind}:${source}`;
      const isFinal =
        stream.streamInfo.attributes?.final === "true";
      const text = stream.text.trim();

      if (isFinal) {
        if (text) {
          const idx = openIdxBySource.get(groupingKey);
          if (idx !== undefined) {
            out[idx].text = `${out[idx].text} ${text}`.trim();
          } else {
            out.push({
              key: stream.streamInfo.id,
              sourceIdentity: source,
              sourceKind,
              text,
              sourceLang: peerLangs.get(source),
            });
          }
        }
        openIdxBySource.delete(groupingKey);
        continue;
      }

      if (!text) continue;

      const openIdx = openIdxBySource.get(groupingKey);
      if (openIdx !== undefined) {
        out[openIdx].text =
          `${out[openIdx].text} ${text}`.trim();
      } else {
        out.push({
          key: stream.streamInfo.id,
          sourceIdentity: source,
          sourceKind,
          text,
          sourceLang: peerLangs.get(source),
        });
        openIdxBySource.set(groupingKey, out.length - 1);
      }
    }

    return out;
  }, [textStreams, myLang, peerLangs]);

  useEffect(() => {
    if (!open || !bodyRef.current) return;
    bodyRef.current.scrollTop =
      bodyRef.current.scrollHeight;
  }, [entries, open]);

  const myLangInfo = getLanguageByCode(myLang);

  return (
    <aside
      className={`captions${open ? " open" : ""}`}
      aria-hidden={!open}
    >
      <div className="captions-inner">
        <div className="captions-header">
          <span>
            Captions{" "}
            {myLangInfo &&
              `· ${myLangInfo.flag} ${myLangInfo.name}`}
          </span>
          <button
            className="captions-close"
            onClick={onClose}
            aria-label="Close captions"
          >
            <CloseIcon />
          </button>
        </div>

        <div ref={bodyRef} className="captions-body">
          {entries.length === 0 ? (
            <div className="captions-empty">
              Translation captions will appear here when
              participants or shared media speak.
            </div>
          ) : (
            entries.map((entry) => (
              <div
                className="captions-entry"
                key={entry.key}
              >
                <div className="captions-speaker">
                  <span className="captions-speaker-name">
                    {names.get(entry.sourceIdentity) ??
                      entry.sourceIdentity}
                  </span>
                  <span className="captions-speaker-lang">
                    {entry.sourceKind === "share"
                      ? "SCREEN SHARE"
                      : entry.sourceLang
                        ? `${entry.sourceLang} → ${myLang}`
                        : myLang}
                  </span>
                </div>
                <p className="captions-text">{entry.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
