import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Topic } from "../lib/db/bibleDb";
import { getTopicVerses, getTopics, searchFullText } from "../lib/db/bibleDb";
import { useSettings } from "../lib/SettingsContext";
import { askEssay } from "../lib/ai/provider";
import { kvGet } from "../lib/db/userDb";
import { decryptSecret } from "../lib/crypto";
import { createChat, saveChat } from "../lib/db/userDb";
import type { VerseRow } from "../types";

export default function ExploreScreen() {
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [customThema, setCustomThema] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [essay, setEssay] = useState<{ thema: string; text: string; verse: VerseRow[] } | null>(null);

  useEffect(() => {
    getTopics().then(setTopics);
  }, []);

  async function verseForThema(thema: string, topicId?: number): Promise<VerseRow[]> {
    if (topicId) return getTopicVerses(topicId);
    const hits = await searchFullText(thema);
    return hits.slice(0, 18);
  }

  async function erstelleAufsatz(thema: string, topicId?: number) {
    if (!settings) return;
    if (settings.aiProvider === "aus") {
      setError("Kein KI-Anbieter eingerichtet. Öffne Einstellungen → KI.");
      return;
    }
    setBusy(true);
    setError("");
    setEssay(null);
    try {
      const verse = await verseForThema(thema, topicId);
      if (verse.length === 0) {
        setError("Zu diesem Thema wurden keine passenden Bibelstellen gefunden. Versuch ein anderes Stichwort.");
        return;
      }
      let apiKey = "";
      if (settings.aiProvider !== "gemeinsam") {
        const apiKeyEnc = await kvGet<string>(`api_key_${settings.aiProvider}`);
        apiKey = apiKeyEnc ? await decryptSecret(apiKeyEnc) : "";
        if (!apiKey) {
          setError("Kein API-Schlüssel hinterlegt. Öffne Einstellungen → KI.");
          return;
        }
      }
      const referenzen = verse.map((v) => ({ referenz: `${v.bookName} ${v.chapter},${v.verse}`, text: v.text }));
      const text = await askEssay(
        { provider: settings.aiProvider, apiKey, model: settings.aiModell || undefined },
        { thema, verse: referenzen }
      );
      setEssay({ thema, text, verse });

      const chat = await createChat("bibel", `Erforschen: ${thema}`);
      chat.nachrichten.push({
        id: crypto.randomUUID(),
        rolle: "assistant",
        text,
        erstellt_am: new Date().toISOString(),
      });
      await saveChat(chat);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!essay) return;
    const text = `${essay.thema}\n\n${essay.text}`;
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* abgebrochen */ }
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  return (
    <div>
      <div className="header-bar" style={{ paddingTop: 8 }}>
        <h1 style={{ fontSize: "1.3rem" }}>Erforschen</h1>
      </div>

      <p style={{ color: "var(--text-muted)" }}>Wähle ein Thema oder gib ein eigenes ein – Amibel schreibt dir dazu einen Aufsatz mit Bibelzitaten.</p>

      <div className="chip-row" style={{ marginBottom: 14 }}>
        {topics.map((t) => (
          <button key={t.id} className="chip" onClick={() => erstelleAufsatz(t.name, t.id)} disabled={busy}>
            {t.name}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          type="text"
          placeholder="Eigenes Thema…"
          value={customThema}
          onChange={(e) => setCustomThema(e.target.value)}
        />
        <button className="btn" disabled={busy || !customThema.trim()} onClick={() => erstelleAufsatz(customThema.trim())}>
          Los
        </button>
      </div>

      {busy && <p>Amibel schreibt…</p>}
      {error && (
        <div className="card" style={{ background: "var(--lila-bg)", color: "var(--lila-fg)" }}>
          {error}
          {error.includes("Einstellungen") && (
            <div style={{ marginTop: 8 }}>
              <button className="btn secondary" onClick={() => navigate("/einstellungen")}>Zu den Einstellungen</button>
            </div>
          )}
        </div>
      )}

      {essay && (
        <div className="card">
          <h2>{essay.thema}</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{essay.text}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button className="chip" onClick={share}>📤 Teilen</button>
            <button className="chip" onClick={() => navigator.clipboard.writeText(essay.text)}>📋 Kopieren</button>
          </div>
        </div>
      )}
    </div>
  );
}
