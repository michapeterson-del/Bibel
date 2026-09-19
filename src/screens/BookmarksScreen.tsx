import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Farbe, FarbLabels, LesezeichenEintrag, LesezeichenTyp } from "../types";
import {
  deleteLesezeichen,
  exportLesezeichen,
  getFarbLabels,
  importLesezeichen,
  listLesezeichen,
  saveFarbLabels,
  saveLesezeichen,
} from "../lib/db/userDb";
import { getAllBooks } from "../lib/db/bibleDb";

const TYP_LABEL: Record<LesezeichenTyp, string> = {
  lesezeichen: "☆ Lesezeichen",
  markierung: "🖍 Markierung",
  notiz: "📝 Notiz",
};

const FARBE_HEX: Record<Farbe, string> = {
  gelb: "#EFE5BC", gruen: "#B2D2C2", blau: "#ABC6E4", rosa: "#E6BAC5", lila: "#D3B4CC",
};

const ALLE_FARBEN: Farbe[] = ["gelb", "gruen", "blau", "rosa", "lila"];

export default function BookmarksScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LesezeichenEintrag[]>([]);
  const [bookNames, setBookNames] = useState<Record<string, string>>({});
  const [filterTyp, setFilterTyp] = useState<LesezeichenTyp | "alle">("alle");
  const [filterFarbe, setFilterFarbe] = useState<Farbe | "alle">("alle");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState("");
  const [farbLabels, setFarbLabels] = useState<FarbLabels | null>(null);
  const [zeigeFarbverwaltung, setZeigeFarbverwaltung] = useState(false);
  const [farbEntwurf, setFarbEntwurf] = useState<FarbLabels | null>(null);

  async function refresh() {
    const [all, books, labels] = await Promise.all([listLesezeichen(), getAllBooks(), getFarbLabels()]);
    all.sort((a, b) => (a.geaendert_am < b.geaendert_am ? 1 : -1));
    setItems(all);
    setBookNames(Object.fromEntries(books.map((b) => [b.osis, b.name_de])));
    setFarbLabels(labels);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = items.filter(
    (i) => (filterTyp === "alle" || i.typ === filterTyp) && (filterFarbe === "alle" || i.farbe === filterFarbe)
  );

  async function farbenSpeichern() {
    if (!farbEntwurf) return;
    await saveFarbLabels(farbEntwurf);
    setFarbLabels(farbEntwurf);
    setZeigeFarbverwaltung(false);
  }

  async function handleExport() {
    const json = await exportLesezeichen();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "amibel-lesezeichen.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    try {
      const text = await file.text();
      const count = await importLesezeichen(text);
      setImportMsg(`${count} Einträge importiert.`);
      refresh();
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : "Import fehlgeschlagen.");
    }
  }

  async function saveRename(id: string) {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    await saveLesezeichen({ ...item, name: renameValue.trim() || undefined, id: item.id });
    setRenamingId(null);
    refresh();
  }

  return (
    <div>
      <div className="header-bar" style={{ paddingTop: 8 }}>
        <h1 style={{ fontSize: "1.3rem" }}>Meine Lesezeichen</h1>
      </div>

      <div className="chip-row" style={{ marginBottom: 12 }}>
        {(["alle", "lesezeichen", "markierung", "notiz"] as const).map((t) => (
          <button key={t} className={`chip ${filterTyp === t ? "active" : ""}`} onClick={() => setFilterTyp(t)}>
            {t === "alle" ? "Alle" : TYP_LABEL[t]}
          </button>
        ))}
      </div>

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

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button className="btn secondary" onClick={handleExport}>Exportieren</button>
        <button className="btn secondary" onClick={() => fileInputRef.current?.click()}>Importieren</button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={(e) => e.target.files?.[0] && handleImportFile(e.target.files[0])}
        />
      </div>
      {importMsg && <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{importMsg}</p>}

      {filtered.length === 0 && <p style={{ color: "var(--text-muted)" }}>Noch keine Einträge.</p>}

      {filtered.map((item) => (
        <div key={item.id} className="card" style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div
              style={{ cursor: "pointer", flex: 1 }}
              onClick={() => navigate(`/lesen/${item.buch}/${item.kapitel}`)}
            >
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
                {item.name || `${bookNames[item.buch] ?? item.buch} ${item.kapitel},${item.vers_von}${item.vers_bis !== item.vers_von ? `-${item.vers_bis}` : ""}`}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>{TYP_LABEL[item.typ]}</p>
              {item.notiz && <p style={{ margin: "6px 0 0" }}>{item.notiz}</p>}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                className="icon-btn"
                onClick={() => {
                  setRenamingId(item.id);
                  setRenameValue(item.name ?? "");
                }}
              >
                ✎
              </button>
              <button className="icon-btn" onClick={() => deleteLesezeichen(item.id).then(refresh)}>🗑</button>
            </div>
          </div>
          {renamingId === item.id && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} placeholder="Name…" />
              <button className="btn" onClick={() => saveRename(item.id)}>Speichern</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
