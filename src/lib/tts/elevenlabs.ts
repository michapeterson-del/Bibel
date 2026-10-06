// Vorlesen des Bibeltexts über die ElevenLabs Text-to-Speech-API.
// Der API-Schlüssel wird - wie bei den KI-Anbietern - lokal verschlüsselt
// gespeichert.
//
// Die eigentliche Sprachausgabe (POST .../text-to-speech/...) laesst sich
// nicht direkt aus dem Browser aufrufen - ElevenLabs blockiert das per CORS
// (im Browser sichtbar als generischer Netzwerkfehler wie "Load failed").
// Deshalb laeuft dieser eine Aufruf ueber denselben Cloudflare-Worker-Proxy,
// der auch den "Gemeinsam"-KI-Modus bedient (siehe ai/provider.ts und
// cloudflare-worker/README.md).
//
// Hat der Nutzer selbst einen Schluessel eingetragen, reicht der Worker nur
// diesen weiter (speichert ihn nicht). Hat der Nutzer KEINEN eigenen
// Schluessel, nutzt der Worker stattdessen seinen eigenen, dort als Secret
// hinterlegten ELEVENLABS_API_KEY - dann funktioniert Vorlesen fuer alle
// Besucher ohne eigenen Schluessel, genau wie der "Gemeinsam"-KI-Modus.
import { GEMEINSAMER_PROXY_URL } from "../ai/provider";

const WORKER_BASIS = GEMEINSAMER_PROXY_URL.replace(/\/+$/, "");
const ELEVENLABS_TTS_PROXY = GEMEINSAMER_PROXY_URL ? `${WORKER_BASIS}/elevenlabs-tts` : "";
const ELEVENLABS_VOICES_PROXY = GEMEINSAMER_PROXY_URL ? `${WORKER_BASIS}/elevenlabs-voices` : "";

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
}

export async function listVoices(apiKey: string): Promise<ElevenLabsVoice[]> {
  if (apiKey) {
    const res = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });
    if (!res.ok) {
      throw new Error(`ElevenLabs: Stimmen konnten nicht geladen werden (${res.status}).`);
    }
    const data = (await res.json()) as { voices: { voice_id: string; name: string }[] };
    return data.voices.map((v) => ({ voice_id: v.voice_id, name: v.name }));
  }
  // Kein eigener Schluessel: Stimmenliste ueber den gemeinsamen Zugang laden
  if (!ELEVENLABS_VOICES_PROXY) {
    throw new Error(
      "Kein eigener Schlüssel hinterlegt und kein gemeinsamer Zugang eingerichtet."
    );
  }
  const res = await fetch(ELEVENLABS_VOICES_PROXY, { method: "POST" });
  if (!res.ok) {
    throw new Error(`ElevenLabs: Stimmen konnten nicht geladen werden (${res.status}).`);
  }
  const data = (await res.json()) as { voices: { voice_id: string; name: string }[] };
  return data.voices.map((v) => ({ voice_id: v.voice_id, name: v.name }));
}

export async function synthesize(apiKey: string, voiceId: string, text: string): Promise<Blob> {
  if (!ELEVENLABS_TTS_PROXY) {
    throw new Error(
      "Vorlesen braucht noch den Zwischenserver (siehe cloudflare-worker/README.md, Abschnitt Vorlesen)."
    );
  }
  const res = await fetch(ELEVENLABS_TTS_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey,
      voiceId,
      text,
      modelId: "eleven_multilingual_v2",
      voiceSettings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const err = await res.json();
      detail = err?.detail?.message ?? JSON.stringify(err);
    } catch {
      /* keine JSON-Fehlermeldung */
    }
    throw new Error(`ElevenLabs-Fehler (${res.status})${detail ? `: ${detail}` : ""}`);
  }
  return res.blob();
}

// Teilt den Kapiteltext in Häppchen unterhalb der ElevenLabs-Zeichenobergrenze,
// moeglichst an Vers-/Satzgrenzen, damit auch lange Kapitel funktionieren.
export function chunkText(verses: string[], maxLen = 3500): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const vers of verses) {
    const stueck = vers.trim();
    if (!stueck) continue;
    if (current.length + stueck.length + 1 > maxLen && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += (current ? " " : "") + stueck;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
