import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { BookMeta, StilleZeitEintrag } from "../types";
import { getBookByOsis } from "../lib/db/bibleDb";
import { getStilleZeitFuerKapitel, listStilleZeit } from "../lib/db/userDb";
import Header from "../components/Header";

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function StilleZeitListScreen() {
  const { osis, kapitel } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<BookMeta | null>(null);
  const [eintraege, setEintraege] = useState<StilleZeitEintrag[]>([]);
  const [geladen, setGeladen] = useState(false);

  const kapitelNr = kapitel ? parseInt(kapitel, 10) : undefined;
  const gefiltert = Boolean(osis && kapitelNr);

  useEffect(() => {
    if (osis) getBookByOsis(osis).then((b) => setBook(b ?? null));
  }, [osis]);

  useEffect(() => {
    const laden = gefiltert && osis && kapitelNr ? getStilleZeitFuerKapitel(osis, kapitelNr) : listStilleZeit();
    laden.then((all) => {
      setEintraege(all);
      setGeladen(true);
    });
  }, [osis, kapitelNr, gefiltert]);

  const titel = gefiltert ? `Einträge zu ${book ? book.name_de : "…"} ${kapitelNr}` : "Meine Stille Zeit";

  return (
    <div>
      <Header title={titel} onBack />

      {gefiltert && osis && (
        <button
          className="btn secondary"
          style={{ width: "100%", marginBottom: 16 }}
          onClick={() => navigate(`/stillezeit/${osis}/${kapitelNr}`)}
        >
          ✏️ Neuen Eintrag zu diesem Kapitel schreiben
        </button>
      )}

      {geladen && eintraege.length === 0 && (
        <div className="card">
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            {gefiltert
              ? "Noch keine Einträge zu diesem Kapitel."
              : "Noch keine Einträge. Wenn du ein Kapitel als gelesen markierst, kannst du dort deine Gedanken und Gebete festhalten – sie erscheinen dann hier."}
          </p>
        </div>
      )}

      {eintraege.map((e) => (
        <div
          key={e.id}
          className="card"
          style={{ marginBottom: 8, cursor: "pointer" }}
          onClick={() => navigate(`/stillezeit-eintrag/${e.id}`)}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>
              {e.bookName} {e.kapitel}
            </p>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {formatDatum(e.erstellt_am)}
            </span>
          </div>
          {e.gedanken && (
            <p style={{ margin: "6px 0 0", fontSize: "0.88rem", color: "var(--text-muted)" }}>
              {e.gedanken.length > 110 ? e.gedanken.slice(0, 110) + "…" : e.gedanken}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
