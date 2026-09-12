import { useEffect, useRef, useState } from "react";
import tabuData from "../../data/tabu.json";
import Header from "../../components/Header";

interface TabuKarte {
  begriff: string;
  tabu: string[];
}

const KARTEN = tabuData as TabuKarte[];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = "setup" | "bereit" | "spielt" | "rundenende" | "spielende";

export default function TabuScreen() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [teamAName, setTeamAName] = useState("Team A");
  const [teamBName, setTeamBName] = useState("Team B");
  const [rundenProTeam, setRundenProTeam] = useState(2);
  const [timerSekunden, setTimerSekunden] = useState(60);
  const [variante, setVariante] = useState<"streng" | "leicht">("streng");
  const [punkteModus, setPunkteModus] = useState<"streng" | "locker">("locker");

  const [punkteA, setPunkteA] = useState(0);
  const [punkteB, setPunkteB] = useState(0);
  const [aktuellesTeam, setAktuellesTeam] = useState<"A" | "B">("A");
  const [rundeNummer, setRundeNummer] = useState(1);
  const [deck, setDeck] = useState<TabuKarte[]>([]);
  const [zeitLinks, setZeitLinks] = useState(0);
  const intervalRef = useRef<number | null>(null);

  function starteZug() {
    setDeck(shuffle(KARTEN));
    setZeitLinks(timerSekunden);
    setPhase("spielt");
  }

  useEffect(() => {
    if (phase !== "spielt") return;
    intervalRef.current = window.setInterval(() => {
      setZeitLinks((z) => {
        if (z <= 1) {
          window.clearInterval(intervalRef.current!);
          setPhase("rundenende");
          return 0;
        }
        return z - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [phase]);

  function punktGeben() {
    if (aktuellesTeam === "A") setPunkteA((p) => p + 1);
    else setPunkteB((p) => p + 1);
    setDeck((d) => d.slice(1));
    if (deck.length <= 1) setDeck(shuffle(KARTEN));
  }

  function ueberspringen() {
    const abzug = punkteModus === "streng" ? -1 : 0;
    if (abzug !== 0) {
      if (aktuellesTeam === "A") setPunkteA((p) => p + abzug);
      else setPunkteB((p) => p + abzug);
    }
    setDeck((d) => (d.length > 1 ? [...d.slice(1), d[0]] : d));
  }

  function naechsterZug() {
    const letzteRundeInsgesamt = rundeNummer >= rundenProTeam && aktuellesTeam === "B";
    if (letzteRundeInsgesamt) {
      setPhase("spielende");
      return;
    }
    if (aktuellesTeam === "A") {
      setAktuellesTeam("B");
    } else {
      setAktuellesTeam("A");
      setRundeNummer((r) => r + 1);
    }
    setPhase("bereit");
  }

  function neuesSpiel() {
    setPunkteA(0);
    setPunkteB(0);
    setAktuellesTeam("A");
    setRundeNummer(1);
    setPhase("setup");
  }

  if (phase === "setup") {
    return (
      <div>
        <Header title="Bibel Tabu" onBack />
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Team A</label>
            <input value={teamAName} onChange={(e) => setTeamAName(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Team B</label>
            <input value={teamBName} onChange={(e) => setTeamBName(e.target.value)} />
          </div>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: "0.85rem", color: "var(--text-muted)" }}>Runden pro Team</p>
            <div className="chip-row">
              {[1, 2, 3, 4].map((n) => (
                <button key={n} className={`chip ${rundenProTeam === n ? "active" : ""}`} onClick={() => setRundenProTeam(n)}>{n}</button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: "0.85rem", color: "var(--text-muted)" }}>Zeit pro Zug</p>
            <div className="chip-row">
              {[30, 60, 90, 120].map((n) => (
                <button key={n} className={`chip ${timerSekunden === n ? "active" : ""}`} onClick={() => setTimerSekunden(n)}>{n}s</button>
              ))}
            </div>
          </div>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: "0.85rem", color: "var(--text-muted)" }}>Variante</p>
            <div className="chip-row">
              <button className={`chip ${variante === "streng" ? "active" : ""}`} onClick={() => setVariante("streng")}>Streng (5 Tabu-Wörter)</button>
              <button className={`chip ${variante === "leicht" ? "active" : ""}`} onClick={() => setVariante("leicht")}>Leicht (3 Tabu-Wörter)</button>
            </div>
          </div>
          <div>
            <p style={{ margin: "0 0 6px", fontSize: "0.85rem", color: "var(--text-muted)" }}>Punkte beim Überspringen</p>
            <div className="chip-row">
              <button className={`chip ${punkteModus === "locker" ? "active" : ""}`} onClick={() => setPunkteModus("locker")}>Locker (0)</button>
              <button className={`chip ${punkteModus === "streng" ? "active" : ""}`} onClick={() => setPunkteModus("streng")}>Streng (−1)</button>
            </div>
          </div>
          <button className="btn" onClick={starteZug}>Spiel starten</button>
        </div>
      </div>
    );
  }

  const teamName = aktuellesTeam === "A" ? teamAName : teamBName;

  if (phase === "bereit") {
    return (
      <div>
        <Header title="Bibel Tabu" onBack={false} />
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontSize: "1.3rem", fontWeight: 700 }}>{teamName} ist dran</p>
          <p style={{ color: "var(--text-muted)" }}>Runde {rundeNummer} von {rundenProTeam}</p>
          <p style={{ color: "var(--text-muted)", marginBottom: 14 }}>{teamAName}: {punkteA} · {teamBName}: {punkteB}</p>
          <button className="btn" style={{ width: "100%" }} onClick={starteZug}>Gerät übernehmen &amp; los!</button>
        </div>
      </div>
    );
  }

  if (phase === "spielt" && deck.length > 0) {
    const karte = deck[0];
    const tabuWoerter = variante === "streng" ? karte.tabu : karte.tabu.slice(0, 3);
    return (
      <div>
        <div className="header-bar">
          <h2 style={{ flex: 1 }}>{teamName} · {zeitLinks}s</h2>
        </div>
        <div className="card" style={{ textAlign: "center", background: "var(--apricot-bg)" }}>
          <p style={{ fontSize: "1.6rem", fontWeight: 700, color: "var(--apricot-fg)" }}>{karte.begriff}</p>
          <div style={{ marginTop: 14, textAlign: "left" }}>
            {tabuWoerter.map((w) => (
              <p key={w} style={{ margin: "4px 0", color: "var(--apricot-fg)" }}>🚫 {w}</p>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="btn secondary" style={{ flex: 1 }} onClick={ueberspringen}>Überspringen</button>
          <button className="btn" style={{ flex: 1 }} onClick={punktGeben}>✓ Richtig</button>
        </div>
      </div>
    );
  }

  if (phase === "rundenende") {
    return (
      <div>
        <Header title="Zeit um!" onBack={false} />
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontSize: "1.2rem", fontWeight: 700 }}>{teamName}: {aktuellesTeam === "A" ? punkteA : punkteB} Punkte</p>
          <p style={{ color: "var(--text-muted)" }}>{teamAName}: {punkteA} · {teamBName}: {punkteB}</p>
          <button className="btn" style={{ width: "100%", marginTop: 10 }} onClick={naechsterZug}>Weiter</button>
        </div>
      </div>
    );
  }

  if (phase === "spielende") {
    const sieger = punkteA === punkteB ? null : punkteA > punkteB ? teamAName : teamBName;
    return (
      <div>
        <Header title="Spielende" onBack={false} />
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontSize: "1.4rem", fontWeight: 700 }}>{sieger ? `🏆 ${sieger} gewinnt!` : "Unentschieden!"}</p>
          <p style={{ color: "var(--text-muted)", marginTop: 8 }}>{teamAName}: {punkteA} · {teamBName}: {punkteB}</p>
          <button className="btn" style={{ width: "100%", marginTop: 14 }} onClick={neuesSpiel}>Neues Spiel</button>
        </div>
      </div>
    );
  }

  return null;
}
