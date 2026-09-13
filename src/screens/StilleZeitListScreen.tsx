import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { StilleZeitEintrag } from "../types";
import { listStilleZeit } from "../lib/db/userDb";
import Header from "../components/Header";

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function StilleZeitListScreen() {
  const navigate = useNavigate();
  const [eintraege, setEintraege] = useState<StilleZeitEintrag[]>([]);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    listStilleZeit().then((all) => {
      setEintraege(all);
      setGeladen(true);
    });
  }, []);

  return (
    <div>
      <Header title="Meine Stille Zeit" onBack />

      {geladen && eintraege.length === 0 && (
        <div className="card">
          <p style={{ margin: 0, color: "var(--text-muted)" }}>
            Noch keine Einträge. Wenn du ein Kapitel als gelesen markierst, kannst du dort deine
            Gedanken und Gebete festhalten – sie erscheinen dann hier.
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
