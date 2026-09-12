import { useEffect, useState } from "react";
import type { LernVers } from "../types";
import { getBookByOsis, getVerseRange } from "../lib/db/bibleDb";
import { addLernVers, addAktivMinuten, listLernverse, removeLernVers, updateLernVers } from "../lib/db/userDb";
import { useVerseDetail } from "../lib/VerseDetailContext";

function lueckentext(text: string): string {
  const words = text.split(" ");
  return words
    .map((w, i) => {
      const clean = w.replace(/[.,!?;:„"()]/g, "");
      if (clean.length >= 6 && i % 3 === 0) {
        return w.replace(clean, "_".repeat(clean.length));
      }
      return w;
    })
    .join(" ");
}

interface LernVersMitText extends LernVers {
  text: string;
  bookName: string;
}

export default function LearnScreen() {
  const [verse, setVerse] = useState<LernVersMitText[]>([]);
  const [uebeIndex, setUebeIndex] = useState<number | null>(null);
  const [aufgeloest, setAufgeloest] = useState(false);
  const { target } = useVerseDetail();

  async function refresh() {
    const list = await listLernverse();
    const withText: LernVersMitText[] = [];
    for (const v of list) {
      const book = await getBookByOsis(v.osis);
      const rows = await getVerseRange(v.osis, v.kapitel, v.vers, v.vers, v.uebersetzung);
      withText.push({ ...v, text: rows[0]?.text ?? "", bookName: book?.name_de ?? v.osis });
    }
    setVerse(withText);
  }

  useEffect(() => {
    refresh();
  }, []);

  // Wenn im Vers-Detail-Modal geoeffnet: Schnellzugriff zum Hinzufuegen anbieten
  const addFromModal = target
    ? async () => {
        await addLernVers({ osis: target.osis, kapitel: target.chapter, vers: target.verseVon, uebersetzung: "LUT1912" });
        refresh();
      }
    : null;

  const aktuell = uebeIndex !== null ? verse[uebeIndex] : null;

  async function markGewusst() {
    if (!aktuell) return;
    await updateLernVers(aktuell.id, { gewusstCount: aktuell.gewusstCount + 1 });
    await addAktivMinuten(2);
    naechste();
  }

  function naechste() {
    setAufgeloest(false);
    if (uebeIndex === null) return;
    if (uebeIndex + 1 < verse.length) setUebeIndex(uebeIndex + 1);
    else {
      setUebeIndex(null);
      refresh();
    }
  }

  if (uebeIndex !== null && aktuell) {
    return (
      <div>
        <div className="header-bar" style={{ paddingTop: 8 }}>
          <h1 style={{ fontSize: "1.3rem" }}>Jetzt üben</h1>
        </div>
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: 10 }}>
            {aktuell.bookName} {aktuell.kapitel},{aktuell.vers}
          </p>
          <p style={{ fontSize: "1.1rem" }}>{aufgeloest ? aktuell.text : lueckentext(aktuell.text)}</p>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button className="btn" onClick={markGewusst}>Gewusst</button>
          <button className="btn secondary" onClick={() => setAufgeloest(true)}>Auflösen</button>
          <button className="btn secondary" onClick={naechste}>Überspringen</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="header-bar" style={{ paddingTop: 8 }}>
        <h1 style={{ fontSize: "1.3rem" }}>Bibelverse lernen</h1>
      </div>

      {addFromModal && (
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ margin: "0 0 8px" }}>Aktuell geöffneten Vers zur Lern-Kartei hinzufügen?</p>
          <button className="btn" onClick={addFromModal}>🧠 Hinzufügen</button>
        </div>
      )}

      {verse.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          Noch keine Merkverse. Öffne einen Vers in der Bibel und tippe dort auf „Lernen".
        </p>
      )}

      {verse.length > 0 && (
        <button className="btn" style={{ width: "100%", marginBottom: 14 }} onClick={() => setUebeIndex(0)}>
          Jetzt üben ({verse.length})
        </button>
      )}

      {verse.map((v, i) => (
        <div key={v.id} className="card" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>{v.bookName} {v.kapitel},{v.vers}</p>
            <p style={{ margin: "2px 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
              {v.gelernt ? "✓ gelernt" : v.gewusstCount > 0 ? `◐ ${v.gewusstCount}/10 gewusst` : "● neu"}
            </p>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="icon-btn" onClick={() => setUebeIndex(i)}>▶</button>
            <button className="icon-btn" onClick={() => removeLernVers(v.id).then(refresh)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
