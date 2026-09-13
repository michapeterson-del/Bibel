import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BookMeta } from "../types";
import { getAllBooks, getChapterCountsAllBooks } from "../lib/db/bibleDb";
import { anzahlGeleseneKapitel, getGeleseneKapitel, setKapitelGelesen, type GeleseneKapitel } from "../lib/db/userDb";
import Header from "../components/Header";
import BookPickerModal from "../components/BookPickerModal";

export default function ReadingProgressScreen() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [chapterCounts, setChapterCounts] = useState<Record<string, number>>({});
  const [gelesen, setGelesen] = useState<GeleseneKapitel>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  async function refresh() {
    const [b, c, g] = await Promise.all([getAllBooks(), getChapterCountsAllBooks(), getGeleseneKapitel()]);
    setBooks(b);
    setChapterCounts(c);
    setGelesen(g);
  }

  useEffect(() => {
    refresh();
  }, []);

  const totalChapters = Object.values(chapterCounts).reduce((s, n) => s + n, 0);
  const totalGelesen = anzahlGeleseneKapitel(gelesen);
  const prozent = totalChapters > 0 ? Math.round((totalGelesen / totalChapters) * 100) : 0;

  async function toggleKapitel(osis: string, kapitel: number) {
    const istGelesen = (gelesen[osis] ?? []).includes(kapitel);
    const naechste = await setKapitelGelesen(osis, kapitel, !istGelesen);
    setGelesen(naechste);
    if (!istGelesen) navigate(`/stillezeit/${osis}/${kapitel}`);
  }

  async function kapitelManuellEintragen(osis: string, kapitel: number) {
    setShowPicker(false);
    const naechste = await setKapitelGelesen(osis, kapitel, true);
    setGelesen(naechste);
    navigate(`/stillezeit/${osis}/${kapitel}`);
  }

  function summe(liste: BookMeta[], quelle: Record<string, number> | GeleseneKapitel, laenge: boolean) {
    return liste.reduce((s, b) => {
      const wert = quelle[b.osis];
      return s + (laenge ? (wert as number[] | undefined)?.length ?? 0 : (wert as number | undefined) ?? 0);
    }, 0);
  }

  function renderBuch(b: BookMeta) {
    const anzahlKapitel = chapterCounts[b.osis] ?? 0;
    const geleseneListe = gelesen[b.osis] ?? [];
    const buchProzent = anzahlKapitel > 0 ? Math.round((geleseneListe.length / anzahlKapitel) * 100) : 0;
    const istOffen = expanded === b.osis;
    return (
      <div key={b.osis} className="card" style={{ marginBottom: 8 }}>
        <div
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", gap: 10 }}
          onClick={() => setExpanded(istOffen ? null : b.osis)}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>{b.name_de}</p>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${buchProzent}%`, background: "var(--salbei-fg)" }} />
            </div>
          </div>
          <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {geleseneListe.length}/{anzahlKapitel}
          </span>
          <span>{istOffen ? "▲" : "▼"}</span>
        </div>
        {istOffen && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 6, marginTop: 12 }}>
              {Array.from({ length: anzahlKapitel }, (_, i) => i + 1).map((k) => {
                const gelesenFlag = geleseneListe.includes(k);
                return (
                  <button
                    key={k}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleKapitel(b.osis, k);
                    }}
                    style={{
                      aspectRatio: "1",
                      borderRadius: 6,
                      border: gelesenFlag ? "none" : "1px solid var(--border)",
                      background: gelesenFlag ? "var(--salbei-bg)" : "var(--card)",
                      color: gelesenFlag ? "var(--salbei-fg)" : "var(--text-muted)",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
            <button
              className="chip"
              style={{ marginTop: 10 }}
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/lesen/${b.osis}/1`);
              }}
            >
              📖 Buch lesen
            </button>
          </>
        )}
      </div>
    );
  }

  const at = books.filter((b) => b.testament === "AT");
  const nt = books.filter((b) => b.testament === "NT");

  return (
    <div>
      <Header
        title="Lesefortschritt"
        onBack
        right={
          <button className="chip" onClick={() => navigate("/stillezeit")}>
            📝 Meine Stille Zeit
          </button>
        }
      />

      <div className="card" style={{ marginBottom: 16, textAlign: "center", background: "var(--bibel-bg)", borderColor: "transparent" }}>
        <p style={{ margin: 0, fontSize: "2.2rem", fontWeight: 700, color: "var(--bibel-fg)" }}>{prozent}%</p>
        <p style={{ margin: "4px 0 0", color: "var(--bibel-fg)" }}>
          {totalGelesen} von {totalChapters} Kapiteln gelesen
        </p>
      </div>

      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: -8, marginBottom: 16 }}>
        Tipp: Auf ein Buch tippen öffnet die Kapitelübersicht - einzelne Kapitel lassen sich dort auch
        manuell an-/abhaken.
      </p>

      <button className="btn secondary" style={{ width: "100%", marginBottom: 16 }} onClick={() => setShowPicker(true)}>
        ✓ Kapitel als gelesen eintragen
      </button>

      <h3>Altes Testament ({summe(at, gelesen, true)}/{summe(at, chapterCounts, false)})</h3>
      {at.map(renderBuch)}

      <h3 style={{ marginTop: 20 }}>Neues Testament ({summe(nt, gelesen, true)}/{summe(nt, chapterCounts, false)})</h3>
      {nt.map(renderBuch)}

      {showPicker && (
        <BookPickerModal onClose={() => setShowPicker(false)} onSelect={kapitelManuellEintragen} />
      )}
    </div>
  );
}
