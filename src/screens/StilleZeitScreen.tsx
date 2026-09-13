import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { BookMeta } from "../types";
import { getBookByOsis } from "../lib/db/bibleDb";
import { saveStilleZeit } from "../lib/db/userDb";
import Header from "../components/Header";

const ICH_SUCHE = [
  { titel: "Wahrheiten über Gott", zweck: "um ihn kennenzulernen" },
  { titel: "Wesenszüge Jesu", zweck: "um sie nachzuahmen" },
  { titel: "Vorbilder", zweck: "um ihnen zu folgen" },
  { titel: "Verheißungen", zweck: "um sie in Anspruch zu nehmen" },
  { titel: "Warnungen", zweck: "um sie zu beachten" },
  { titel: "Sünden", zweck: "um sie zu lassen" },
  { titel: "Befehle", zweck: "um sie auszuführen" },
];

function Feld({
  label,
  value,
  onChange,
  rows = 2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.92rem" }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        style={{ width: "100%", resize: "vertical" }}
      />
    </div>
  );
}

export default function StilleZeitScreen() {
  const { osis, kapitel } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<BookMeta | null>(null);

  const [betenUm, setBetenUm] = useState("");
  const [gedanken, setGedanken] = useState("");
  const [dank, setDank] = useState("");
  const [suenden, setSuenden] = useState("");
  const [sorgen, setSorgen] = useState("");
  const [personen, setPersonen] = useState("");
  const [anliegen, setAnliegen] = useState("");
  const [handeln, setHandeln] = useState("");

  useEffect(() => {
    if (osis) getBookByOsis(osis).then((b) => setBook(b ?? null));
  }, [osis]);

  const kapitelNr = kapitel ? parseInt(kapitel, 10) : 0;
  const kannSpeichern = gedanken.trim().length > 0;

  async function speichern() {
    if (!osis || !book) return;
    await saveStilleZeit({
      osis,
      bookName: book.name_de,
      kapitel: kapitelNr,
      betenUm,
      gedanken,
      dank,
      suenden,
      sorgen,
      personen,
      anliegen,
      handeln,
    });
    navigate(-1);
  }

  return (
    <div>
      <Header title="Stille Zeit" onBack />

      <div className="card" style={{ marginBottom: 16, background: "var(--bibel-bg)", borderColor: "transparent" }}>
        <p style={{ margin: 0, fontWeight: 700, color: "var(--bibel-fg)" }}>Meine Verabredung mit Gott</p>
        <p style={{ margin: "4px 0 0", color: "var(--bibel-fg)" }}>
          Gelesener Text: {book ? book.name_de : "…"} {kapitelNr}
        </p>
      </div>

      <div className="card">
        <Feld label="Ich bete um:" value={betenUm} onChange={setBetenUm} />

        <label style={{ display: "block", fontWeight: 600, marginBottom: 6, fontSize: "0.92rem" }}>
          Mir sind im Text folgende Gedanken wichtig:
        </label>
        <div className="card" style={{ background: "var(--card-muted, var(--bg))", marginBottom: 8 }}>
          <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: "0.85rem" }}>Ich suche:</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ICH_SUCHE.map((s) => (
              <span
                key={s.titel}
                title={s.zweck}
                style={{
                  fontSize: "0.78rem",
                  padding: "3px 8px",
                  borderRadius: 12,
                  background: "var(--border)",
                  color: "var(--text-muted)",
                }}
              >
                {s.titel}
              </span>
            ))}
          </div>
        </div>
        <textarea
          value={gedanken}
          onChange={(e) => setGedanken(e.target.value)}
          rows={5}
          placeholder="Was ist dir beim Lesen aufgefallen?"
          style={{ width: "100%", resize: "vertical", marginBottom: 14 }}
        />

        <Feld label="Ich danke Gott für:" value={dank} onChange={setDank} />
        <Feld label="Ich bekenne Gott folgende Sünden:" value={suenden} onChange={setSuenden} />
        <Feld label="Ich bringe folgende Sorgen vor Gott:" value={sorgen} onChange={setSorgen} />
        <Feld label="Ich bitte für folgende Personen:" value={personen} onChange={setPersonen} />
        <Feld label="Ich bitte Gott um meine persönlichen Anliegen:" value={anliegen} onChange={setAnliegen} />
        <Feld label="Ich will in Zukunft folgendes tun/ändern:" value={handeln} onChange={setHandeln} />
      </div>

      <button className="btn" style={{ width: "100%", marginTop: 14 }} onClick={speichern} disabled={!kannSpeichern}>
        Speichern
      </button>
      {!kannSpeichern && (
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", marginTop: 6 }}>
          Trag mindestens einen Gedanken zum Text ein, um zu speichern.
        </p>
      )}
    </div>
  );
}
