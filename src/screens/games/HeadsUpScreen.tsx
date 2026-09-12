import { useEffect, useRef, useState } from "react";
import headsupData from "../../data/headsup.json";
import { kvGet, kvSet } from "../../lib/db/userDb";
import Header from "../../components/Header";

interface Kategorie {
  kategorie: string;
  begriffe: string[];
}

const KATEGORIEN = headsupData as Kategorie[];

interface LetztesErgebnis {
  datum: string;
  kategorie: string;
  punkte: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Phase = "setup" | "countdown" | "spielt" | "ende";

export default function HeadsUpScreen() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [kategorie, setKategorie] = useState<Kategorie>(KATEGORIEN[0]);
  const [spielform, setSpielform] = useState<"gemeinsam" | "teams">("gemeinsam");
  const [zeitSekunden, setZeitSekunden] = useState(60);
  const [letzteErgebnisse, setLetzteErgebnisse] = useState<LetztesErgebnis[]>([]);
  const [bewegungAn, setBewegungAn] = useState(false);

  const [countdown, setCountdown] = useState(3);
  const [deck, setDeck] = useState<string[]>([]);
  const [richtig, setRichtig] = useState<string[]>([]);
  const [uebersprungen, setUebersprungen] = useState<string[]>([]);
  const [zeitLinks, setZeitLinks] = useState(0);
  const [teamAPunkte, setTeamAPunkte] = useState<number | null>(null);
  const cooldownRef = useRef(false);

  useEffect(() => {
    kvGet<LetztesErgebnis[]>("headsup_letzte").then((v) => setLetzteErgebnisse(v ?? []));
  }, []);

  function starteCountdown() {
    setDeck(shuffle(kategorie.begriffe));
    setRichtig([]);
    setUebersprungen([]);
    setCountdown(3);
    setPhase("countdown");
  }

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown === 0) {
      setZeitLinks(zeitSekunden);
      setPhase("spielt");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, countdown, zeitSekunden]);

  useEffect(() => {
    if (phase !== "spielt") return;
    const iv = setInterval(() => {
      setZeitLinks((z) => {
        if (z <= 1) {
          clearInterval(iv);
          beendeRunde();
          return 0;
        }
        return z - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function markiereRichtig() {
    setDeck((d) => {
      const [aktuell, ...rest] = d;
      if (aktuell) setRichtig((r) => [...r, aktuell]);
      return rest.length > 0 ? rest : shuffle(kategorie.begriffe);
    });
  }

  function markiereUebersprungen() {
    setDeck((d) => {
      const [aktuell, ...rest] = d;
      if (aktuell) setUebersprungen((u) => [...u, aktuell]);
      return rest.length > 0 ? [...rest, aktuell] : shuffle(kategorie.begriffe);
    });
  }

  async function beendeRunde() {
    if (spielform === "teams" && teamAPunkte === null) {
      setTeamAPunkte(richtig.length);
      setPhase("ende");
      return;
    }
    const punkte = richtig.length;
    const eintrag: LetztesErgebnis = { datum: new Date().toISOString(), kategorie: kategorie.kategorie, punkte };
    const bisherige = (await kvGet<LetztesErgebnis[]>("headsup_letzte")) ?? [];
    const neue = [eintrag, ...bisherige].slice(0, 3);
    await kvSet("headsup_letzte", neue);
    setLetzteErgebnisse(neue);
    setPhase("ende");
  }

  function naechstesTeam() {
    setDeck(shuffle(kategorie.begriffe));
    setRichtig([]);
    setUebersprungen([]);
    setCountdown(3);
    setPhase("countdown");
  }

  async function aktiviereBewegung() {
    const w = window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } };
    if (w.DeviceOrientationEvent?.requestPermission) {
      try {
        const result = await w.DeviceOrientationEvent.requestPermission();
        setBewegungAn(result === "granted");
      } catch {
        setBewegungAn(false);
      }
    } else {
      setBewegungAn(true);
    }
  }

  useEffect(() => {
    if (!bewegungAn || phase !== "spielt") return;
    function onOrientation(e: DeviceOrientationEvent) {
      if (e.beta == null || cooldownRef.current) return;
      if (e.beta > 130) {
        cooldownRef.current = true;
        markiereRichtig();
        setTimeout(() => (cooldownRef.current = false), 900);
      } else if (e.beta < 30 && e.beta > -180) {
        cooldownRef.current = true;
        markiereUebersprungen();
        setTimeout(() => (cooldownRef.current = false), 900);
      }
    }
    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bewegungAn, phase, kategorie]);

  if (phase === "setup") {
    return (
      <div>
        <Header title="Heads Up!" onBack />
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Kategorie</p>
          <div className="chip-row">
            {KATEGORIEN.map((k) => (
              <button key={k.kategorie} className={`chip ${kategorie.kategorie === k.kategorie ? "active" : ""}`} onClick={() => setKategorie(k)}>
                {k.kategorie}
              </button>
            ))}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Spielform</p>
          <div className="chip-row">
            <button className={`chip ${spielform === "gemeinsam" ? "active" : ""}`} onClick={() => setSpielform("gemeinsam")}>Gemeinsam</button>
            <button className={`chip ${spielform === "teams" ? "active" : ""}`} onClick={() => setSpielform("teams")}>2 Teams</button>
          </div>
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>Zeit</p>
          <div className="chip-row">
            {[30, 60, 90, 120].map((n) => (
              <button key={n} className={`chip ${zeitSekunden === n ? "active" : ""}`} onClick={() => setZeitSekunden(n)}>{n}s</button>
            ))}
          </div>
        </div>
        <div className="card" style={{ marginBottom: 12 }}>
          <p style={{ margin: "0 0 8px" }}>
            Optional: Handy zum Kippen benutzen statt Tasten (nach unten kippen = richtig, nach oben = überspringen).
          </p>
          <button className="btn secondary" onClick={aktiviereBewegung}>
            {bewegungAn ? "✓ Bewegungssteuerung aktiv" : "Bewegungssteuerung aktivieren"}
          </button>
        </div>
        <button className="btn" style={{ width: "100%" }} onClick={() => { setTeamAPunkte(null); starteCountdown(); }}>
          Los geht's!
        </button>

        {letzteErgebnisse.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3>🏆 Letzte Ergebnisse</h3>
            {letzteErgebnisse.map((e, i) => (
              <div key={i} className="card" style={{ marginBottom: 6 }}>
                <p style={{ margin: 0 }}>{e.kategorie}: <strong>{e.punkte}</strong> Begriffe</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "70vh" }}>
        <p style={{ fontSize: "5rem", fontWeight: 700 }}>{countdown === 0 ? "Los!" : countdown}</p>
      </div>
    );
  }

  if (phase === "spielt") {
    return (
      <div>
        <div className="header-bar">
          <h2 style={{ flex: 1 }}>{zeitLinks}s</h2>
          <span style={{ color: "var(--text-muted)" }}>{richtig.length} richtig</span>
        </div>
        <div
          className="card"
          style={{ textAlign: "center", background: "var(--blau-hell-bg)", minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <p style={{ fontSize: "2.2rem", fontWeight: 700, color: "var(--blau-hell-fg)" }}>{deck[0]}</p>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
          <button className="btn secondary" style={{ flex: 1 }} onClick={markiereUebersprungen}>⏭ Überspringen</button>
          <button className="btn" style={{ flex: 1 }} onClick={markiereRichtig}>✔ Richtig</button>
        </div>
      </div>
    );
  }

  if (phase === "ende") {
    return (
      <div>
        <Header title="Ergebnis" onBack={false} />
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontSize: "2rem", margin: 0 }}>{richtig.length}</p>
          <p style={{ color: "var(--text-muted)" }}>richtige Begriffe erraten</p>
          {spielform === "teams" && teamAPunkte !== null && (
            <p style={{ marginTop: 8, fontWeight: 600 }}>
              Team A: {teamAPunkte} · Team B: {richtig.length}
              {teamAPunkte !== richtig.length && ` — ${teamAPunkte > richtig.length ? "Team A" : "Team B"} gewinnt!`}
            </p>
          )}
        </div>
        {richtig.length > 0 && (
          <div className="card" style={{ marginTop: 10 }}>
            <p style={{ fontWeight: 600, margin: "0 0 6px" }}>Erraten:</p>
            <p style={{ margin: 0 }}>{richtig.join(", ")}</p>
          </div>
        )}
        {uebersprungen.length > 0 && (
          <div className="card" style={{ marginTop: 10 }}>
            <p style={{ fontWeight: 600, margin: "0 0 6px", color: "var(--text-muted)" }}>Übersprungen:</p>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>{uebersprungen.join(", ")}</p>
          </div>
        )}
        {spielform === "teams" && teamAPunkte === null ? (
          <button className="btn" style={{ width: "100%", marginTop: 14 }} onClick={naechstesTeam}>
            Team B: los geht's!
          </button>
        ) : (
          <button className="btn" style={{ width: "100%", marginTop: 14 }} onClick={() => setPhase("setup")}>
            Zurück zur Übersicht
          </button>
        )}
      </div>
    );
  }

  return null;
}
