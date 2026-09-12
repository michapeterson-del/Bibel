import { useNavigate } from "react-router-dom";
import Header from "../../components/Header";

const SPIELE = [
  { to: "/spiele/quiz", titel: "Bibelquiz", sub: "60 Fragen in 4 Stufen, solo oder als Spielleiter", bg: "var(--gelb-bg)", fg: "var(--gelb-fg)" },
  { to: "/spiele/tabu", titel: "Bibel Tabu", sub: "Begriffe erklären, ohne die Tabu-Wörter zu sagen", bg: "var(--apricot-bg)", fg: "var(--apricot-fg)" },
  { to: "/spiele/headsup", titel: "Heads Up!", sub: "Begriff auf der Stirn erraten lassen", bg: "var(--blau-hell-bg)", fg: "var(--blau-hell-fg)" },
  { to: "/spiele/spion", titel: "Der Spion unter uns", sub: "Partyspiel für 3-8 Spieler", bg: "var(--lavendel-bg)", fg: "var(--lavendel-fg)" },
];

export default function GamesHomeScreen() {
  const navigate = useNavigate();
  return (
    <div>
      <Header title="BibelSpiele" onBack />
      {SPIELE.map((s) => (
        <button
          key={s.to}
          className="tile"
          style={{ background: s.bg, color: s.fg, marginBottom: 12 }}
          onClick={() => navigate(s.to)}
        >
          <span className="tile-title">{s.titel}</span>
          <span className="tile-sub">{s.sub}</span>
        </button>
      ))}
    </div>
  );
}
