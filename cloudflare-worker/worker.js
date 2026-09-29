/**
 * Amibel-Proxy (Cloudflare Worker)
 *
 * Zwei Aufgaben in einem Worker:
 *
 * 1. "/" - KI-Chat-Proxy: versteckt den echten Anthropic-API-Schlüssel vor
 *    dem Browser (für den "Gemeinsam"-KI-Modus). Der Schlüssel liegt NUR
 *    hier als verschlüsseltes Worker-Secret (ANTHROPIC_API_KEY) - niemals
 *    im App-Code, niemals im Browser sichtbar.
 *
 * 2. "/elevenlabs-tts" - Vorlese-Proxy: ElevenLabs erlaubt keine direkten
 *    Audio-Anfragen aus dem Browser (CORS-Sperre, im Browser sichtbar als
 *    Fehler wie "Load failed"). Dieser Weg leitet die Anfrage serverseitig
 *    weiter - mit dem Schlüssel, den der jeweilige Nutzer selbst in der App
 *    eingegeben hat. Der Worker speichert diesen Schlüssel nicht, er reicht
 *    ihn nur für die eine Anfrage an ElevenLabs weiter.
 *
 * Einrichtung: siehe README.md in diesem Ordner.
 */

// Nur Anfragen von dieser Adresse erlauben (Hotlink-/Missbrauchsschutz;
// ersetzt KEINE echte Absicherung, aber haelt beilaeufigen Missbrauch ab).
// Mehrere erlaubte Ursprünge mit Komma trennen, z.B. für lokale Entwicklung.
const ERLAUBTE_URSPRUENGE = [
  "https://michapeterson-del.github.io",
  "http://localhost:5173",
];

// Grenzen fuer den gemeinsamen KI-Zugang (passend zu dem, was die App schickt).
const ERLAUBTE_MODELLE = ["claude-sonnet-5"];
const MAX_TOKENS = 2400;
const MAX_NACHRICHTEN = 40;
const MAX_ZEICHEN = 60000;

// Einfaches Tempolimit pro IP (pro Worker-Instanz). Zusaetzlich im
// Cloudflare-Dashboard eine Rate-Limiting-Regel anlegen, siehe README.
const LIMIT_PRO_MINUTE = 10;
const anfragen = new Map();
function zuVieleAnfragen(ip) {
  const jetzt = Date.now();
  const liste = (anfragen.get(ip) || []).filter((t) => jetzt - t < 60000);
  liste.push(jetzt);
  anfragen.set(ip, liste);
  if (anfragen.size > 5000) anfragen.clear();
  return liste.length > LIMIT_PRO_MINUTE;
}

function corsHeaders(origin, zusatz = {}) {
  const erlaubt = ERLAUBTE_URSPRUENGE.includes(origin);
  return {
    "Access-Control-Allow-Origin": erlaubt ? origin : "null",
    Vary: "Origin",
    ...zusatz,
  };
}

async function anthropicProxy(request, env, origin) {
  if (!env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "Kein ANTHROPIC_API_KEY-Secret im Worker hinterlegt." }),
      { status: 500, headers: corsHeaders(origin, { "Content-Type": "application/json" }) }
    );
  }

  // Nur das weiterleiten, was die App wirklich braucht. Sonst koennte jeder
  // (der Origin-Header ist mit curl faelschbar) beliebige Modelle und
  // Token-Mengen auf deine Rechnung abrufen.
  let eingang;
  try {
    eingang = await request.json();
  } catch {
    return new Response("Ungueltiges JSON", { status: 400, headers: corsHeaders(origin) });
  }
  const nachrichten = Array.isArray(eingang?.messages) ? eingang.messages : [];
  const textLaenge =
    String(eingang?.system ?? "").length +
    nachrichten.reduce((n, m) => n + (typeof m?.content === "string" ? m.content.length : 1e9), 0);
  if (
    !nachrichten.length ||
    nachrichten.length > MAX_NACHRICHTEN ||
    textLaenge > MAX_ZEICHEN ||
    nachrichten.some((m) => m?.role !== "user" && m?.role !== "assistant")
  ) {
    return new Response("Anfrage zu gross oder ungueltig", { status: 400, headers: corsHeaders(origin) });
  }
  const body = JSON.stringify({
    model: ERLAUBTE_MODELLE.includes(eingang.model) ? eingang.model : ERLAUBTE_MODELLE[0],
    max_tokens: Math.min(Number(eingang.max_tokens) || MAX_TOKENS, MAX_TOKENS),
    temperature: typeof eingang.temperature === "number" ? eingang.temperature : 0.25,
    system: String(eingang.system ?? ""),
    messages: nachrichten.map((m) => ({ role: m.role, content: m.content })),
  });

  const antwort = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body,
  });

  const headers = new Headers(antwort.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
  return new Response(antwort.body, { status: antwort.status, headers });
}

async function elevenlabsProxy(request, origin) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response("Ungueltiges JSON", { status: 400, headers: corsHeaders(origin) });
  }

  const { apiKey, voiceId, text, modelId, voiceSettings } = payload || {};
  if (!apiKey || !voiceId || !text) {
    return new Response("apiKey, voiceId und text sind erforderlich", {
      status: 400,
      headers: corsHeaders(origin),
    });
  }

  const antwort = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: modelId || "eleven_multilingual_v2",
      voice_settings: voiceSettings || { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  const headers = new Headers();
  for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
  headers.set("Content-Type", antwort.headers.get("Content-Type") || "application/octet-stream");
  return new Response(antwort.body, { status: antwort.status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const { pathname } = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }),
      });
    }

    if (!ERLAUBTE_URSPRUENGE.includes(origin)) {
      return new Response("Nicht erlaubt", { status: 403 });
    }

    if (request.method !== "POST") {
      return new Response("Nur POST erlaubt", { status: 405 });
    }

    if (zuVieleAnfragen(request.headers.get("CF-Connecting-IP") || "unbekannt")) {
      return new Response("Zu viele Anfragen - bitte kurz warten", { status: 429, headers: corsHeaders(origin) });
    }

    if (pathname === "/elevenlabs-tts") {
      return elevenlabsProxy(request, origin);
    }

    return anthropicProxy(request, env, origin);
  },
};
