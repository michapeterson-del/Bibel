// Amibel-Server fuer Coolify (Hetzner): liefert den Vite-Produktionsbuild aus
// `dist/` aus und uebernimmt zugleich den Proxy unter "/api", der vorher ein
// separater Cloudflare Worker war (siehe fruehere cloudflare-worker/README.md
// in der Git-Historie). Zwei Aufgaben:
//
// 1. POST /api             - KI-Chat-Proxy: versteckt den echten
//    ANTHROPIC_API_KEY vor dem Browser (fuer den "Gemeinsam"-KI-Modus).
// 2. POST /api/elevenlabs-tts, POST /api/elevenlabs-voices - Vorlese-Proxy:
//    ElevenLabs erlaubt keine direkten Audio-Anfragen aus dem Browser (CORS).
//    Eigener Schluessel des Nutzers hat Vorrang; ohne eigenen Schluessel wird
//    auf den hier als Umgebungsvariable hinterlegten ELEVENLABS_API_KEY
//    zurueckgegriffen (gemeinsamer Zugang fuer alle Besucher).
//
// Beide Schluessel kommen ausschliesslich aus Umgebungsvariablen (in Coolify
// gepflegt), niemals aus dem Code oder einer .env-Datei im Repo.
//
// Läuft hinter einem Reverse-Proxy (Traefik) mit HTTPS - dieser Server selbst
// spricht nur HTTP auf process.env.PORT.

import http from "node:http";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "dist");
const PORT = process.env.PORT || 3000;

// Nur Anfragen von diesen Ursprüngen bekommen eine lesbare CORS-Antwort -
// verhindert, dass andere Webseiten den gemeinsamen Zugang über ihre eigene
// Browser-JS fremdnutzen. Ersetzt KEINE echte Absicherung (ein curl-Aufruf
// kann den Origin-Header faelschen), haelt aber beilaeufigen Missbrauch ab.
const ERLAUBTE_URSPRUENGE = [
  "https://bibel.micha-apps.de",
  "http://localhost:5173",
];

const ERLAUBTE_MODELLE = ["claude-sonnet-5"];
const MAX_TOKENS = 2400;
const MAX_NACHRICHTEN = 40;
const MAX_ZEICHEN = 60000;

// Einfaches Tempolimit pro IP (pro Serverprozess).
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

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length) return fwd.split(",")[0].trim();
  return req.socket.remoteAddress || "unbekannt";
}

function corsHeaders(origin) {
  const erlaubt = ERLAUBTE_URSPRUENGE.includes(origin);
  return {
    "Access-Control-Allow-Origin": erlaubt ? origin : "null",
    Vary: "Origin",
  };
}

async function leseJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendeJson(res, status, headers, daten) {
  res.writeHead(status, { ...headers, "Content-Type": "application/json" });
  res.end(JSON.stringify(daten));
}

async function anthropicProxy(req, res, origin) {
  if (!process.env.ANTHROPIC_API_KEY) {
    sendeJson(res, 500, corsHeaders(origin), { error: "Kein ANTHROPIC_API_KEY gesetzt (Coolify-Umgebungsvariable)." });
    return;
  }

  let eingang;
  try {
    eingang = await leseJson(req);
  } catch {
    res.writeHead(400, corsHeaders(origin));
    res.end("Ungueltiges JSON");
    return;
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
    res.writeHead(400, corsHeaders(origin));
    res.end("Anfrage zu gross oder ungueltig");
    return;
  }

  const body = JSON.stringify({
    model: ERLAUBTE_MODELLE.includes(eingang.model) ? eingang.model : ERLAUBTE_MODELLE[0],
    max_tokens: Math.min(Number(eingang.max_tokens) || MAX_TOKENS, MAX_TOKENS),
    // Kein "temperature" mitschicken - Anthropic lehnt das fuer neuere Modelle
    // wie claude-sonnet-5 als "deprecated for this model" ab.
    system: String(eingang.system ?? ""),
    messages: nachrichten.map((m) => ({ role: m.role, content: m.content })),
  });

  const antwort = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body,
  });
  res.writeHead(antwort.status, {
    ...corsHeaders(origin),
    "Content-Type": antwort.headers.get("content-type") || "application/json",
  });
  res.end(Buffer.from(await antwort.arrayBuffer()));
}

async function elevenlabsProxy(req, res, origin) {
  let payload;
  try {
    payload = await leseJson(req);
  } catch {
    res.writeHead(400, corsHeaders(origin));
    res.end("Ungueltiges JSON");
    return;
  }

  const { voiceId, text, modelId, voiceSettings } = payload || {};
  // Eigener Schluessel des Nutzers hat Vorrang; ohne eigenen Schluessel auf
  // den gemeinsamen, hier als Umgebungsvariable hinterlegten Zugang zurueckfallen.
  const apiKey = payload?.apiKey || process.env.ELEVENLABS_API_KEY;
  if (!apiKey || !voiceId || !text) {
    res.writeHead(400, corsHeaders(origin));
    res.end("apiKey (oder gemeinsamer Zugang), voiceId und text sind erforderlich");
    return;
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
  res.writeHead(antwort.status, {
    ...corsHeaders(origin),
    "Content-Type": antwort.headers.get("content-type") || "application/octet-stream",
  });
  res.end(Buffer.from(await antwort.arrayBuffer()));
}

async function elevenlabsVoicesProxy(req, res, origin) {
  if (!process.env.ELEVENLABS_API_KEY) {
    sendeJson(res, 500, corsHeaders(origin), { error: "Kein ELEVENLABS_API_KEY gesetzt (Coolify-Umgebungsvariable)." });
    return;
  }
  const antwort = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY },
  });
  res.writeHead(antwort.status, {
    ...corsHeaders(origin),
    "Content-Type": antwort.headers.get("content-type") || "application/json",
  });
  res.end(Buffer.from(await antwort.arrayBuffer()));
}

const MIME_TYPEN = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".db": "application/octet-stream",
};

async function sendeStatisch(req, res, pathname) {
  // HashRouter: nur "/" muss auf index.html fallen, alles andere ist ein
  // echter Dateipfad unter dist/ oder existiert nicht.
  const relativ = pathname === "/" ? "/index.html" : pathname;
  const dateipfad = path.normalize(path.join(DIST_DIR, relativ));
  if (!dateipfad.startsWith(DIST_DIR)) {
    res.writeHead(400);
    res.end("Ungueltiger Pfad");
    return;
  }
  try {
    const info = await stat(dateipfad);
    if (!info.isFile()) throw new Error("kein File");
    const ext = path.extname(dateipfad).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPEN[ext] || "application/octet-stream",
      "Content-Length": info.size,
    });
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(dateipfad).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Nicht gefunden");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const { pathname } = url;
    const origin = req.headers.origin || "";

    if (pathname === "/api" || pathname.startsWith("/api/")) {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          ...corsHeaders(origin),
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        });
        res.end();
        return;
      }
      if (req.method !== "POST") {
        res.writeHead(405, corsHeaders(origin));
        res.end("Nur POST erlaubt");
        return;
      }
      if (zuVieleAnfragen(clientIp(req))) {
        res.writeHead(429, corsHeaders(origin));
        res.end("Zu viele Anfragen - bitte kurz warten");
        return;
      }
      if (pathname === "/api/elevenlabs-tts") return await elevenlabsProxy(req, res, origin);
      if (pathname === "/api/elevenlabs-voices") return await elevenlabsVoicesProxy(req, res, origin);
      if (pathname === "/api") return await anthropicProxy(req, res, origin);
      res.writeHead(404, corsHeaders(origin));
      res.end("Nicht gefunden");
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end("Methode nicht erlaubt");
      return;
    }
    await sendeStatisch(req, res, pathname);
  } catch (err) {
    console.error("Serverfehler:", err);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end("Serverfehler");
    }
  }
});

server.listen(PORT, () => {
  console.log(`Amibel-Server laeuft auf Port ${PORT}`);
});
