import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Farbe, FarbLabels, LesezeichenEintrag } from "../types";
import {
  deleteLesezeichen,
  getFarbLabels,
  listLesezeichen,
  saveFarbLabels,
} from "../lib/db/userDb";
import { getAllBooks } from "../lib/db/bibleDb";
import Header from "../components/Header";

const FARBE_HEX: Record<Farbe, string> = {
  gelb: "#EFE5BC", gruen: "#B2D2C2", blau: "#ABC6E4", rosa: "#E6BAC5", lila: "#D3B4CC",
};

const ALLE_FARBEN: Farbe[] = ["gelb", "gruen", "blau", "rosa", "lila"];

export default function MarkierungenScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LesezeichenEintrag[]>([]);
  const [bookNames, setBookNames] = useState<Record<string, string>>({});
  const [filterFarbe, setFilterFarbe] = useState<Farbe | "alle">("alle");
  const [farbLabels, setFarbLabels] = useState<FarbLabels | null>(null);
  const [zeigeFarbverwaltung, setZeigeFarbverwaltung] = useState(false);
  const [farbEntwurf, setFarbEntwurf] = useState<FarbLabels | null>(null);

  async function refresh() {
    const [all, books, labels] = await Promise.all([listLesezeichen(), getAllBooks(), getFarbLabels()]);
    all.sort((a, b) => (a.geaendert_am < b.geaendert_am ? 1 : -1));
    setItems(all.filter((i) => i.typ === "markierung"));
    setBookNames(Object.fromEntries(books.map((b) => [b.osis, b.name_de])));
    setFarbLabels(labels);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = items.filter((i) => filterFarbe === "alle" || i.farbe === filterFarbe);

  async function farbenSpeichern() {
    if (!farbEntwurf) return;
    await saveFarbLabels(farbEntwurf);
    setFarbLabels(farbEntwurf);
    setZeigeFarbverwaltung(false);
  }

  return (
    <div>
      <Header
        title="Meine Markierungen"
        onBack
        right={
          <button
            className="icon-btn"
            title="Farben verwalten"
            onClick={() => {
              setFarbEntwurf(farbLabels);
              setZeigeFarbverwaltung((v) => !v);
            }}
          >
            🎨
          </button>
        }
      />

      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: -6, marginBottom: 12 }}>
        Alle farbig hinterlegten Verse aus dem Bibeltext - nach Farbe/Bedeutung durchsuchbar.
      </p>

      <div className="chip-row" style={{ marginBottom: 12, alignItems: "center" }}>
        <button className={`chip ${filterFarbe === "alle" ? "active" : ""}`} onClick={() => setFilterFarbe("alle")}>
          Alle Farben
        </button>
        {ALLE_FARBEN.map((f) => (
          <button
            key={f}
            className={`chip ${filterFarbe === f ? "active" : ""}`}
            onClick={() => setFilterFarbe(f)}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: FARBE_HEX[f] }} />
            {farbLabels?.[f]}
          </button>
        ))}
      </div>

      {zeigeFarbverwaltung && farbEntwurf && (
        <div className="card" style={{ marginBottom: 14 }}>
          <p style={{ margin: "0 0 10px", fontWeight: 600 }}>Farben benennen</p>
          {ALLE_FARBEN.map((f) => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ display: "inline-block", width: 16, height: 16, borderRadius: "50%", background: FARBE_HEX[f], flexShrink: 0 }} />
              <input
                value={farbEntwurf[f]}
                onChange={(e) => setFarbEntwurf({ ...farbEntwurf, [f]: e.target.value })}
                placeholder="z. B. Verheißungen"
              />
            </div>
          ))}
          <button className="btn" style={{ width: "100%", marginTop: 4 }} onClick={farbenSpeichern}>
            Speichern
          </button>
        </div>
      )}

      {filtered.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>
          {items.length === 0
            ? "Noch keine Markierungen. Tippe im Bibeltext auf einen Vers und wähle „🖍 Markieren\"."
            : "Keine Markierung mit dieser Farbe."}
        </p>
      )}

      {filtered.map((item) => (
        <div
          key={item.id}
          className="card"
          style={{ marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}
          onClick={() => navigate(`/lesen/${item.buch}/${item.kapitel}`)}
        >
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>
              <span
                title={farbLabels?.[item.farbe]}
                style={{
                  display: "inline-block",
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: FARBE_HEX[item.farbe],
                  marginRight: 6,
                }}
              />
              {bookNames[item.buch] ?? item.buch} {item.kapitel},{item.vers_von}
              {item.vers_bis !== item.vers_von ? `-${item.vers_bis}` : ""}
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>{farbLabels?.[item.farbe]}</p>
          </div>
          <button
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              deleteLesezeichen(item.id).then(refresh);
            }}
          >
            🗑
          </button>
        </div>
      ))}
    </div>
  );
}
