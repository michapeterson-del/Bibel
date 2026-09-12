import Header from "../components/Header";

const QUELLEN = [
  { inhalt: "Luther 1912", quelle: "wldeh/bible-api (Quelle: gemeinfreier Bibeltext)", lizenz: "Public Domain" },
  { inhalt: "Schlachter 1951", quelle: "scrollmapper/bible_databases (GerSch)", lizenz: "Nicht-kommerzielle freie Weitergabe (Copyright Genfer Bibelgesellschaft)" },
  { inhalt: "Menge 1939 (Hermann Menge)", quelle: "scrollmapper/bible_databases (GerMenge)", lizenz: "Public Domain" },
  { inhalt: "Bibelbuch-Struktur / OSIS-Zuordnung", quelle: "eigene Aufbereitung", lizenz: "–" },
  { inhalt: "Themen & Vers-des-Tages-Auswahl", quelle: "eigene Kuratierung (reine Referenzen)", lizenz: "–" },
];

export default function AboutScreen() {
  return (
    <div>
      <Header title="Über Amibel" onBack />

      <div className="card" style={{ marginBottom: 16 }}>
        <p style={{ margin: 0 }}>Amibel Web – Version 0.1 (erste Ausbaustufe)</p>
      </div>

      <h3>Quellen &amp; Lizenzen</h3>
      {QUELLEN.map((q) => (
        <div key={q.inhalt} className="card" style={{ marginBottom: 8 }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{q.inhalt}</p>
          <p style={{ margin: "2px 0 0", fontSize: "0.85rem", color: "var(--text-muted)" }}>{q.quelle}</p>
          <p style={{ margin: "2px 0 0", fontSize: "0.85rem" }}>{q.lizenz}</p>
        </div>
      ))}

      <div className="card" style={{ marginTop: 16 }}>
        <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Noch nicht enthalten</p>
        <p style={{ margin: 0, fontSize: "0.9rem" }}>
          Strong-Lexikon / Wort-für-Wort-Studium, Kommentare (Matthew Henry, Calvin, Bob Utley),
          Bibelquiz, BibelSpiele (Tabu, Heads Up, Der Spion unter uns) und Leseplan-Import folgen in
          späteren Ausbaustufen. Diese Version bildet den vollständigen Kern ab: Bibel lesen in drei
          Übersetzungen, Volltextsuche, Lesezeichen/Notizen mit Export/Import, KI-Chat mit
          Quellenvalidierung, Erforschen-Aufsätze, Lernkartei und Serie.
        </p>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <p style={{ margin: "0 0 8px", fontWeight: 600 }}>Datenschutz</p>
        <p style={{ margin: 0, fontSize: "0.9rem" }}>
          Alle Daten (Bibeltext, Lesezeichen, Notizen, Chats, Einstellungen) bleiben lokal auf diesem
          Gerät. Nur wenn du einen KI-Anbieter einrichtest, werden deine Fragen direkt an dessen API
          gesendet – niemals an einen Amibel-eigenen Server, denn es gibt keinen.
        </p>
      </div>
    </div>
  );
}
