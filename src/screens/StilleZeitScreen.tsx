import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { BookMeta } from "../types";
import { getBookByOsis } from "../lib/db/bibleDb";
import { deleteStilleZeit, getStilleZeit, saveStilleZeit, updateStilleZeit } from "../lib/db/userDb";
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
  const { osis: osisParam, kapitel: kapitelParam, id } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState<BookMeta | null>(null);
  const [osis, setOsis] = useState(osisParam ?? "");
  const [kapitelNr, setKapitelNr] = useState(kapitelParam ? parseInt(kapitelParam, 10) : 0);
  const [erstelltAm, setErstelltAm] = useState<string | null>(null);
  const [geladen, setGeladen] = useState(!id);

  const [betenUm, setBetenUm] = useState("");
  const [gedanken, setGedanken] = useState("");
  const [dank, setDank] = useState("");
  const [suenden, setSuenden] = useState("");
  const [sorgen, setSorgen] = useState("");
  const [personen, setPersonen] = useState("");
  const [anliegen, setAnliegen] = useState("");
  const [handeln, setHandeln] = useState("");

  useEffect(() => {
    if (!id) return;
    getStilleZeit(id).then((entry) => {
      if (!entry) {
        navigate("/stillezeit", { replace: true });
        return;
      }
      setOsis(entry.osis);
      setKapitelNr(entry.kapitel);
      setErstelltAm(entry.erstellt_am);
      setBetenUm(entry.betenUm);
      setGedanken(entry.gedanken);
      setDank(entry.dank);
      setSuenden(entry.suenden);
      setSorgen(entry.sorgen);
      setPersonen(entry.personen);
      setAnliegen(entry.anliegen);
      setHandeln(entry.handeln);
      setGeladen(true);
    });
  }, [id, navigate]);

  useEffect(() => {
    if (osis) getBookByOsis(osis).then((b) => setBook(b ?? null));
  }, [osis]);

  const kannSpeichern = gedanken.trim().length > 0;

  async function speichern() {
    if (!osis || !book) return;
    const daten = { osis, bookName: book.name_de, kapitel: kapitelNr, betenUm, gedanken, dank, suenden, sorgen, personen, anliegen, handeln };
    if (id) {
      await updateStilleZeit(id, daten);
      navigate("/stillezeit");
    } else {
      await saveStilleZeit(daten);
      navigate(-1);
    }
  }

  async function loeschen() {
    if (!id) return;
    if (!confirm("Diesen Stille-Zeit-Eintrag wirklich löschen?")) return;
    await deleteStilleZeit(id);
    navigate("/stillezeit", { replace: true });
  }

  if (!geladen) return <p>Lädt…</p>;

  return (
    <div>
      <Header title="Stille Zeit" onBack />

      <div className="card" style={{ marginBottom: 16, background: "var(--bibel-bg)", borderColor: "transparent" }}>
        <p style={{ margin: 0, fontWeight: 700, color: "var(--bibel-fg)" }}>Meine Verabredung mit Gott</p>
        <p style={{ margin: "4px 0 0", color: "var(--bibel-fg)" }}>
          Gelesener Text: {book ? book.name_de : "…"} {kapitelNr}
        </p>
        {erstelltAm && (
          <p style={{ margin: "4px 0 0", color: "var(--bibel-fg)", fontSize: "0.8rem" }}>
            Eingetragen am {new Date(erstelltAm).toLocaleDateString("de-DE")}
          </p>
        )}
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
      {id && (
        <button className="btn secondary" style={{ width: "100%", marginTop: 10 }} onClick={loeschen}>
          Eintrag löschen
        </button>
      )}
    </div>
  );
}
