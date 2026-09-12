import { useState } from "react";
import type { AiAntwort } from "../types";
import BelegstufeBadge from "./BelegstufeBadge";
import { useVerseDetail } from "../lib/VerseDetailContext";
import { parseGermanReference } from "../lib/ai/reference";

export default function AnswerCard({ antwort }: { antwort: AiAntwort }) {
  const [stellenOffen, setStellenOffen] = useState(true);
  const { open: openVerseDetail } = useVerseDetail();

  async function onStelleClick(referenz: string) {
    const parsed = await parseGermanReference(referenz);
    if (!parsed) return;
    openVerseDetail({
      osis: parsed.osis,
      bookName: parsed.bookName,
      chapter: parsed.chapter,
      verseVon: parsed.verseVon,
      verseBis: parsed.verseBis,
    });
  }

  async function share() {
    const text = buildShareText(antwort);
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        /* abgebrochen */
      }
    } else {
      await navigator.clipboard.writeText(text);
    }
  }

  return (
    <div className="msg assistant">
      <p style={{ fontWeight: 700, marginBottom: 8 }}>{antwort.kurzantwort}</p>

      {antwort.bibelstellen.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <button
            className="chip"
            onClick={() => setStellenOffen((v) => !v)}
            style={{ marginBottom: 6 }}
          >
            📖 Bibelstellen ({antwort.bibelstellen.length}) {stellenOffen ? "▲" : "▼"}
          </button>
          {stellenOffen && (
            <div>
              {antwort.bibelstellen.map((b, i) => (
                <div
                  key={i}
                  onClick={() => onStelleClick(b.referenz)}
                  style={{
                    padding: "8px 10px",
                    marginBottom: 6,
                    borderRadius: 10,
                    background: "var(--blau-weich-bg)",
                    color: "var(--blau-weich-fg)",
                    cursor: "pointer",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: 700 }}>{b.referenz}</p>
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>{b.warum_relevant}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p style={{ whiteSpace: "pre-wrap" }}>{antwort.erklaerung}</p>

      <div style={{ margin: "10px 0" }}>
        <BelegstufeBadge einordnung={antwort.einordnung} />
      </div>

      {antwort.konfessionell_umstritten && (
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          ⚠ Dazu unterscheiden sich Christen ernsthaft – beide Hauptpositionen sind oben genannt.
        </p>
      )}

      {antwort.naechster_schritt && (
        <div className="card" style={{ background: "var(--creme-bg)", borderColor: "transparent", marginTop: 8 }}>
          <p style={{ margin: 0, fontWeight: 600, color: "var(--creme-fg)" }}>Nächster Schritt</p>
          <p style={{ margin: "4px 0 0", color: "var(--creme-fg)" }}>{antwort.naechster_schritt}</p>
        </div>
      )}

      {antwort.warnung && (
        <p style={{ fontSize: "0.8rem", color: "var(--lila-fg)", marginTop: 8 }}>⚠ {antwort.warnung}</p>
      )}

      <div style={{ marginTop: 10 }}>
        <button className="chip" onClick={share}>📤 Teilen</button>
      </div>
    </div>
  );
}

function buildShareText(a: AiAntwort): string {
  const lines = [a.kurzantwort, "", a.erklaerung];
  if (a.bibelstellen.length > 0) {
    lines.push("", "Bibelstellen:", ...a.bibelstellen.map((b) => `- ${b.referenz}`));
  }
  if (a.naechster_schritt) lines.push("", `Nächster Schritt: ${a.naechster_schritt}`);
  return lines.join("\n");
}
