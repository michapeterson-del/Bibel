"""
Erzeugt public/vers-des-tages.json: eine Vorausberechnung des "Vers des
Tages" fuer jeden Tag im Jahr (1-366), exakt nach derselben Logik wie
getDailyVerse() in src/lib/db/bibleDb.ts (Tag-im-Jahr modulo Anzahl
Eintraege in der "daily"-Tabelle).

Damit kann z.B. ein Scriptable-Widget den Vers des Tages anzeigen, ohne
die ganze Bibel-Datenbank laden zu muessen - es reicht ein einziger
GET-Request auf diese kleine JSON-Datei.

Aufruf: python3 scripts/generate_daily_verses.py
"""

import json
import sqlite3
from datetime import date, timedelta

DB_PATH = "public/bible-data/bible.db"
OUT_PATH = "public/vers-des-tages.json"


def day_of_year(d: date) -> int:
    # Entspricht exakt der JS-Berechnung in getDailyVerse():
    # Math.floor((date - new Date(year, 0, 0)) / 86400000)
    jan0 = date(d.year, 1, 1) - timedelta(days=1)
    return (d - jan0).days


def main():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    cur.execute("SELECT COUNT(*) FROM daily")
    count = cur.fetchone()[0]
    if count == 0:
        raise SystemExit("Keine Eintraege in der daily-Tabelle gefunden.")

    out = {}
    # 1..366 deckt sowohl normale Jahre als auch Schaltjahre ab
    for doy in range(1, 367):
        idx = (doy % count) + 1
        cur.execute(
            """SELECT d.chapter, d.verse_von, d.verse_bis, b.osis, b.name_de
               FROM daily d JOIN books b ON b.id = d.book_id
               WHERE d.day_of_year = ?""",
            (idx,),
        )
        row = cur.fetchone()
        if not row:
            continue
        chapter, verse_von, verse_bis, osis, name_de = row

        cur.execute(
            """SELECT verse, text FROM verses v JOIN books b ON b.id = v.book_id
               WHERE b.osis = ? AND v.chapter = ? AND v.verse BETWEEN ? AND ?
               ORDER BY v.verse""",
            (osis, chapter, verse_von, verse_bis),
        )
        verse_rows = cur.fetchall()
        text = " ".join(t for _, t in verse_rows)

        referenz = (
            f"{name_de} {chapter},{verse_von}"
            if verse_von == verse_bis
            else f"{name_de} {chapter},{verse_von}-{verse_bis}"
        )

        out[str(doy)] = {
            "osis": osis,
            "buch": name_de,
            "kapitel": chapter,
            "versVon": verse_von,
            "versBis": verse_bis,
            "referenz": referenz,
            "text": text,
        }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)

    print(f"{len(out)} Tage geschrieben nach {OUT_PATH}")


if __name__ == "__main__":
    main()
