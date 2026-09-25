"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  StartAudio,
} from "@livekit/components-react";
import "@livekit/components-styles";
import InCall from "./InCall";

const STORAGE_KEY_NAME = "lt.displayName";
const STORAGE_KEY_LANG = "lt.lang";

interface TokenResponse {
  token: string;
  serverUrl: string;
}

export default function RoomClient({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [identity] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? `peer-${crypto.randomUUID().slice(0, 8)}`
      : `peer-${Math.random().toString(36).slice(2, 10)}`,
  );
  const [displayName, setDisplayName] = useState<string>("");
  const [initialLang, setInitialLang] = useState<string>("en");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const name = window.sessionStorage.getItem(STORAGE_KEY_NAME);
      const lang = window.sessionStorage.getItem(STORAGE_KEY_LANG);

      if (!name || !lang) {
        router.replace(`/session/${sessionId}`);
        return;
      }

      setDisplayName(name);
      setInitialLang(lang);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [router, sessionId]);

  useEffect(() => {
    if (!displayName) return;

    const controller = new AbortController();
    const url = `/api/token?room=${encodeURIComponent(
      sessionId,
    )}&identity=${encodeURIComponent(identity)}&name=${encodeURIComponent(displayName)}`;

    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Token request failed (${res.status})`);
        }
        return res.json() as Promise<TokenResponse>;
      })
      .then((data) => {
        setToken(data.token);
        setServerUrl(data.serverUrl);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => controller.abort();
  }, [sessionId, identity, displayName]);

  function handleLeave() {
    router.push("/");
  }

  if (error) {
    return (
      <div className="page">
        <div className="container" style={{ textAlign: "center" }}>
          <h1 className="display display-md" style={{ marginBottom: 16 }}>
            Couldn&apos;t join the call
          </h1>
          <p className="body" style={{ marginBottom: 24 }}>
            {error}
          </p>
          <button className="btn btn-outline" onClick={() => router.push("/")}>
            Back to home
          </button>
        </div>
      </div>
    );
  }

  if (!token || !serverUrl) {
    return (
      <div className="page">
        <div className="container" style={{ textAlign: "center" }}>
          <div className="spinner" style={{ margin: "0 auto 16px" }} />
          <p className="mono">Connecting…</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      video={false}
      audio={false}
      connect={true}
      onDisconnected={handleLeave}
      data-lk-theme="default"
      style={{ height: "100vh", background: "var(--bg)" }}
    >
      <InCall initialLang={initialLang} onLeave={handleLeave} />
      <RoomAudioRenderer />
      <StartAudio
        label="Tap to enable translated audio"
        className="btn"
        style={{
          position: "fixed",
          left: "50%",
          bottom: 96,
          transform: "translateX(-50%)",
          zIndex: 1000,
        }}
      />
    </LiveKitRoom>
  );
}
