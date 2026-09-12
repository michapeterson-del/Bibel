/**
 * Amibel KI-Proxy (Cloudflare Worker)
 *
 * Zweck: versteckt den echten Anthropic-API-Schlüssel vor dem Browser.
 * Der Schlüssel liegt NUR hier als verschlüsseltes Worker-Secret
 * (ANTHROPIC_API_KEY) - niemals im App-Code, niemals im Browser sichtbar.
 *
 * Die App schickt ihre Chat-Anfrage an diesen Worker, der Worker haengt den
 * echten Schluessel an und leitet die Anfrage an api.anthropic.com weiter.
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

function mitCors(response, origin) {
  const erlaubt = ERLAUBTE_URSPRUENGE.includes(origin);
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", erlaubt ? origin : "null");
  headers.set("Vary", "Origin");
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      const erlaubt = ERLAUBTE_URSPRUENGE.includes(origin);
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": erlaubt ? origin : "null",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          Vary: "Origin",
        },
      });
    }

    if (!ERLAUBTE_URSPRUENGE.includes(origin)) {
      return new Response("Nicht erlaubt", { status: 403 });
    }

    if (request.method !== "POST") {
      return new Response("Nur POST erlaubt", { status: 405 });
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Kein ANTHROPIC_API_KEY-Secret im Worker hinterlegt." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.text();

    const antwort = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body,
    });

    return mitCors(antwort, origin);
  },
};
