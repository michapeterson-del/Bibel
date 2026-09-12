# Amibel Web

Bibel-App mit KI-gestütztem Chat, Lesemodus und Volltextsuche – als Progressive
Web App. Läuft komplett im Browser (SQLite per `sql.js`/WASM, Nutzerdaten in
IndexedDB), außer den optionalen KI-Anfragen gibt es keinen eigenen Server.

## Aktueller Stand (erste Ausbaustufe)

Vollständig funktionsfähig:

- Bibel lesen (Luther 1912, Schlachter 1951, Menge 1939 – vollständiger,
  gemeinfreier bzw. frei verwendbarer Text, keine Platzhalter)
- Vers-Detail mit Übersetzungswechsel, Lesezeichen/Markierungen/Notizen,
  Teilen/Kopieren
- Volltextsuche (Wortstamm-Suche, Testament-Filter, „Ähnliche Stellen")
- Lesezeichen-Verwaltung inkl. JSON-Export/Import (kompatibel zum in der
  Spezifikation definierten Format)
- KI-Chat (Bibel-Modus & „Etwas beschäftigt mich") mit strukturierten
  Antwortkarten, Belegstufen, Referenz-Validierung gegen die Bibel-Datenbank
  (Retry bei erfundenen Stellen) – Anbieter: OpenAI, Gemini, DeepSeek
- Erforschen (Themen-Aufsätze per KI mit echten Bibelzitaten)
- Bibelverse lernen (Lückentext-Übung, Fortschritt)
- Serie/Streak (Aktivzeit-Tracking)
- Einstellungen (Profil, Darstellung/Dark-Mode, KI-Anbieter mit verschlüsseltem
  API-Schlüssel, Leseeinstellungen, Datenverwaltung)
- PWA (installierbar, Bibel-Datenbank wird für Offline-Nutzung gecacht)

Noch nicht enthalten (spätere Ausbaustufen): Strong-Lexikon/Wort-für-Wort-
Studium, Kommentare (Henry/Calvin/Utley), Bibelquiz, BibelSpiele (Tabu, Heads
Up, Der Spion unter uns), Leseplan-Import.

## Entwicklung

```bash
npm install
npm run dev       # Dev-Server
npm run build     # Produktionsbuild (tsc + vite build)
```

## Bibel-Datenbank neu bauen

`public/bible-data/bible.db` wird aus gemeinfreien/frei verwendbaren Quellen
gebaut (siehe `tools/bible-data/README-Quellen` unten). Neu bauen mit:

```bash
python3 tools/bible-data/build_bible_db.py
```

Das Skript lädt bei Bedarf automatisch:

- Luther 1912 (Public Domain) von `wldeh/bible-api` (ein JSON-Kapitel je Datei)
- Schlachter 1951 und Menge 1939 von `scrollmapper/bible_databases`
  (Voll-Dumps je Übersetzung; Schlachter 1951 dort mit dem Hinweis
  „nicht-kommerzielle freie Weitergabe")

Rohdaten werden nach `tools/bible-data/cache/` zwischengespeichert (nicht
versioniert) und bei einem erneuten Lauf wiederverwendet.

## Hinweis zu sql.js / WASM

Der im NPM-Paket `sql.js` mitgelieferte WASM-Build enthält **kein FTS5**
(„virtual table" für Volltextsuche). Die Suche läuft deshalb über `LIKE`
gegen die (kleine, ca. 31.000 Zeilen umfassende) `verses`-Tabelle statt über
einen FTS5-Index – für diese Datenmenge performant genug.
