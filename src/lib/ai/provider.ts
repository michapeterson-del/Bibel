import type { AiAntwort, AiProvider, ChatMessage, ChatModus, Klarheitsstufe } from "../../types";
import { ALLTAG_HINWEIS, SYSTEM_PROMPT } from "./systemPrompt";
import { referenceExists } from "./reference";

export interface AiCallOptions {
  provider: AiProvider;
  apiKey: string;
  model?: string;
}

interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

const DEFAULT_MODELS: Record<Exclude<AiProvider, "aus">, string> = {
  gemeinsam: "claude-sonnet-5",
  anthropic: "claude-sonnet-5",
  openai: "gpt-4o-mini",
  gemini: "gemini-1.5-flash",
  deepseek: "deepseek-chat",
};

// Wird nach der Cloudflare-Worker-Einrichtung mit der echten Adresse befuellt
// (siehe cloudflare-worker/README.md). Leer = "Gemeinsam"-Modus noch nicht startklar.
// Derselbe Worker leitet unter "/elevenlabs-tts" auch die Vorlese-Anfragen weiter
// (siehe lib/tts/elevenlabs.ts) - ElevenLabs erlaubt dafuer keine direkten
// Browser-Anfragen (CORS), daher der Umweg ueber den Worker.
export const GEMEINSAMER_PROXY_URL: string = "https://green-wind-cbf9.michapeterson.workers.dev";

function klarheitsHinweis(stufe: Klarheitsstufe): string {
  if (stufe === "kurz") return "Klarheitsstufe: kurz (erklaerung: 3-4 Saetze).";
  if (stufe === "ausfuehrlich") return "Klarheitsstufe: ausfuehrlich (erklaerung: 12-20 Saetze).";
  return "Klarheitsstufe: normal (erklaerung: 7-12 Saetze).";
}

export function buildMessages(params: {
  frage: string;
  modus: ChatModus;
  klarheitsstufe: Klarheitsstufe;
  verlauf: ChatMessage[];
  versKontext?: string;
  konfessionelleVarianten: boolean;
}): ChatTurn[] {
  const turns: ChatTurn[] = [{ role: "system", content: SYSTEM_PROMPT }];

  const hinweise: string[] = [klarheitsHinweis(params.klarheitsstufe)];
  if (params.modus === "alltag") hinweise.push(ALLTAG_HINWEIS);
  if (!params.konfessionelleVarianten) {
    hinweise.push(
      "Der Nutzer hat 'konfessionelle Auslegungsvarianten' deaktiviert: nenne dennoch ehrlich, wenn " +
        "Christen sich unterscheiden, aber fasse dich dabei kuerzer."
    );
  }
  if (params.versKontext) hinweise.push(params.versKontext);
  turns.push({ role: "system", content: hinweise.join("\n\n") });

  // verlauf kann die aktuelle Frage bereits als letzten Eintrag enthalten
  // (sie wird vor dem KI-Aufruf im Chat gespeichert) - Duplikat vermeiden.
  const vorherigerVerlauf = params.verlauf.filter(
    (m, i) => !(i === params.verlauf.length - 1 && m.rolle === "user" && m.text === params.frage)
  );
  const letzte = vorherigerVerlauf.slice(-6);
  for (const m of letzte) {
    turns.push({ role: m.rolle === "user" ? "user" : "assistant", content: m.text });
  }
  turns.push({ role: "user", content: params.frage });
  return turns;
}

async function callOpenAiCompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatTurn[],
  jsonMode = true
): Promise<string> {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.25,
      max_tokens: 2400,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`KI-Anfrage fehlgeschlagen (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Leere Antwort vom KI-Anbieter.");
  return content;
}

async function callGemini(apiKey: string, model: string, messages: ChatTurn[]): Promise<string> {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: rest.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 2400,
        responseMimeType: "application/json",
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`KI-Anfrage fehlgeschlagen (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Leere Antwort vom KI-Anbieter.");
  return content;
}

function anthropicRequestBody(model: string, messages: ChatTurn[]) {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  return JSON.stringify({
    model,
    max_tokens: 2400,
    temperature: 0.25,
    system,
    messages: rest.map((m) => ({ role: m.role, content: m.content })),
  });
}

async function parseAnthropicResponse(res: Response): Promise<string> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`KI-Anfrage fehlgeschlagen (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  const content = (data?.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n");
  if (!content) throw new Error("Leere Antwort vom KI-Anbieter.");
  return content;
}

async function callAnthropic(apiKey: string, model: string, messages: ChatTurn[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      // Direkter Aufruf aus dem Browser: von Anthropic ausdruecklich vorgesehener
      // Opt-in-Header (der API-Schluessel liegt damit im Client, wie bei den
      // anderen Anbietern auch - siehe Hinweistext in den Einstellungen).
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: anthropicRequestBody(model, messages),
  });
  return parseAnthropicResponse(res);
}

/** "Gemeinsamer" Modus: Anfrage geht an den Cloudflare-Worker-Proxy des
 * Betreibers statt direkt an Anthropic - der Worker haengt dort den echten,
 * nur ihm bekannten API-Schluessel an. Kein Schluessel im Browser noetig. */
async function callViaProxy(model: string, messages: ChatTurn[]): Promise<string> {
  if (!GEMEINSAMER_PROXY_URL) {
    throw new Error(
      "Der gemeinsame KI-Zugang ist noch nicht eingerichtet. Wähle in den Einstellungen einen eigenen Anbieter mit API-Schlüssel."
    );
  }
  const res = await fetch(GEMEINSAMER_PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: anthropicRequestBody(model, messages),
  });
  return parseAnthropicResponse(res);
}

async function callProviderRaw(opts: AiCallOptions, messages: ChatTurn[], jsonMode = true): Promise<string> {
  const model = opts.model || (opts.provider !== "aus" ? DEFAULT_MODELS[opts.provider] : "");
  if (opts.provider === "gemeinsam") {
    return callViaProxy(model, messages);
  }
  if (opts.provider === "anthropic") {
    return callAnthropic(opts.apiKey, model, messages);
  }
  if (opts.provider === "openai") {
    return callOpenAiCompatible("https://api.openai.com/v1/chat/completions", opts.apiKey, model, messages, jsonMode);
  }
  if (opts.provider === "deepseek") {
    return callOpenAiCompatible("https://api.deepseek.com/chat/completions", opts.apiKey, model, messages, jsonMode);
  }
  if (opts.provider === "gemini") {
    return callGemini(opts.apiKey, model, messages);
  }
  throw new Error("Kein KI-Anbieter konfiguriert.");
}

const ESSAY_SYSTEM_PROMPT = `Du bist Amibel und schreibst einen bibeltreuen Aufsatz (500-800 Woerter) zu einem Thema,
mit woertlichen Luther-1912-Zitaten aus den vorgelegten Stellen. Stil: Haken am Anfang (Szene, Frage
oder Bild), gruendlich und quellenfest, konkrete Ueberschrift als erste Zeile, starker Lead,
Zwischenueberschriften und kurze Absaetze (3-5 Saetze), aktive Sprache, wie ein guter Freund erzaehlt -
KEINE Saetze wie "Es ist wichtig zu...". Antworte NUR mit reinem Text (kein JSON, kein Markdown wie
#### oder **fett**). Nenne nur Stellen, die dir vorgelegt wurden.`;

const ESSAY_SYSTEM_PROMPT_STICHWORTE = `Du bist Amibel und antwortest zu einem Thema NICHT mit einem
ausformulierten Aufsatz, sondern stichwortartig und kurz. Aufbau: eine knappe Einleitung (1-2 Saetze),
danach 6-12 kurze Stichpunkte (je ein Gedanke/Aspekt des Themas in einem kurzen Satz oder Stichwort,
mit Bibelstellen-Bezug in Klammern wo passend), jeder Stichpunkt beginnt mit "- " am Zeilenanfang.
Keine langen Absaetze, keine Ueberschriften. Zitiere Luther 1912 nur kurz und sparsam, wenn es den
Punkt staerkt. Antworte NUR mit reinem Text (kein JSON, kein Markdown wie #### oder **fett**).
Nenne nur Stellen, die dir vorgelegt wurden.`;

export async function askEssay(
  opts: AiCallOptions,
  params: { thema: string; verse: { referenz: string; text: string }[]; stil?: "text" | "stichworte" }
): Promise<string> {
  const versListe = params.verse.map((v) => `${v.referenz}: "${v.text}"`).join("\n");
  const systemPrompt = params.stil === "stichworte" ? ESSAY_SYSTEM_PROMPT_STICHWORTE : ESSAY_SYSTEM_PROMPT;
  const messages: ChatTurn[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: `Thema: ${params.thema}\n\nVorgelegte Bibelstellen (Luther 1912):\n${versListe}`,
    },
  ];
  const raw = await callProviderRaw(opts, messages, false);
  return raw
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
}

function extractJson(raw: string): unknown {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1);
  }
  return JSON.parse(text);
}

function coerceAntwort(obj: unknown): AiAntwort {
  const o = obj as Record<string, unknown>;
  const bibelstellen = Array.isArray(o.bibelstellen)
    ? (o.bibelstellen as Array<Record<string, unknown>>).map((b) => ({
        referenz: String(b.referenz ?? ""),
        warum_relevant: String(b.warum_relevant ?? ""),
      }))
    : [];
  return {
    kurzantwort: String(o.kurzantwort ?? ""),
    bibelstellen,
    erklaerung: String(o.erklaerung ?? ""),
    einordnung: (o.einordnung as AiAntwort["einordnung"]) ?? "klar",
    konfessionell_umstritten: Boolean(o.konfessionell_umstritten),
    naechster_schritt: String(o.naechster_schritt ?? ""),
  };
}

/** Ruft die KI auf, parst die JSON-Antwort und validiert jede Bibelstelle
 * gegen die lokale Datenbank. Ungueltige Referenzen fuehren zu einem
 * erneuten Versuch; danach werden verbleibende ungueltige Stellen entfernt
 * und eine Warnung angehaengt. */
export async function askAmibel(
  opts: AiCallOptions,
  params: {
    frage: string;
    modus: ChatModus;
    klarheitsstufe: Klarheitsstufe;
    verlauf: ChatMessage[];
    versKontext?: string;
    konfessionelleVarianten: boolean;
  }
): Promise<AiAntwort> {
  const messages = buildMessages(params);

  let raw = await callProviderRaw(opts, messages);
  let antwort = coerceAntwort(extractJson(raw));

  const invalid: string[] = [];
  for (const stelle of antwort.bibelstellen) {
    const ok = await referenceExists(stelle.referenz);
    if (!ok) invalid.push(stelle.referenz);
  }

  if (invalid.length > 0) {
    const retryMessages: ChatTurn[] = [
      ...messages,
      { role: "assistant", content: raw },
      {
        role: "user",
        content:
          `Folgende von dir genannte Bibelstellen existieren nicht in der Bibel: ${invalid.join(", ")}. ` +
          "Bitte antworte erneut mit demselben JSON-Format, aber nur mit tatsaechlich existierenden Stellen " +
          "im Format 'Buch Kapitel,Vers'.",
      },
    ];
    try {
      raw = await callProviderRaw(opts, retryMessages);
      const retryAntwort = coerceAntwort(extractJson(raw));
      const stillInvalid: string[] = [];
      for (const stelle of retryAntwort.bibelstellen) {
        const ok = await referenceExists(stelle.referenz);
        if (!ok) stillInvalid.push(stelle.referenz);
      }
      antwort = retryAntwort;
      if (stillInvalid.length > 0) {
        antwort.bibelstellen = antwort.bibelstellen.filter((b) => !stillInvalid.includes(b.referenz));
        antwort.warnung = `Einige genannte Stellen konnten nicht bestätigt werden und wurden entfernt: ${stillInvalid.join(", ")}`;
      }
    } catch {
      antwort.bibelstellen = antwort.bibelstellen.filter((b) => !invalid.includes(b.referenz));
      antwort.warnung = `Einige genannte Stellen konnten nicht bestätigt werden und wurden entfernt: ${invalid.join(", ")}`;
    }
  }

  return antwort;
}

export async function testConnection(opts: AiCallOptions): Promise<{ ok: boolean; message: string }> {
  try {
    const raw = await callProviderRaw(opts, [
      { role: "system", content: "Antworte nur mit dem JSON-Objekt {\"ok\": true}." },
      { role: "user", content: "Verbindungstest" },
    ]);
    extractJson(raw);
    return { ok: true, message: "Verbindung erfolgreich." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Unbekannter Fehler." };
  }
}
