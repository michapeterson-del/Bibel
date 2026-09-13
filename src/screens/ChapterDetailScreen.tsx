import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { BookMeta } from "../types";
import { getBookByOsis } from "../lib/db/bibleDb";
import { getStilleZeitFuerKapitel, istKapitelGelesen, setKapitelGelesen } from "../lib/db/userDb";
import Header from "../components/Header";

export default function ChapterDetailScreen() {
  const { osis, kapitel } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<BookMeta | null>(null);
  const [gelesen, setGelesen] = useState(false);
  const [anzahlEintraege, setAnzahlEintraege] = useState(0);

  const kapitelNr = kapitel ? parseInt(kapitel, 10) : 0;

  useEffect(() => {
    if (!osis) return;
    getBookByOsis(osis).then((b) => setBook(b ?? null));
    istKapitelGelesen(osis, kapitelNr).then(setGelesen);
    getStilleZeitFuerKapitel(osis, kapitelNr).then((e) => setAnzahlEintraege(e.length));
  }, [osis, kapitelNr]);

  async function toggleGelesen() {
    if (!osis) return;
    const naechste = !gelesen;
    await setKapitelGelesen(osis, kapitelNr, naechste);
    setGelesen(naechste);
  }

  if (!osis || !book) return <p>Lädt…</p>;

  return (
    <div>
      <Header
        title={`${book.name_de} ${kapitelNr}`}
        onBack
        right={
          <button className="chip" onClick={() => navigate(`/stillezeit/kapitel/${osis}/${kapitelNr}`)}>
            📋 Einträge
          </button>
        }
      />

      <div className="card" style={{ marginBottom: 16, textAlign: "center", background: "var(--bibel-bg)", borderColor: "transparent" }}>
        <p style={{ margin: 0, fontWeight: 700, color: "var(--bibel-fg)" }}>
          {gelesen ? "✓ Gelesen" : "Noch nicht gelesen"}
        </p>
        <p style={{ margin: "4px 0 0", color: "var(--bibel-fg)", fontSize: "0.88rem" }}>
          {anzahlEintraege === 0
            ? "Noch keine Stille-Zeit-Einträge zu diesem Kapitel"
            : `${anzahlEintraege} ${anzahlEintraege === 1 ? "Eintrag" : "Einträge"} zu diesem Kapitel`}
        </p>
      </div>

      <button className={gelesen ? "btn" : "btn secondary"} style={{ width: "100%", marginBottom: 10 }} onClick={toggleGelesen}>
        {gelesen ? "Als ungelesen markieren" : "Als gelesen markieren"}
      </button>

      <button
        className="btn secondary"
        style={{ width: "100%", marginBottom: 10 }}
        onClick={() => navigate(`/stillezeit/${osis}/${kapitelNr}`)}
      >
        ✏️ Neuen Eintrag schreiben
      </button>

      <button
        className="btn secondary"
        style={{ width: "100%" }}
        onClick={() => navigate(`/lesen/${osis}/${kapitelNr}`)}
      >
        📖 Kapitel in der App lesen
      </button>
    </div>
  );
}
