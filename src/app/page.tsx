"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function OrbitMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`orbit-brand${compact ? " orbit-brand--compact" : ""}`}>
      <span className="orbit-mark" aria-hidden>
        <span className="orbit-mark-core" />
        <span className="orbit-mark-ring" />
      </span>
      <span className="orbit-brand-name">Orbit Meeting</span>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function createSession() {
    setLoading(true);
    const sessionId = crypto.randomUUID();
    router.push(`/session/${sessionId}`);
  }

  return (
    <main className="orbit-welcome">
      <header className="orbit-welcome-topbar">
        <OrbitMark compact />
        <span className="orbit-welcome-secure">Secure video meetings</span>
      </header>

      <section className="orbit-welcome-hero">
        <div className="orbit-welcome-copy">
          <OrbitMark />
          <h1>Meet, talk, and understand everyone.</h1>
          <p>
            Start an Orbit Meeting and translate incoming conversations into
            the language you choose.
          </p>
        </div>

        <div className="orbit-start-card">
          <div className="orbit-start-card-title">Start a new meeting</div>
          <div className="orbit-start-card-subtitle">
            Create a private room and share the invite link with anyone.
          </div>
          <button
            className="jitsi-primary-button"
            onClick={createSession}
            disabled={loading}
            id="create-session-btn"
          >
            {loading ? <span className="jitsi-spinner" /> : null}
            {loading ? "Creating meeting…" : "Start meeting"}
          </button>
        </div>
      </section>

      <footer className="orbit-welcome-footer">
        <span>Orbit Meeting</span>
        <span>Realtime multilingual conferencing</span>
      </footer>
    </main>
  );
}
