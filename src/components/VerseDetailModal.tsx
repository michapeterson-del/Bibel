import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useVerseDetail } from "../lib/VerseDetailContext";
import type { Farbe, FarbLabels, Translation } from "../types";
import { getVerseRange } from "../lib/db/bibleDb";
import { getFarbLabels, saveLesezeichen } from "../lib/db/userDb";
import { createChat, saveChat } from "../lib/db/userDb";
import TranslationSwitch from "./TranslationSwitch";
import { useSettings } from "../lib/SettingsContext";

const FARBEN: { value: Farbe; hex: string }[] = [
  { value: "gelb", hex: "#EFE5BC" },
  { value: "gruen", hex: "#B2D2C2" },
  { value: "blau", hex: "#ABC6E4" },
  { value: "rosa", hex: "#E6BAC5" },
  { value: "lila", hex: "#D3B4CC" },
];

export default function VerseDetailModal() {
  const { target, close, bumpMarksVersion } = useVerseDetail();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [translation, setTranslation] = useState<Translation>(settings?.standardUebersetzung ?? "LUT1912");
  const [text, setText] = useState<string>("");
  const [zeigeFarbauswahl, setZeigeFarbauswahl] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savedMsg, setSavedMsg] = useState("");
  const [farbLabels, setFarbLabels] = useState<FarbLabels | null>(null);

  useEffect(() => {
    if (!target) return;
    getFarbLabels().then(setFarbLabels);
    setTranslation(settings?.standardUebersetzung ?? "LUT1912");
    setZeigeFarbauswahl(false);
    setShowNote(false);
    setNoteText("");
    setSavedMsg("");
  }, [target, settings?.standardUebersetzung]);

  useEffect(() => {
    if (!target) return;
    getVerseRange(target.osis, target.chapter, target.verseVon, target.verseBis, translation).then((rows) => {
      setText(rows.map((r) => r.text).join(" "));
    });
  }, [target, translation]);

  if (!target) return null;

  const label =
    target.verseVon === target.verseBis
      ? `${target.bookName} ${target.chapter},${target.verseVon}`
      : `${target.bookName} ${target.chapter},${target.verseVon}-${target.verseBis}`;

  const LESEZEICHEN_FARBE: Farbe = "lila";

  async function addLesezeichen() {
    if (!target) return;
    await saveLesezeichen({
      typ: "lesezeichen",
      uebersetzung: translation,
      buch: target.osis,
      kapitel: target.chapter,
      vers_von: target.verseVon,
      vers_bis: target.verseBis,
      farbe: LESEZEICHEN_FARBE,
      tags: [],
    });
    setSavedMsg("Lesezeichen gespeichert.");
    bumpMarksVersion();
  }

  async function addMarkierung(farbe: Farbe) {
    if (!target) return;
    await saveLesezeichen({
      typ: "markierung",
      uebersetzung: translation,
      buch: target.osis,
      kapitel: target.chapter,
      vers_von: target.verseVon,
      vers_bis: target.verseBis,
      farbe,
      tags: [],
    });
    setZeigeFarbauswahl(false);
    setSavedMsg("Markierung gespeichert.");
    bumpMarksVersion();
  }

  async function saveNote() {
    if (!target || !noteText.trim()) return;
    await saveLesezeichen({
      typ: "notiz",
      uebersetzung: translation,
      buch: target.osis,
      kapitel: target.chapter,
      vers_von: target.verseVon,
      vers_bis: target.verseBis,
      farbe: "gelb",
      notiz: noteText.trim(),
      tags: [],
    });
    setShowNote(false);
    setSavedMsg("Notiz gespeichert.");
    bumpMarksVersion();
  }

  async function copyText() {
    await navigator.clipboard.writeText(`${text} (${label}, ${translationLabel(translation)})`);
    setSavedMsg("In Zwischenablage kopiert.");
  }

  async function shareText() {
    const shareData = { title: label, text: `${text} — ${label}` };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* Nutzer hat Teilen abgebrochen */
      }
    } else {
      await copyText();
    }
  }

  async function askInChat() {
    if (!target) return;
    const chat = await createChat("bibel", label);
    const question = `Was bedeutet ${label}?`;
    chat.nachrichten.push({
      id: crypto.randomUUID(),
      rolle: "user",
      text: question,
      erstellt_am: new Date().toISOString(),
    });
    await saveChat(chat);
    close();
    navigate(`/chat/${chat.id}?ask=1&osis=${target.osis}&kapitel=${target.chapter}&von=${target.verseVon}&bis=${target.verseBis}`);
  }

  function readChapter() {
    if (!target) return;
    close();
    navigate(`/lesen/${target.osis}/${target.chapter}`);
  }

  return (
    <div className="modal-overlay" onClick={close}>
      <div className="modal-sheet card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>{label}</h3>
          <button className="icon-btn" onClick={close} aria-label="Schließen">✕</button>
        </div>
        <TranslationSwitch value={translation} onChange={setTranslation} />
        <p style={{ marginTop: 14, fontSize: "1.05rem" }}>{text}</p>

        {savedMsg && <p style={{ color: "var(--salbei-fg)", fontSize: "0.85rem" }}>{savedMsg}</p>}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <button className="chip" onClick={addLesezeichen}>☆ Lesezeichen</button>
          <button
            className={`chip ${zeigeFarbauswahl ? "active" : ""}`}
            onClick={() => setZeigeFarbauswahl((v) => !v)}
          >
            🖍 Markieren
          </button>
          <button className="chip" onClick={() => setShowNote((v) => !v)}>📝 Notiz</button>
          <button className="chip" onClick={shareText}>↗ Teilen</button>
          <button className="chip" onClick={copyText}>📋 Kopieren</button>
          <button className="chip" onClick={readChapter}>📖 Kapitel lesen</button>
          <button className="chip" onClick={askInChat}>💬 Dazu fragen</button>
        </div>

        {zeigeFarbauswahl && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10 }}>
            {FARBEN.map((f) => (
              <div key={f.value} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => addMarkierung(f.value)}
                  aria-label={f.value}
                  title={farbLabels?.[f.value]}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: f.hex,
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                  }}
                />
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{farbLabels?.[f.value]}</span>
              </div>
            ))}
          </div>
        )}

        {showNote && (
          <div style={{ marginTop: 10 }}>
            <textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Deine Notiz…" />
            <button className="btn" style={{ marginTop: 8 }} onClick={saveNote}>Notiz speichern</button>
          </div>
        )}
      </div>
    </div>
  );
}

function translationLabel(t: Translation): string {
  if (t === "SCH1951") return "Schlachter 1951";
  if (t === "MENGE1939") return "Menge 1939";
  return "Luther 1912";
}
