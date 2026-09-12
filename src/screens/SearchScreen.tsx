import { useState, type ReactNode } from "react";
import { searchAnyTerm, searchFullText, type SearchHit } from "../lib/db/bibleDb";
import { useVerseDetail } from "../lib/VerseDetailContext";

function highlight(text: string, terms: string[]): ReactNode[] {
  if (terms.length === 0) return [text];
  const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const alternation = escaped.map((t) => `${t}\\w*`).join("|");
  const splitPattern = new RegExp(`(${alternation})`, "gi");
  const testPattern = new RegExp(`^(${alternation})$`, "i");
  const parts = text.split(splitPattern);
  return parts.map((part, i) =>
    part !== "" && testPattern.test(part)
      ? <mark key={i} style={{ background: "var(--gelb-bg)", color: "var(--gelb-fg)" }}>{part}</mark>
      : <span key={i}>{part}</span>
  );
}

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [testament, setTestament] = useState<"ALLE" | "AT" | "NT">("ALLE");
  const [direct, setDirect] = useState<SearchHit[]>([]);
  const [aehnlich, setAehnlich] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { open: openVerseDetail } = useVerseDetail();

  async function runSearch(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const hits = await searchFullText(q, { testament });
      setDirect(hits);
      if (hits.length < 5) {
        const any = await searchAnyTerm(q, { testament });
        setAehnlich(any.filter((a) => !hits.some((h) => h.osis === a.osis && h.chapter === a.chapter && h.verse === a.verse)));
      } else {
        setAehnlich([]);
      }
    } finally {
      setLoading(false);
    }
  }

  function renderHit(hit: SearchHit) {
    return (
      <div
        key={`${hit.osis}-${hit.chapter}-${hit.verse}`}
        className="card"
        style={{ marginBottom: 8, cursor: "pointer" }}
        onClick={() =>
          openVerseDetail({
            osis: hit.osis,
            bookName: hit.bookName,
            chapter: hit.chapter,
            verseVon: hit.verse,
            verseBis: hit.verse,
          })
        }
      >
        <p style={{ margin: "0 0 4px" }}>{highlight(hit.text, hit.matchedTerms)}</p>
        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 600 }}>
          {hit.bookName} {hit.chapter},{hit.verse}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="header-bar" style={{ paddingTop: 8 }}>
        <h1 style={{ fontSize: "1.3rem" }}>Eine Stelle finden</h1>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input
          type="search"
          placeholder="Wort, Satz oder halb erinnerter Vers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
        />
        <button className="btn" onClick={() => runSearch(query)}>Suchen</button>
      </div>

      <div className="chip-row" style={{ marginBottom: 14 }}>
        {(["ALLE", "AT", "NT"] as const).map((t) => (
          <button
            key={t}
            className={`chip ${testament === t ? "active" : ""}`}
            onClick={() => {
              setTestament(t);
              if (query.trim()) runSearch(query);
            }}
          >
            {t === "ALLE" ? "Alle" : t === "AT" ? "Altes Testament" : "Neues Testament"}
          </button>
        ))}
      </div>

      {loading && <p>Suche läuft…</p>}

      {!loading && searched && direct.length === 0 && aehnlich.length === 0 && (
        <p style={{ color: "var(--text-muted)" }}>Keine Treffer gefunden.</p>
      )}

      {direct.length > 0 && (
        <div>
          <h3>{direct.length} Treffer</h3>
          {direct.map(renderHit)}
        </div>
      )}

      {aehnlich.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Ähnliche Stellen</h3>
          {aehnlich.slice(0, 30).map(renderHit)}
        </div>
      )}
    </div>
  );
}
