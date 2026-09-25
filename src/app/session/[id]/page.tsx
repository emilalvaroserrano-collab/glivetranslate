"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PICKER_LANGUAGES } from "@/lib/languages";
import { CamOffIcon, MicOffIcon } from "./room/icons";

const STORAGE_KEY_NAME = "lt.displayName";
const STORAGE_KEY_LANG = "lt.lang";

export default function PreFlightPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [lang, setLang] = useState<string>("en");
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedName = window.sessionStorage.getItem(STORAGE_KEY_NAME);
    const savedLang = window.sessionStorage.getItem(STORAGE_KEY_LANG);
    if (savedName) setDisplayName(savedName);
    if (savedLang) setLang(savedLang);
  }, []);

  const initial = useMemo(
    () => (displayName.trim().slice(0, 1) || "O").toUpperCase(),
    [displayName],
  );

  function handleJoin() {
    if (!displayName.trim()) return;
    window.sessionStorage.setItem(STORAGE_KEY_NAME, displayName.trim());
    window.sessionStorage.setItem(STORAGE_KEY_LANG, lang);
    router.push(`/session/${id}/room`);
  }

  async function copyInviteLink() {
    const url = `${window.location.origin}/session/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // ignored
    }
  }

  return (
    <main className="prejoin-page">
      <div className="prejoin-brand">
        <span className="orbit-mark" aria-hidden>
          <span className="orbit-mark-core" />
          <span className="orbit-mark-ring" />
        </span>
        <span>Orbit Meeting</span>
      </div>

      <section className="prejoin-shell">
        <div className="prejoin-preview">
          <div className="prejoin-avatar">{initial}</div>
          <div className="prejoin-preview-controls" aria-hidden>
            <span className="prejoin-round-control"><MicOffIcon /></span>
            <span className="prejoin-round-control"><CamOffIcon /></span>
          </div>
        </div>

        <div className="prejoin-panel">
          <h1>Join meeting</h1>
          <p className="prejoin-help">
            Enter your name and choose the language you want to hear.
          </p>

          <label className="prejoin-label">
            Display name
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Enter your name"
              autoFocus
              className="jitsi-field"
              maxLength={40}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleJoin();
              }}
            />
          </label>

          <label className="prejoin-label">
            Translation language
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              className="jitsi-field jitsi-select"
            >
              {PICKER_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </label>

          <button
            className="jitsi-primary-button prejoin-join"
            onClick={handleJoin}
            disabled={!displayName.trim()}
            id="join-btn"
          >
            Join meeting
          </button>
          <button className="jitsi-secondary-button" onClick={copyInviteLink}>
            {shareCopied ? "Meeting link copied" : "Copy meeting link"}
          </button>

          <p className="prejoin-note">
            Your microphone and camera stay off until you enable them.
          </p>
        </div>
      </section>
    </main>
  );
}
