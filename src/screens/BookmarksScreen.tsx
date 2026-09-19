import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LesezeichenEintrag, LesezeichenTyp } from "../types";
import { deleteLesezeichen, exportLesezeichen, importLesezeichen, listLesezeichen, saveLesezeichen } from "../lib/db/userDb";
import { getAllBooks } from "../lib/db/bibleDb";

const TYP_LABEL: Record<Exclude<LesezeichenTyp, "markierung">, string> = {
  lesezeichen: "☆ Lesezeichen",
  notiz: "📝 Notiz",
};

export default function BookmarksScreen() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LesezeichenEintrag[]>([]);
  const [bookNames, setBookNames] = useState<Record<string, string>>({});
  const [filterTyp, setFilterTyp] = useState<"alle" | "lesezeichen" | "notiz">("alle");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState("");

  async function refresh() {
    const [all, books] = await Promise.all([listLesezeichen(), getAllBooks()]);
    all.sort((a, b) => (a.geaendert_am < b.geaendert_am ? 1 : -1));
    setItems(all.filter((i) => i.typ !== "markierung"));
    setBookNames(Object.fromEntries(books.map((b) => [b.osis, b.name_de])));
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = items.filter((i) => filterTyp === "alle" || i.typ === filterTyp);

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

      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: -6 }}>
        Farbige Markierungen im Bibeltext findest du unter „Meine Markierungen".
      </p>

      <div className="chip-row" style={{ marginBottom: 12 }}>
        {(["alle", "lesezeichen", "notiz"] as const).map((t) => (
          <button key={t} className={`chip ${filterTyp === t ? "active" : ""}`} onClick={() => setFilterTyp(t)}>
            {t === "alle" ? "Alle" : TYP_LABEL[t]}
          </button>
        ))}
      </div>

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
                {item.name || `${bookNames[item.buch] ?? item.buch} ${item.kapitel},${item.vers_von}${item.vers_bis !== item.vers_von ? `-${item.vers_bis}` : ""}`}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                {TYP_LABEL[item.typ as Exclude<LesezeichenTyp, "markierung">]}
              </p>
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
