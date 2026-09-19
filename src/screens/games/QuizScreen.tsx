import { useEffect, useMemo, useState } from "react";
import quizData from "../../data/quiz.json";
import type { QuizFrage, QuizSpieler, QuizSpielleiterErgebnis, QuizStufe } from "../../types";
import { kvGet, kvSet } from "../../lib/db/userDb";
import { getVerseRange } from "../../lib/db/bibleDb";
import Header from "../../components/Header";

const ALLE_FRAGEN = quizData as QuizFrage[];

const STUFEN: { value: QuizStufe; label: string }[] = [
  { value: "lehrling", label: "Lehrling" },
  { value: "erwachsener", label: "Erwachsener" },
  { value: "diakon", label: "Diakon" },
  { value: "gemeindeleiter", label: "Gemeindeleiter" },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fragenFuerStufe(stufe: QuizStufe, anzahl: number, bevorzugt: string[] = []): QuizFrage[] {
  const pool = ALLE_FRAGEN.filter((f) => f.stufe === stufe);
  const bevorzugteFragen = pool.filter((f) => bevorzugt.includes(f.id));
  const rest = pool.filter((f) => !bevorzugt.includes(f.id));
  const kombiniert = [...shuffle(bevorzugteFragen), ...shuffle(rest)];
  return kombiniert.slice(0, Math.min(anzahl, kombiniert.length));
}

function pruefeAntwort(frage: QuizFrage, antwort: string | string[]): boolean {
  if (frage.typ === "multi") {
    const a = [...(antwort as string[])].sort();
    const r = [...(frage.richtig as string[])].sort();
    if (a.length !== r.length) return false;
    return a.every((v, i) => v === r[i]);
  }
  if (frage.typ === "orden") {
    const a = antwort as string[];
    const r = frage.richtig as string[];
    if (a.length !== r.length) return false;
    return a.every((v, i) => v === r[i]);
  }
  return antwort === frage.richtig;
}

function anzahlFragenFuerStufe(stufe: QuizStufe): number {
  return ALLE_FRAGEN.filter((f) => f.stufe === stufe).length;
}

function VersBeleg({ frage }: { frage: QuizFrage }) {
  const [text, setText] = useState("");
  useEffect(() => {
    getVerseRange(frage.beleg.osis, frage.beleg.kapitel, frage.beleg.versVon, frage.beleg.versBis, "LUT1912").then(
      (rows) => setText(rows.map((r) => r.text).join(" "))
    );
  }, [frage]);
  const label =
    frage.beleg.versVon === frage.beleg.versBis
      ? `${frage.beleg.bookName} ${frage.beleg.kapitel},${frage.beleg.versVon}`
      : `${frage.beleg.bookName} ${frage.beleg.kapitel},${frage.beleg.versVon}-${frage.beleg.versBis}`;
  return (
    <div className="card" style={{ background: "var(--bibel-bg)", borderColor: "transparent", marginTop: 10 }}>
      <p style={{ margin: 0, fontWeight: 700, color: "var(--bibel-fg)" }}>{label}</p>
      <p style={{ margin: "4px 0 0", color: "var(--bibel-fg)" }}>„{text}"</p>
    </div>
  );
}

function FrageAnzeige({
  frage,
  onAntwort,
}: {
  frage: QuizFrage;
  onAntwort: (antwort: string | string[]) => void;
}) {
  const [multiAuswahl, setMultiAuswahl] = useState<string[]>([]);
  const [ordenAuswahl, setOrdenAuswahl] = useState<string[]>([]);
  const [zahlInput, setZahlInput] = useState("");
  const [ordenPool, setOrdenPool] = useState<string[]>(() => shuffle(frage.optionen ?? []));

  useEffect(() => {
    setMultiAuswahl([]);
    setOrdenAuswahl([]);
    setZahlInput("");
    setOrdenPool(shuffle(frage.optionen ?? []));
  }, [frage]);

  if (frage.typ === "single") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {frage.optionen!.map((o) => (
          <button key={o} className="btn secondary" onClick={() => onAntwort(o)}>
            {o}
          </button>
        ))}
      </div>
    );
  }

  if (frage.typ === "wahrfalsch") {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn secondary" style={{ flex: 1 }} onClick={() => onAntwort("wahr")}>Wahr</button>
        <button className="btn secondary" style={{ flex: 1 }} onClick={() => onAntwort("falsch")}>Falsch</button>
      </div>
    );
  }

  if (frage.typ === "zahl") {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="number"
          value={zahlInput}
          onChange={(e) => setZahlInput(e.target.value)}
          placeholder="Zahl eingeben…"
        />
        <button className="btn" disabled={!zahlInput} onClick={() => onAntwort(zahlInput)}>OK</button>
      </div>
    );
  }

  if (frage.typ === "multi") {
    return (
      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {frage.optionen!.map((o) => (
            <button
              key={o}
              className={`chip ${multiAuswahl.includes(o) ? "active" : ""}`}
              style={{ justifyContent: "flex-start" }}
              onClick={() =>
                setMultiAuswahl((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]))
              }
            >
              {multiAuswahl.includes(o) ? "✓ " : ""}
              {o}
            </button>
          ))}
        </div>
        <button className="btn" disabled={multiAuswahl.length === 0} onClick={() => onAntwort(multiAuswahl)}>
          Bestätigen
        </button>
      </div>
    );
  }

  // orden: Optionen antippen in der Reihenfolge, in der sie gehören
  return (
    <div>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
        Tippe die Optionen in der richtigen Reihenfolge an.
      </p>
      <div style={{ marginBottom: 10 }}>
        {ordenAuswahl.map((o, i) => (
          <div key={o} className="chip active" style={{ marginBottom: 6, justifyContent: "flex-start" }}>
            {i + 1}. {o}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {ordenPool
          .filter((o) => !ordenAuswahl.includes(o))
          .map((o) => (
            <button
              key={o}
              className="chip"
              style={{ justifyContent: "flex-start" }}
              onClick={() => setOrdenAuswahl((prev) => [...prev, o])}
            >
              {o}
            </button>
          ))}
      </div>
      {ordenAuswahl.length === (frage.optionen?.length ?? 0) && ordenAuswahl.length > 0 && (
        <button className="btn" style={{ marginTop: 10, width: "100%" }} onClick={() => onAntwort(ordenAuswahl)}>
          Bestätigen
        </button>
      )}
    </div>
  );
}

export default function QuizScreen() {
  const [modus, setModus] = useState<"start" | "solo" | "solo-ende" | "spielleiter-setup" | "spielleiter" | "spielleiter-ende">(
    "start"
  );
  const [stufe, setStufe] = useState<QuizStufe>("lehrling");
  const [highscores, setHighscores] = useState<Record<QuizStufe, number>>({
    lehrling: 0,
    erwachsener: 0,
    diakon: 0,
    gemeindeleiter: 0,
  });

  useEffect(() => {
    (async () => {
      const scores: Record<QuizStufe, number> = { lehrling: 0, erwachsener: 0, diakon: 0, gemeindeleiter: 0 };
      for (const s of STUFEN) {
        scores[s.value] = (await kvGet<number>(`quiz_highscore_${s.value}`)) ?? 0;
      }
      setHighscores(scores);
    })();
  }, []);

  // ---------- Solo-Runde ----------
  const [soloFragen, setSoloFragen] = useState<QuizFrage[]>([]);
  const [soloIndex, setSoloIndex] = useState(0);
  const [soloPunkte, setSoloPunkte] = useState(0);
  const [soloAntwort, setSoloAntwort] = useState<{ richtig: boolean } | null>(null);
  const [soloFalsche, setSoloFalsche] = useState<string[]>([]);

  async function starteSolo(gewaehlteStufe: QuizStufe) {
    setStufe(gewaehlteStufe);
    const wiederholung = (await kvGet<string[]>(`quiz_wiederholung_${gewaehlteStufe}`)) ?? [];
    const fragen = fragenFuerStufe(gewaehlteStufe, Infinity, wiederholung);
    setSoloFragen(fragen);
    setSoloIndex(0);
    setSoloPunkte(0);
    setSoloAntwort(null);
    setSoloFalsche([]);
    setModus("solo");
  }

  async function soloAntworten(antwort: string | string[]) {
    const frage = soloFragen[soloIndex];
    const richtig = pruefeAntwort(frage, antwort);
    if (richtig) setSoloPunkte((p) => p + 1);
    else setSoloFalsche((prev) => [...prev, frage.id]);
    setSoloAntwort({ richtig });
  }

  async function naechsteSoloFrage() {
    setSoloAntwort(null);
    if (soloIndex + 1 < soloFragen.length) {
      setSoloIndex((i) => i + 1);
    } else {
      const bisher = (await kvGet<string[]>(`quiz_wiederholung_${stufe}`)) ?? [];
      const neueWiederholung = Array.from(new Set([...bisher.filter((id) => !soloFragen.some((f) => f.id === id)), ...soloFalsche]));
      await kvSet(`quiz_wiederholung_${stufe}`, neueWiederholung);
      if (soloPunkte > (highscores[stufe] ?? 0)) {
        await kvSet(`quiz_highscore_${stufe}`, soloPunkte);
        setHighscores((h) => ({ ...h, [stufe]: soloPunkte }));
      }
      setModus("solo-ende");
    }
  }

  // ---------- Spielleiter-Runde ----------
  const [spielerNamen, setSpielerNamen] = useState<string[]>(["Spieler 1", "Spieler 2"]);
  const [glFragen, setGlFragen] = useState<QuizFrage[]>([]);
  const [glIndex, setGlIndex] = useState(0);
  const [glSpieler, setGlSpieler] = useState<QuizSpieler[]>([]);
  const [glAntwortSichtbar, setGlAntwortSichtbar] = useState(false);

  function starteSpielleiter() {
    const gueltig = spielerNamen.map((n) => n.trim()).filter(Boolean);
    if (gueltig.length < 1) return;
    setGlSpieler(gueltig.map((name) => ({ name, punkte: 0 })));
    setGlFragen(fragenFuerStufe(stufe, Infinity));
    setGlIndex(0);
    setGlAntwortSichtbar(false);
    setModus("spielleiter");
  }

  function glPunkt(name: string, delta: number) {
    setGlSpieler((prev) => prev.map((s) => (s.name === name ? { ...s, punkte: s.punkte + delta } : s)));
  }

  async function naechsteGlFrage() {
    setGlAntwortSichtbar(false);
    if (glIndex + 1 < glFragen.length) {
      setGlIndex((i) => i + 1);
    } else {
      const ergebnis: QuizSpielleiterErgebnis = { datum: new Date().toISOString(), stufe, spieler: glSpieler };
      const bisherige = (await kvGet<QuizSpielleiterErgebnis[]>("quiz_spielleiter_verlauf")) ?? [];
      await kvSet("quiz_spielleiter_verlauf", [ergebnis, ...bisherige].slice(0, 10));
      setModus("spielleiter-ende");
    }
  }

  const soloAktuelleFrage = soloFragen[soloIndex];
  const glAktuelleFrage = glFragen[glIndex];

  const glSieger = useMemo(() => {
    if (glSpieler.length === 0) return null;
    return [...glSpieler].sort((a, b) => b.punkte - a.punkte)[0];
  }, [glSpieler]);

  if (modus === "solo" && soloAktuelleFrage) {
    return (
      <div>
        <Header title={`Frage ${soloIndex + 1}/${soloFragen.length}`} onBack />
        <p style={{ color: "var(--text-muted)" }}>Punkte: {soloPunkte}</p>
        <div className="card">
          <p style={{ fontWeight: 700, fontSize: "1.05rem" }}>{soloAktuelleFrage.frage}</p>
          {!soloAntwort && <FrageAnzeige frage={soloAktuelleFrage} onAntwort={soloAntworten} />}
          {soloAntwort && (
            <div>
              <p
                style={{
                  fontWeight: 700,
                  color: soloAntwort.richtig ? "var(--salbei-fg)" : "var(--lila-fg)",
                }}
              >
                {soloAntwort.richtig ? "✓ Richtig!" : "✗ Leider falsch."}
              </p>
              <p>{soloAktuelleFrage.erklaerung}</p>
              <VersBeleg frage={soloAktuelleFrage} />
              <button className="btn" style={{ width: "100%", marginTop: 12 }} onClick={naechsteSoloFrage}>
                {soloIndex + 1 < soloFragen.length ? "Nächste Frage" : "Ergebnis anzeigen"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (modus === "solo-ende") {
    return (
      <div>
        <Header title="Ergebnis" onBack={false} />
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontSize: "2rem", margin: 0 }}>{soloPunkte} / {soloFragen.length}</p>
          <p style={{ color: "var(--text-muted)" }}>
            Persönlicher Rekord ({STUFEN.find((s) => s.value === stufe)?.label}): {highscores[stufe]}
          </p>
          <button className="btn" style={{ width: "100%", marginTop: 10 }} onClick={() => setModus("start")}>
            Zurück zur Übersicht
          </button>
        </div>
      </div>
    );
  }

  if (modus === "spielleiter-setup") {
    return (
      <div>
        <div className="header-bar">
          <button className="icon-btn" onClick={() => setModus("start")} aria-label="Zurück">←</button>
          <h2 style={{ flex: 1 }}>Spielleiter-Runde</h2>
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Stufe</p>
          <div className="chip-row">
            {STUFEN.map((s) => (
              <button key={s.value} className={`chip ${stufe === s.value ? "active" : ""}`} onClick={() => setStufe(s.value)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Spieler (max. 30)</p>
          {spielerNamen.map((name, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input
                value={name}
                onChange={(e) =>
                  setSpielerNamen((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))
                }
              />
              <button
                className="icon-btn"
                onClick={() => setSpielerNamen((prev) => prev.filter((_, idx) => idx !== i))}
              >
                ✕
              </button>
            </div>
          ))}
          {spielerNamen.length < 30 && (
            <button
              className="chip"
              onClick={() => setSpielerNamen((prev) => [...prev, `Spieler ${prev.length + 1}`])}
            >
              + Spieler hinzufügen
            </button>
          )}
          <button className="btn" style={{ width: "100%", marginTop: 14 }} onClick={starteSpielleiter}>
            Runde starten
          </button>
        </div>
      </div>
    );
  }

  if (modus === "spielleiter" && glAktuelleFrage) {
    return (
      <div>
        <Header title={`Frage ${glIndex + 1}/${glFragen.length}`} onBack={false} />
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 700, fontSize: "1.15rem" }}>{glAktuelleFrage.frage}</p>
          {glAktuelleFrage.optionen && (
            <ul style={{ paddingLeft: 20 }}>
              {glAktuelleFrage.optionen.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          )}
          {!glAntwortSichtbar ? (
            <button className="btn" style={{ width: "100%" }} onClick={() => setGlAntwortSichtbar(true)}>
              Antwort zeigen
            </button>
          ) : (
            <div>
              <p style={{ fontWeight: 700, color: "var(--salbei-fg)" }}>
                Richtig: {Array.isArray(glAktuelleFrage.richtig) ? glAktuelleFrage.richtig.join(", ") : glAktuelleFrage.richtig}
              </p>
              <p style={{ fontSize: "0.9rem" }}>{glAktuelleFrage.erklaerung}</p>
              <button className="btn" style={{ width: "100%" }} onClick={naechsteGlFrage}>
                Nächste Frage
              </button>
            </div>
          )}
        </div>
        <h3>Punkte vergeben</h3>
        {glSpieler.map((s) => (
          <div key={s.name} className="card" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600 }}>{s.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button className="icon-btn" onClick={() => glPunkt(s.name, -1)}>−</button>
              <span style={{ minWidth: 24, textAlign: "center" }}>{s.punkte}</span>
              <button className="icon-btn" onClick={() => glPunkt(s.name, 1)}>+</button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (modus === "spielleiter-ende") {
    return (
      <div>
        <Header title="Endstand" onBack={false} />
        <div className="card" style={{ textAlign: "center", marginBottom: 12 }}>
          <p style={{ fontSize: "1.3rem", fontWeight: 700 }}>🏆 {glSieger?.name}</p>
          <p style={{ color: "var(--text-muted)" }}>Sieger dieser Runde</p>
        </div>
        {[...glSpieler].sort((a, b) => b.punkte - a.punkte).map((s, i) => (
          <div key={s.name} className="card" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            <span>{i + 1}. {s.name}</span>
            <span style={{ fontWeight: 700 }}>{s.punkte}</span>
          </div>
        ))}
        <button className="btn" style={{ width: "100%", marginTop: 10 }} onClick={() => setModus("start")}>
          Zurück zur Übersicht
        </button>
      </div>
    );
  }

  // ---------- Start ----------
  return (
    <div>
      <Header title="Bibelquiz" onBack />
      <h3>Solo-Runde</h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: -8 }}>
        Eine Runde geht durch alle Fragen der gewählten Stufe - dein bester Lauf wird als Rekord gespeichert.
      </p>
      {STUFEN.map((s) => (
        <div key={s.value} className="card" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>{s.label}</p>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--text-muted)" }}>
              Rekord: {highscores[s.value]}/{anzahlFragenFuerStufe(s.value)}
            </p>
          </div>
          <button className="btn" onClick={() => starteSolo(s.value)}>Spielen</button>
        </div>
      ))}

      <h3 style={{ marginTop: 20 }}>Spielleiter-Runde (Gruppe)</h3>
      <div className="card">
        <p style={{ marginTop: 0 }}>Für Gruppen bis 30 Spieler: Stufe wählen, Fragen werden groß angezeigt, du vergibst Punkte.</p>
        <button className="btn" style={{ width: "100%" }} onClick={() => setModus("spielleiter-setup")}>
          Spielleiter-Runde starten
        </button>
      </div>
    </div>
  );
}
