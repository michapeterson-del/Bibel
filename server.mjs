// Eigenständiger Server für Amibel (z. B. Coolify): liefert die gebaute App aus
// dist/ aus und stellt unter /api dieselben Proxy-Funktionen bereit wie der
// Cloudflare-Worker (KI-Chat, Vorlesen, Stimmenliste).
//
// Umgebungsvariablen:
//   ANTHROPIC_API_KEY   für den gemeinsamen KI-Chat
//   ELEVENLABS_API_KEY  optional, gemeinsamer Vorlese-Zugang
//   ALLOWED_ORIGINS     eigene Adresse, z. B. https://bibel.micha-apps.de
//   PORT                Standard: 3000
// Beim Bauen: VITE_PROXY_URL=/api
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import { fileURLToPath } from "node:url";
import worker from "./cloudflare-worker/worker.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "dist");
const PORT = Number(process.env.PORT) || 3000;
const env = {
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
};

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".db": "application/octet-stream",
  ".txt": "text/plain; charset=utf-8",
};

async function handleApi(req, res, pathname) {
  // /api → "/", /api/elevenlabs-tts → "/elevenlabs-tts" (wie beim Worker)
  const workerPath = pathname.replace(/^\/api/, "") || "/";
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
  }
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  headers.set("CF-Connecting-IP", ip);

  const request = new Request(new URL(workerPath, "http://localhost"), {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
  const response = await worker.fetch(request, env);
  const out = {};
  response.headers.forEach((value, key) => {
    if (key !== "content-encoding" && key !== "content-length" && key !== "transfer-encoding") out[key] = value;
  });
  res.writeHead(response.status, out);
  if (response.body) Readable.fromWeb(response.body).pipe(res);
  else res.end();
}

async function serveFile(req, res, pathname) {
  let file = path.normalize(path.join(ROOT, decodeURIComponent(pathname)));
  if (!file.startsWith(ROOT)) {
    res.writeHead(400);
    return res.end();
  }
  let info = await stat(file).catch(() => null);
  if (info?.isDirectory()) {
    file = path.join(file, "index.html");
    info = await stat(file).catch(() => null);
  }
  // Unbekannte Pfade → App (Single-Page-App mit eigenem Routing)
  if (!info) {
    file = path.join(ROOT, "index.html");
  }
  const ext = path.extname(file);
  const data = await readFile(file);
  const cache =
    ext === ".html" || path.basename(file) === "sw.js" ? "no-cache" : pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "public, max-age=3600";
  res.writeHead(200, {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  });
  res.end(req.method === "HEAD" ? undefined : data);
}

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, "http://localhost");
    if (pathname === "/api" || pathname.startsWith("/api/")) return await handleApi(req, res, pathname);
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      return res.end();
    }
    await serveFile(req, res, pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end();
  }
}).listen(PORT, () => console.log(`Amibel läuft auf Port ${PORT}`));
