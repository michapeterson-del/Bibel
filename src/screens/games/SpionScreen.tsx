import { useEffect, useMemo, useState } from "react";
import spionData from "../../data/spion.json";
import { getAllBooks } from "../../lib/db/bibleDb";
import type { BookMeta } from "../../types";
import Header from "../../components/Header";

interface WortKategorie {
  kategorie: string;
  woerter: string[];
}

const KATEGORIEN = spionData as WortKategorie[];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Quelle = "eigene" | "buecher";
type Phase =
  | "setup" | "hilfe"
  | "rollen" | "hinweise" | "abstimmung" | "stichwahl" | "auswertung" | "spion-rate"
  | "gesamt";

interface RundenState {
  wort: string;
  spionIndex: number;
  hinweisIndex: number;
  stimmen: Record<string, string>; // Waehler -> Gewaehlter
  stichwahlKandidaten: string[];
  stichwahlStimmen: Record<string, string>;
}

export default function SpionScreen() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [anzahl, setAnzahl] = useState(4);
  const [namen, setNamen] = useState<string[]>(["Spieler 1", "Spieler 2", "Spieler 3", "Spieler 4"]);
  const [quelle, setQuelle] = useState<Quelle>("eigene");
  const [kategorie, setKategorie] = useState<WortKategorie>(KATEGORIEN[KATEGORIEN.length - 1]); // Bibel
  const [buecherFilter, setBuecherFilter] = useState<"ALLE" | "AT" | "NT">("ALLE");
  const [alleBuecher, setAlleBuecher] = useState<BookMeta[]>([]);
  const [rundenGesamt, setRundenGesamt] = useState(3);
  const [zeitlimit, setZeitlimit] = useState<0 | 15 | 30 | 60>(0);
  const [sonderregel, setSonderregel] = useState(true);

  const [rundeNr, setRundeNr] = useState(1);
  const [punkte, setPunkte] = useState<Record<string, number>>({});
  const [runde, setRunde] = useState<RundenState | null>(null);
  const [aufgedeckt, setAufgedeckt] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [rateOptionen, setRateOptionen] = useState<string[]>([]);
  const [rateErgebnis, setRateErgebnis] = useState<null | boolean>(null);
  const [sonderregelErledigt, setSonderregelErledigt] = useState(false);

  useEffect(() => {
    getAllBooks().then(setAlleBuecher);
  }, []);

  const wortpool = useMemo(() => {
    if (quelle === "eigene") return kategorie.woerter;
    const gefiltert = alleBuecher.filter((b) => buecherFilter === "ALLE" || b.testament === buecherFilter);
    return gefiltert.map((b) => b.name_de);
  }, [quelle, kategorie, alleBuecher, buecherFilter]);

  function passeAnzahlAn(n: number) {
    setAnzahl(n);
    setNamen((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(`Spieler ${next.length + 1}`);
      return next.slice(0, n);
    });
  }

  function starteSpiel() {
    const start: Record<string, number> = {};
    namen.forEach((n) => (start[n] = 0));
    setPunkte(start);
    setRundeNr(1);
    starteRunde();
  }

  function starteRunde() {
    const wort = wortpool[Math.floor(Math.random() * wortpool.length)] ?? "Bibel";
    const spionIndex = Math.floor(Math.random() * namen.length);
    setRunde({ wort, spionIndex, hinweisIndex: 0, stimmen: {}, stichwahlKandidaten: [], stichwahlStimmen: {} });
    setAufgedeckt(false);
    setRateErgebnis(null);
    setSonderregelErledigt(false);
    setPhase("rollen");
  }

  const [rollenIndex, setRollenIndex] = useState(0);

  function weiterRollen() {
    setAufgedeckt(false);
    if (rollenIndex + 1 < namen.length) {
      setRollenIndex((i) => i + 1);
    } else {
      setRollenIndex(0);
      setCountdown(zeitlimit);
      setPhase("hinweise");
    }
  }

  useEffect(() => {
    if (phase !== "hinweise" || zeitlimit === 0) return;
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, zeitlimit]);

  function naechsterHinweis() {
    if (!runde) return;
    if (runde.hinweisIndex + 1 < namen.length) {
      setRunde({ ...runde, hinweisIndex: runde.hinweisIndex + 1 });
      setCountdown(zeitlimit);
    } else {
      setPhase("abstimmung");
    }
  }

  const [waehlerIndex, setWaehlerIndex] = useState(0);

  function stimmeAb(gewaehlter: string) {
    if (!runde) return;
    const waehler = namen[waehlerIndex];
    const neueStimmen = { ...runde.stimmen, [waehler]: gewaehlter };
    setRunde({ ...runde, stimmen: neueStimmen });
    if (waehlerIndex + 1 < namen.length) {
      setWaehlerIndex((i) => i + 1);
    } else {
      setWaehlerIndex(0);
      werteAb(neueStimmen);
    }
  }

  function zaehleStimmen(stimmen: Record<string, string>): [string, number][] {
    const zaehlung: Record<string, number> = {};
    for (const gew of Object.values(stimmen)) zaehlung[gew] = (zaehlung[gew] ?? 0) + 1;
    return Object.entries(zaehlung).sort((a, b) => b[1] - a[1]);
  }

  function werteAb(stimmen: Record<string, string>) {
    if (!runde) return;
    const ergebnis = zaehleStimmen(stimmen);
    if (ergebnis.length === 0) {
      setPhase("auswertung");
      return;
    }
    const top = ergebnis[0][1];
    const gleichauf = ergebnis.filter(([, n]) => n === top).map(([name]) => name);
    if (gleichauf.length > 1) {
      setRunde({ ...runde, stimmen, stichwahlKandidaten: gleichauf, stichwahlStimmen: {} });
      setWaehlerIndex(0);
      setPhase("stichwahl");
    } else {
      setRunde({ ...runde, stimmen });
      setPhase("auswertung");
    }
  }

  function stimmeStichwahl(gewaehlter: string) {
    if (!runde) return;
    const waehler = namen[waehlerIndex];
    const neu = { ...runde.stichwahlStimmen, [waehler]: gewaehlter };
    if (waehlerIndex + 1 < namen.length) {
      setRunde({ ...runde, stichwahlStimmen: neu });
      setWaehlerIndex((i) => i + 1);
    } else {
      setRunde({ ...runde, stichwahlStimmen: neu });
      setPhase("auswertung");
    }
  }

  const verdaechtiger = useMemo(() => {
    if (!runde) return null;
    if (runde.stichwahlKandidaten.length > 1) {
      const erg = zaehleStimmen(runde.stichwahlStimmen);
      if (erg.length === 0) return null;
      const top = erg[0][1];
      const gleichauf = erg.filter(([, n]) => n === top);
      if (gleichauf.length > 1) return null; // erneutes Unentschieden -> nicht enttarnt
      return erg[0][0];
    }
    const erg = zaehleStimmen(runde.stimmen);
    return erg[0]?.[0] ?? null;
  }, [runde]);

  const spionName = runde ? namen[runde.spionIndex] : "";
  const enttarnt = verdaechtiger !== null && verdaechtiger === spionName;

  function vergibPunkte(spionGewinntStattdessen: boolean) {
    if (!runde) return;
    setPunkte((prev) => {
      const next = { ...prev };
      if (enttarnt) {
        if (spionGewinntStattdessen) {
          next[spionName] = (next[spionName] ?? 0) + 1;
        } else {
          namen.forEach((n) => {
            if (n !== spionName) next[n] = (next[n] ?? 0) + 1;
          });
        }
      } else {
        if (spionGewinntStattdessen) {
          namen.forEach((n) => {
            if (n !== spionName) next[n] = (next[n] ?? 0) + 1;
          });
        } else {
          next[spionName] = (next[spionName] ?? 0) + 1;
        }
      }
      return next;
    });
  }

  function starteSpionRate() {
    if (!runde) return;
    const andere = shuffle(wortpool.filter((w) => w !== runde.wort)).slice(0, 5);
    setRateOptionen(shuffle([...andere, runde.wort]));
    setPhase("spion-rate");
  }

  function spionRaet(wort: string) {
    if (!runde) return;
    const richtig = wort === runde.wort;
    setRateErgebnis(richtig);
    vergibPunkte(richtig);
  }

  function abschliessenOhneSonderregel() {
    vergibPunkte(false);
  }

  function naechsteRundeOderEnde() {
    if (rundeNr < rundenGesamt) {
      setRundeNr((r) => r + 1);
      starteRunde();
    } else {
      setPhase("gesamt");
    }
  }

  // ---------- Setup ----------
  if (phase === "setup") {
    return (
      <div>
        <Header title="Der Spion unter uns" onBack right={<button className="chip" onClick={() => setPhase("hilfe")}>Regeln</button>} />
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Spieleranzahl</p>
          <div className="chip-row">
            {[3, 4, 5, 6, 7, 8].map((n) => (
              <button key={n} className={`chip ${anzahl === n ? "active" : ""}`} onClick={() => passeAnzahlAn(n)}>{n}</button>
            ))}
          </div>
          <div style={{ marginTop: 10 }}>
            {namen.map((name, i) => (
              <input
                key={i}
                value={name}
                onChange={(e) => setNamen((prev) => prev.map((n, idx) => (idx === i ? e.target.value : n)))}
                style={{ marginBottom: 6 }}
              />
            ))}
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Wortquelle</p>
          <div className="chip-row" style={{ marginBottom: 10 }}>
            <button className={`chip ${quelle === "eigene" ? "active" : ""}`} onClick={() => setQuelle("eigene")}>Eigene Wortlisten</button>
            <button className={`chip ${quelle === "buecher" ? "active" : ""}`} onClick={() => setQuelle("buecher")}>Bibel-Bücher</button>
          </div>
          {quelle === "eigene" ? (
            <div className="chip-row">
              {KATEGORIEN.map((k) => (
                <button key={k.kategorie} className={`chip ${kategorie.kategorie === k.kategorie ? "active" : ""}`} onClick={() => setKategorie(k)}>
                  {k.kategorie}
                </button>
              ))}
            </div>
          ) : (
            <div className="chip-row">
              <button className={`chip ${buecherFilter === "ALLE" ? "active" : ""}`} onClick={() => setBuecherFilter("ALLE")}>Ganze Bibel (66)</button>
              <button className={`chip ${buecherFilter === "AT" ? "active" : ""}`} onClick={() => setBuecherFilter("AT")}>Altes Testament (39)</button>
              <button className={`chip ${buecherFilter === "NT" ? "active" : ""}`} onClick={() => setBuecherFilter("NT")}>Neues Testament (27)</button>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Runden</p>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className={`chip ${rundenGesamt === n ? "active" : ""}`} onClick={() => setRundenGesamt(n)}>{n}</button>
            ))}
          </div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Zeitlimit je Hinweis</p>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {[0, 15, 30, 60].map((n) => (
              <button key={n} className={`chip ${zeitlimit === n ? "active" : ""}`} onClick={() => setZeitlimit(n as typeof zeitlimit)}>
                {n === 0 ? "Kein Limit" : `${n}s`}
              </button>
            ))}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={sonderregel} onChange={(e) => setSonderregel(e.target.checked)} />
            Spion-Sonderregel (Rateunde für den Spion)
          </label>
        </div>

        <button className="btn" style={{ width: "100%" }} onClick={starteSpiel}>Spiel starten</button>
      </div>
    );
  }

  if (phase === "hilfe") {
    return (
      <div>
        <div className="header-bar">
          <button className="icon-btn" onClick={() => setPhase("setup")} aria-label="Zurück">←</button>
          <h2 style={{ flex: 1 }}>Regeln</h2>
        </div>
        <div className="card">
          <p>Alle Spieler sehen dasselbe geheime Wort - außer dem Spion, der es nicht kennt.</p>
          <p>Reihum gibt jeder einen Hinweis auf das Wort, ohne es zu verraten. Der Spion muss bluffen.</p>
          <p>Danach stimmt jeder geheim ab, wer der Spion sein könnte. Wird der Spion enttarnt, bekommen alle anderen einen Punkt. Bleibt er unentdeckt, bekommt der Spion einen Punkt.</p>
          <p>Mit Sonderregel: Der Spion darf danach das Wort erraten und so den Punkt doch noch für sich holen (oder verlieren).</p>
        </div>
        <button className="btn" style={{ width: "100%", marginTop: 12 }} onClick={() => setPhase("setup")}>Zurück</button>
      </div>
    );
  }

  if (!runde) return null;

  // ---------- Rollen ----------
  if (phase === "rollen") {
    const name = namen[rollenIndex];
    const istSpion = rollenIndex === runde.spionIndex;
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "80vh", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 16 }}>
        <p style={{ color: "var(--text-muted)" }}>Runde {rundeNr} von {rundenGesamt}</p>
        <h2>Nur für die Augen von {name}</h2>
        {!aufgedeckt ? (
          <button className="btn" onClick={() => setAufgedeckt(true)}>Antippen zum Anzeigen</button>
        ) : (
          <>
            <div className="card" style={{ background: istSpion ? "var(--lila-bg)" : "var(--bibel-bg)", padding: 24 }}>
              <p style={{ fontSize: "1.5rem", fontWeight: 700, color: istSpion ? "var(--lila-fg)" : "var(--bibel-fg)", margin: 0 }}>
                {istSpion ? "🕵️ Du bist der Spion!" : runde.wort}
              </p>
            </div>
            <button className="btn secondary" onClick={weiterRollen}>Weiter geben</button>
          </>
        )}
      </div>
    );
  }

  // ---------- Hinweise ----------
  if (phase === "hinweise") {
    const dran = namen[runde.hinweisIndex];
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "80vh", justifyContent: "center", alignItems: "center", textAlign: "center", gap: 16 }}>
        <p style={{ color: "var(--text-muted)" }}>Hinweisrunde</p>
        <h2>{dran} ist dran</h2>
        {zeitlimit > 0 && <p style={{ fontSize: "2rem" }}>{countdown}s</p>}
        <button className="btn" onClick={naechsterHinweis}>
          {runde.hinweisIndex + 1 < namen.length ? "Nächster Spieler" : "Zur Abstimmung"}
        </button>
      </div>
    );
  }

  // ---------- Abstimmung ----------
  if (phase === "abstimmung") {
    const waehler = namen[waehlerIndex];
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "80vh", justifyContent: "center", gap: 12 }}>
        <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Geheime Abstimmung</p>
        <h2 style={{ textAlign: "center" }}>Wer stimmt ab: {waehler}?</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {namen.filter((n) => n !== waehler).map((n) => (
            <button key={n} className="btn secondary" onClick={() => stimmeAb(n)}>{n}</button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "stichwahl") {
    const waehler = namen[waehlerIndex];
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "80vh", justifyContent: "center", gap: 12 }}>
        <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Stimmengleichstand - Stichwahl</p>
        <h2 style={{ textAlign: "center" }}>Wer stimmt ab: {waehler}?</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {runde.stichwahlKandidaten.map((n) => (
            <button key={n} className="btn secondary" onClick={() => stimmeStichwahl(n)}>{n}</button>
          ))}
        </div>
      </div>
    );
  }

  // ---------- Auswertung ----------
  if (phase === "auswertung") {
    return (
      <div>
        <Header title="Auswertung" onBack={false} />
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ margin: "0 0 6px" }}>Das Wort war: <strong>{runde.wort}</strong></p>
          <p style={{ margin: "0 0 12px" }}>Der Spion war: <strong>{spionName}</strong></p>
          {enttarnt ? (
            <p style={{ fontWeight: 700, color: "var(--salbei-fg)" }}>
              ✔ Der Spion wurde per Abstimmung enttarnt ({verdaechtiger}).
            </p>
          ) : verdaechtiger ? (
            <p style={{ fontWeight: 700, color: "var(--lila-fg)" }}>
              ✖ NICHT enttarnt: Die Gruppe wählte {verdaechtiger} - das war der FALSCHE. Der Spion blieb unerkannt.
            </p>
          ) : (
            <p style={{ fontWeight: 700, color: "var(--lila-fg)" }}>
              ✖ Erneuter Gleichstand in der Stichwahl - keine eindeutige Enttarnung. Der Spion blieb unerkannt.
            </p>
          )}
        </div>

        {sonderregel && rateErgebnis === null && !sonderregelErledigt ? (
          <div className="card" style={{ marginTop: 12 }}>
            <p>Sonderregel: {spionName} darf jetzt versuchen, das Wort zu erraten.</p>
            <button className="btn" style={{ width: "100%" }} onClick={starteSpionRate}>Rateunde starten</button>
            <button
              className="btn secondary"
              style={{ width: "100%", marginTop: 8 }}
              onClick={() => {
                abschliessenOhneSonderregel();
                setSonderregelErledigt(true);
              }}
            >
              Überspringen
            </button>
          </div>
        ) : (
          <>
            {rateErgebnis !== null && (
              <div className="card" style={{ marginTop: 12 }}>
                {rateErgebnis ? (
                  <p>{spionName} hat das Wort erraten und bekommt den Punkt!</p>
                ) : (
                  <p>{spionName} hat das Wort nicht erraten.</p>
                )}
              </div>
            )}
            <button className="btn" style={{ width: "100%", marginTop: 12 }} onClick={naechsteRundeOderEnde}>
              {rundeNr < rundenGesamt ? "Nächste Runde" : "Gesamtwertung"}
            </button>
          </>
        )}
      </div>
    );
  }

  // ---------- Spion raet ----------
  if (phase === "spion-rate") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "80vh", justifyContent: "center", gap: 12 }}>
        <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Nur für {spionName}</p>
        <h2 style={{ textAlign: "center" }}>Welches Wort war es?</h2>
        {rateErgebnis === null ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rateOptionen.map((w) => (
              <button key={w} className="btn secondary" onClick={() => spionRaet(w)}>{w}</button>
            ))}
          </div>
        ) : (
          <>
            <p style={{ textAlign: "center", fontWeight: 700 }}>
              {rateErgebnis ? "Richtig geraten!" : "Leider falsch."}
            </p>
            <button className="btn" onClick={() => setPhase("auswertung")}>Weiter</button>
          </>
        )}
      </div>
    );
  }

  // ---------- Gesamtwertung ----------
  if (phase === "gesamt") {
    const rangliste = [...namen].sort((a, b) => (punkte[b] ?? 0) - (punkte[a] ?? 0));
    const medaillen = ["🥇", "🥈", "🥉"];
    return (
      <div>
        <Header title="Gesamtwertung" onBack={false} />
        {rangliste.map((n, i) => (
          <div key={n} className="card" style={{ marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            <span>{medaillen[i] ?? `${i + 1}.`} {n}</span>
            <span style={{ fontWeight: 700 }}>{punkte[n] ?? 0}</span>
          </div>
        ))}
        <button className="btn" style={{ width: "100%", marginTop: 12 }} onClick={() => setPhase("setup")}>
          Neues Spiel
        </button>
      </div>
    );
  }

  return null;
}
