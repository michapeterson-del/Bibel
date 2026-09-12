import type { Einordnung } from "../types";

const LABELS: Record<Einordnung, string> = {
  klar: "Dazu spricht die Bibel deutlich",
  auslegungsfrage: "Dazu gibt es mehrere ernstzunehmende Auslegungen",
  keine_biblische_aussage: "Dazu sagt die Bibel nichts",
  alltag: "Praktische Antwort mit biblischer Grundhaltung",
};

export default function BelegstufeBadge({ einordnung }: { einordnung: Einordnung }) {
  return <span className={`belegstufe ${einordnung}`}>{LABELS[einordnung] ?? einordnung}</span>;
}
