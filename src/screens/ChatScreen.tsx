import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { ChatGespraech, ChatMessage } from "../types";
import { getChat, kvGet, saveChat } from "../lib/db/userDb";
import { useSettings } from "../lib/SettingsContext";
import { askAmibel } from "../lib/ai/provider";
import { decryptSecret } from "../lib/crypto";
import { buildVersKontext } from "../lib/ai/versKontext";
import { getBookByOsis } from "../lib/db/bibleDb";
import AnswerCard from "../components/AnswerCard";
import Header from "../components/Header";

export default function ChatScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings, update } = useSettings();
  const [chat, setChat] = useState<ChatGespraech | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const autoAskDone = useRef(false);

  useEffect(() => {
    if (!id) return;
    getChat(id).then((c) => c && setChat(c));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat?.nachrichten.length, busy]);

  useEffect(() => {
    if (!chat || !settings || autoAskDone.current) return;
    const ask = searchParams.get("ask");
    const last = chat.nachrichten.at(-1);
    if (ask === "1" && last && last.rolle === "user") {
      autoAskDone.current = true;
      const osis = searchParams.get("osis");
      const kapitel = searchParams.get("kapitel");
      const von = searchParams.get("von");
      const bis = searchParams.get("bis");
      setSearchParams({}, { replace: true });
      if (osis && kapitel && von && bis) {
        (async () => {
          const book = await getBookByOsis(osis);
          const versKontext = book
            ? await buildVersKontext(osis, book.name_de, parseInt(kapitel), parseInt(von), parseInt(bis))
            : undefined;
          await sendToAi(chat, last.text, versKontext);
        })();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat, settings]);

  if (!chat || !settings) return <p>Lädt…</p>;

  async function persist(updated: ChatGespraech) {
    setChat(updated);
    await saveChat(updated);
  }

  async function sendToAi(current: ChatGespraech, frage: string, versKontext?: string) {
    if (!settings) return;
    setError("");
    if (settings.aiProvider === "aus") {
      setError("Kein KI-Anbieter eingerichtet. Öffne Einstellungen → KI, um einen Anbieter und API-Schlüssel einzutragen.");
      return;
    }
    setBusy(true);
    try {
      let apiKey = "";
      if (settings.aiProvider !== "gemeinsam") {
        const apiKeyEnc = await kvGet<string>(`api_key_${settings.aiProvider}`);
        apiKey = apiKeyEnc ? await decryptSecret(apiKeyEnc) : "";
        if (!apiKey) {
          setError("Kein API-Schlüssel für diesen Anbieter hinterlegt. Öffne Einstellungen → KI.");
          setBusy(false);
          return;
        }
      }
      const antwort = await askAmibel(
        { provider: settings.aiProvider, apiKey, model: settings.aiModell || undefined },
        {
          frage,
          modus: current.modus,
          klarheitsstufe: settings.klarheitsstufe,
          verlauf: current.nachrichten,
          versKontext,
          konfessionelleVarianten: settings.konfessionelleVarianten,
        }
      );
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        rolle: "assistant",
        text: antwort.kurzantwort,
        antwort,
        erstellt_am: new Date().toISOString(),
      };
      await persist({ ...current, nachrichten: [...current.nachrichten, assistantMsg] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler bei der KI-Anfrage.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || !chat) return;
    setInput("");
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      rolle: "user",
      text,
      erstellt_am: new Date().toISOString(),
    };
    const updated = { ...chat, nachrichten: [...chat.nachrichten, userMsg] };
    await persist(updated);
    await sendToAi(updated, text);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header
        title={chat.titel}
        onBack
        right={
          <select
            value={settings.klarheitsstufe}
            onChange={(e) => update({ klarheitsstufe: e.target.value as typeof settings.klarheitsstufe })}
            style={{ width: "auto", fontSize: "0.75rem" }}
          >
            <option value="kurz">kurz</option>
            <option value="normal">normal</option>
            <option value="ausfuehrlich">ausführlich</option>
          </select>
        }
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "8px 2px" }}>
        {chat.nachrichten.length === 0 && (
          <p style={{ color: "var(--text-muted)" }}>
            {chat.modus === "alltag"
              ? "Was beschäftigt dich? Ich höre zu."
              : "Frag nach einem Vers, einem Thema oder einer Lebensfrage – ich antworte anhand der Bibel."}
          </p>
        )}
        {chat.nachrichten.map((m) =>
          m.rolle === "user" ? (
            <div key={m.id} className="msg user">{m.text}</div>
          ) : m.antwort ? (
            <AnswerCard key={m.id} antwort={m.antwort} />
          ) : (
            <div key={m.id} className="msg assistant">{m.text}</div>
          )
        )}
        {busy && <div className="msg assistant">Amibel denkt nach…</div>}
        {error && (
          <div className="card" style={{ background: "var(--lila-bg)", color: "var(--lila-fg)", marginBottom: 10 }}>
            {error}
            {error.includes("Einstellungen") && (
              <div style={{ marginTop: 8 }}>
                <button className="btn secondary" onClick={() => navigate("/einstellungen")}>Zu den Einstellungen</button>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: "8px 2px", position: "sticky", bottom: 0, background: "var(--bg)" }}>
        <input
          type="text"
          placeholder="Schreib deine Frage…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={busy}
        />
        <button className="btn send" onClick={handleSend} disabled={busy || !input.trim()}>➤</button>
      </div>
    </div>
  );
}
