import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "../lib/SettingsContext";
import type { AiProvider } from "../types";
import { decryptSecret, encryptSecret, maskSecret } from "../lib/crypto";
import { clearAllChats, clearFeedback, kvGet, kvSet, listFeedback, resetStreak } from "../lib/db/userDb";
import { testConnection } from "../lib/ai/provider";
import { listVoices, type ElevenLabsVoice } from "../lib/tts/elevenlabs";

const PROVIDER_LABEL: Record<AiProvider, string> = {
  gemeinsam: "Gemeinsam (kein eigener Schlüssel nötig)",
  anthropic: "Claude (Anthropic) - eigener Schlüssel",
  openai: "OpenAI (ChatGPT) - eigener Schlüssel",
  gemini: "Google Gemini - eigener Schlüssel",
  deepseek: "DeepSeek - eigener Schlüssel",
  aus: "Aus",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
      <span>{label}</span>
      <div style={{ minWidth: 140, textAlign: "right" }}>{children}</div>
    </div>
  );
}

export default function SettingsScreen() {
  const { settings, update } = useSettings();
  const navigate = useNavigate();
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savedKeyMasked, setSavedKeyMasked] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [dataMsg, setDataMsg] = useState("");
  const [elevenlabsKeyInput, setElevenlabsKeyInput] = useState("");
  const [elevenlabsSavedKeyMasked, setElevenlabsSavedKeyMasked] = useState("");
  const [elevenlabsVoices, setElevenlabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [elevenlabsLadeVoices, setElevenlabsLadeVoices] = useState(false);
  const [elevenlabsMsg, setElevenlabsMsg] = useState("");
  const [updateMsg, setUpdateMsg] = useState("");

  useEffect(() => {
    listFeedback().then((f) => setFeedbackCount(f.length));
    kvGet<string>("api_key_elevenlabs").then(async (enc) => {
      if (!enc) return;
      const plain = await decryptSecret(enc);
      setElevenlabsSavedKeyMasked(maskSecret(plain));
    });
  }, []);

  useEffect(() => {
    if (!settings || settings.aiProvider === "aus") {
      setSavedKeyMasked("");
      return;
    }
    kvGet<string>(`api_key_${settings.aiProvider}`).then(async (enc) => {
      if (!enc) return setSavedKeyMasked("");
      const plain = await decryptSecret(enc);
      setSavedKeyMasked(maskSecret(plain));
    });
  }, [settings?.aiProvider]);

  if (!settings) return <p>Lädt…</p>;

  async function saveApiKey() {
    if (!apiKeyInput.trim() || settings!.aiProvider === "aus") return;
    const enc = await encryptSecret(apiKeyInput.trim());
    await kvSet(`api_key_${settings!.aiProvider}`, enc);
    setSavedKeyMasked(maskSecret(apiKeyInput.trim()));
    setApiKeyInput("");
    setTestMsg("Gespeichert.");
  }

  async function handleTest() {
    if (settings!.aiProvider === "aus") return;
    setTesting(true);
    setTestMsg("");
    const enc = await kvGet<string>(`api_key_${settings!.aiProvider}`);
    const apiKey = enc ? await decryptSecret(enc) : apiKeyInput.trim();
    const result = await testConnection({ provider: settings!.aiProvider, apiKey, model: settings!.aiModell || undefined });
    setTestMsg(result.message);
    setTesting(false);
  }

  async function appAktualisieren() {
    setUpdateMsg("Aktualisiere…");
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      setUpdateMsg("Fertig - lädt neu…");
      window.location.reload();
    } catch (e) {
      setUpdateMsg(
        "Aktualisieren fehlgeschlagen: " + (e instanceof Error ? e.message : "unbekannter Fehler")
      );
    }
  }

  async function saveElevenlabsKey() {
    if (!elevenlabsKeyInput.trim()) return;
    const enc = await encryptSecret(elevenlabsKeyInput.trim());
    await kvSet("api_key_elevenlabs", enc);
    setElevenlabsSavedKeyMasked(maskSecret(elevenlabsKeyInput.trim()));
    setElevenlabsKeyInput("");
    setElevenlabsMsg("Gespeichert.");
  }

  async function elevenlabsStimmenLaden() {
    setElevenlabsLadeVoices(true);
    setElevenlabsMsg("");
    try {
      const enc = await kvGet<string>("api_key_elevenlabs");
      const apiKey = enc ? await decryptSecret(enc) : elevenlabsKeyInput.trim();
      if (!apiKey) {
        setElevenlabsMsg("Bitte zuerst einen API-Schlüssel speichern.");
        return;
      }
      const voices = await listVoices(apiKey);
      setElevenlabsVoices(voices);
      if (voices.length === 0) setElevenlabsMsg("Keine Stimmen gefunden.");
    } catch (e) {
      setElevenlabsMsg(e instanceof Error ? e.message : "Stimmen konnten nicht geladen werden.");
    } finally {
      setElevenlabsLadeVoices(false);
    }
  }

  return (
    <div>
      <div className="header-bar" style={{ paddingTop: 8 }}>
        <h1 style={{ fontSize: "1.3rem" }}>Einstellungen</h1>
      </div>

      <Section title="Profil">
        <Row label="Name">
          <input
            type="text"
            value={settings.profilName}
            onChange={(e) => update({ profilName: e.target.value })}
            style={{ textAlign: "right" }}
          />
        </Row>
        <Row label="Handynummer">
          <input
            type="text"
            value={settings.profilTelefon}
            onChange={(e) => update({ profilTelefon: e.target.value })}
            style={{ textAlign: "right" }}
          />
        </Row>
      </Section>

      <Section title="Darstellung">
        <Row label="Dunkles Design">
          <select value={settings.darkMode} onChange={(e) => update({ darkMode: e.target.value as typeof settings.darkMode })}>
            <option value="system">System</option>
            <option value="hell">Hell</option>
            <option value="dunkel">Dunkel</option>
          </select>
        </Row>
        <Row label="Schriftgröße">
          <select value={settings.schriftgroesse} onChange={(e) => update({ schriftgroesse: e.target.value as typeof settings.schriftgroesse })}>
            <option value="klein">Klein</option>
            <option value="normal">Normal</option>
            <option value="gross">Groß</option>
          </select>
        </Row>
        <Row label="Zeilenabstand">
          <select value={settings.zeilenabstand} onChange={(e) => update({ zeilenabstand: e.target.value as typeof settings.zeilenabstand })}>
            <option value="eng">Eng</option>
            <option value="normal">Normal</option>
            <option value="locker">Locker</option>
          </select>
        </Row>
      </Section>

      <Section title="KI">
        <Row label="Anbieter">
          <select value={settings.aiProvider} onChange={(e) => update({ aiProvider: e.target.value as AiProvider })}>
            {(Object.keys(PROVIDER_LABEL) as AiProvider[]).map((p) => (
              <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>
            ))}
          </select>
        </Row>
        {settings.aiProvider === "gemeinsam" && (
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
            Der Chat läuft über einen von der Betreiberin/dem Betreiber bereitgestellten Zugang.
            Du musst keinen eigenen API-Schlüssel eintragen.
          </p>
        )}
        {settings.aiProvider !== "aus" && settings.aiProvider !== "gemeinsam" && (
          <>
            <Row label="API-Schlüssel">
              <span style={{ fontFamily: "monospace" }}>{savedKeyMasked || "– kein Schlüssel –"}</span>
            </Row>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="password"
                placeholder="Neuen API-Schlüssel eingeben…"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
              <button className="btn secondary" onClick={saveApiKey}>Speichern</button>
            </div>
            <Row label="Modell (leer = Standard)">
              <input
                type="text"
                value={settings.aiModell}
                onChange={(e) => update({ aiModell: e.target.value })}
                style={{ textAlign: "right" }}
              />
            </Row>
            <button className="btn secondary" onClick={handleTest} disabled={testing}>
              {testing ? "Teste…" : "Verbindung testen"}
            </button>
            {testMsg && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{testMsg}</p>}
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              Der Schlüssel wird lokal verschlüsselt gespeichert und nur direkt an den gewählten Anbieter
              gesendet – nie im Klartext angezeigt.
            </p>
          </>
        )}
      </Section>

      <Section title="Antworten">
        <Row label="Klarheitsstufe">
          <select value={settings.klarheitsstufe} onChange={(e) => update({ klarheitsstufe: e.target.value as typeof settings.klarheitsstufe })}>
            <option value="kurz">Kurz</option>
            <option value="normal">Normal</option>
            <option value="ausfuehrlich">Ausführlich</option>
          </select>
        </Row>
        <Row label="Konfessionelle Auslegungsvarianten">
          <input type="checkbox" checked={settings.konfessionelleVarianten} onChange={(e) => update({ konfessionelleVarianten: e.target.checked })} />
        </Row>
      </Section>

      <Section title="Lesen">
        <Row label="Standard-Übersetzung">
          <select value={settings.standardUebersetzung} onChange={(e) => update({ standardUebersetzung: e.target.value as typeof settings.standardUebersetzung })}>
            <option value="LUT1912">Luther 1912</option>
            <option value="SCH1951">Schlachter 1951</option>
            <option value="MENGE1939">Menge 1939</option>
          </select>
        </Row>
        <Row label="Versnummern anzeigen">
          <input type="checkbox" checked={settings.versnummernAn} onChange={(e) => update({ versnummernAn: e.target.checked })} />
        </Row>
      </Section>

      <Section title="Vorlesen (ElevenLabs)">
        <Row label="API-Schlüssel">
          <span style={{ fontFamily: "monospace" }}>{elevenlabsSavedKeyMasked || "– kein Schlüssel –"}</span>
        </Row>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="password"
            placeholder="ElevenLabs API-Schlüssel eingeben…"
            value={elevenlabsKeyInput}
            onChange={(e) => setElevenlabsKeyInput(e.target.value)}
          />
          <button className="btn secondary" onClick={saveElevenlabsKey}>Speichern</button>
        </div>
        <button className="btn secondary" onClick={elevenlabsStimmenLaden} disabled={elevenlabsLadeVoices}>
          {elevenlabsLadeVoices ? "Lädt…" : "Stimmen laden"}
        </button>
        {elevenlabsVoices.length > 0 && (
          <Row label="Stimme">
            <select
              value={settings.elevenlabsVoiceId}
              onChange={(e) => {
                const voice = elevenlabsVoices.find((v) => v.voice_id === e.target.value);
                update({ elevenlabsVoiceId: e.target.value, elevenlabsVoiceName: voice?.name ?? "" });
              }}
            >
              <option value="">– wählen –</option>
              {elevenlabsVoices.map((v) => (
                <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
              ))}
            </select>
          </Row>
        )}
        {!elevenlabsVoices.length && settings.elevenlabsVoiceName && (
          <Row label="Gewählte Stimme">
            <span>{settings.elevenlabsVoiceName}</span>
          </Row>
        )}
        {elevenlabsMsg && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{elevenlabsMsg}</p>}
        <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
          Mit einem eigenen ElevenLabs-Konto kannst du dir Bibelkapitel beim Lesen mit einer natürlichen
          Stimme vorlesen lassen. Der Schlüssel wird lokal verschlüsselt gespeichert und nur direkt an
          ElevenLabs gesendet.
        </p>
      </Section>

      <Section title="Serie & Erinnerungen">
        <Row label="Serie (Streak)">
          <input type="checkbox" checked={settings.streakAn} onChange={(e) => update({ streakAn: e.target.checked })} />
        </Row>
        <Row label="Freeze-Schutz">
          <input type="checkbox" checked={settings.streakFreezeAn} onChange={(e) => update({ streakFreezeAn: e.target.checked })} />
        </Row>
        <Row label="Tageserinnerung">
          <input type="checkbox" checked={settings.tagesErinnerungAn} onChange={(e) => update({ tagesErinnerungAn: e.target.checked })} />
        </Row>
        {settings.tagesErinnerungAn && (
          <Row label="Uhrzeit">
            <input type="time" value={settings.tagesErinnerungZeit} onChange={(e) => update({ tagesErinnerungZeit: e.target.value })} />
          </Row>
        )}
        <Row label="Lern-Erinnerung">
          <input type="checkbox" checked={settings.lernErinnerungAn} onChange={(e) => update({ lernErinnerungAn: e.target.checked })} />
        </Row>
        {settings.lernErinnerungAn && (
          <Row label="Uhrzeit">
            <input type="time" value={settings.lernErinnerungZeit} onChange={(e) => update({ lernErinnerungZeit: e.target.value })} />
          </Row>
        )}
      </Section>

      <Section title="Daten">
        <button className="btn secondary" onClick={() => navigate("/lesezeichen")}>Lesezeichen verwalten</button>
        <button className="btn secondary" onClick={() => navigate("/markierungen")}>🖍 Meine Markierungen</button>
        <button
          className="btn secondary"
          onClick={async () => {
            if (confirm("Gesamten Gesprächsverlauf löschen?")) {
              await clearAllChats();
              setDataMsg("Gesprächsverlauf gelöscht.");
            }
          }}
        >
          Gesprächsverlauf löschen
        </button>
        <button
          className="btn secondary"
          onClick={async () => {
            if (confirm("Streak zurücksetzen?")) {
              await resetStreak();
              setDataMsg("Streak zurückgesetzt.");
            }
          }}
        >
          Streak zurücksetzen
        </button>
        <Row label={`Antwort-Feedback (${feedbackCount})`}>
          <button
            className="btn secondary"
            onClick={async () => {
              await clearFeedback();
              setFeedbackCount(0);
              setDataMsg("Feedback gelöscht.");
            }}
          >
            Löschen
          </button>
        </Row>
        {dataMsg && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{dataMsg}</p>}
      </Section>

      <Section title="App">
        <button className="btn secondary" onClick={appAktualisieren}>🔄 App aktualisieren</button>
        <p style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
          Holt eine frische Version der App, falls sich Funktionen komisch verhalten oder ein Update
          nicht ankommt. Deine Lesezeichen, Notizen, Fortschritt usw. bleiben dabei erhalten - hier
          wird nur der zwischengespeicherte App-Programmcode erneuert, nicht deine Daten.
        </p>
        {updateMsg && <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{updateMsg}</p>}
      </Section>

      <Section title="Über">
        <button className="btn secondary" onClick={() => navigate("/ueber")}>Version, Quellen & Lizenzen</button>
      </Section>
    </div>
  );
}
