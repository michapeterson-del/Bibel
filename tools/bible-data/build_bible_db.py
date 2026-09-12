# -*- coding: utf-8 -*-
"""
Baut die lokale Bibel-Datenbank (SQLite) fuer Amibel-Web aus gemeinfreien /
frei verwendbaren Quellen.

Quellen (siehe README.md in diesem Ordner fuer Lizenzdetails):
  - Luther 1912 (gemeinfrei): wldeh/bible-api, ein JSON pro Kapitel
  - Schlachter 1951 + Menge 1939: scrollmapper/bible_databases (Voll-Dump je Uebersetzung)

Ergebnis: public/bible-data/bible.db (wird im Browser per sql.js geladen).

Aufruf:
    python3 tools/bible-data/build_bible_db.py

Die Rohdaten werden nach tools/bible-data/cache/ heruntergeladen und dort
zwischengespeichert (git-ignoriert), damit ein erneuter Lauf nicht wieder
~1200 Einzeldateien holen muss.
"""
import json
import os
import re
import sqlite3
import sys
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(__file__))
from books import BOOKS  # noqa: E402
from daily_verses import DAILY_VERSES  # noqa: E402
from topics import TOPICS  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(HERE, "cache")
LUTHER_CACHE = os.path.join(CACHE_DIR, "luther_chapters")
OUT_DIR = os.path.join(HERE, "..", "..", "public", "bible-data")
OUT_DB = os.path.join(OUT_DIR, "bible.db")

LUTHER_BASE = "https://raw.githubusercontent.com/wldeh/bible-api/master/bibles/de-luther1912/books/{book}/chapters/{chapter}.json"
GERSCH_URL = "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/GerSch.json"
GERMENGE_URL = "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/GerMenge.json"

UMLAUT_MAP = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss",
                            "Ä": "Ae", "Ö": "Oe", "Ü": "Ue"})


def normalize_text(text: str) -> str:
    """Normalisiert Text fuer die Volltextsuche: Umlaute aufloesen,
    Grossschreibung/Interpunktion entfernen."""
    t = text.translate(UMLAUT_MAP)
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.lower()
    t = re.sub(r"[^a-z0-9\s]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def fetch_json(url: str, cache_path: str = None):
    if cache_path and os.path.exists(cache_path):
        with open(cache_path, "r", encoding="utf-8") as f:
            return json.load(f)
    req = urllib.request.Request(url, headers={"User-Agent": "amibel-build/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    if cache_path:
        os.makedirs(os.path.dirname(cache_path), exist_ok=True)
        with open(cache_path, "wb") as f:
            f.write(data)
    return json.loads(data.decode("utf-8"))


def fetch_luther_book(osis: str, luther_dir: str, num_chapters: int):
    """Laedt alle Kapitel eines Buches der Luther-1912-Ausgabe."""
    chapters = {}

    def fetch_one(ch):
        cache_path = os.path.join(LUTHER_CACHE, f"{osis}_{ch}.json")
        url = LUTHER_BASE.format(
            book=urllib.parse.quote(luther_dir), chapter=ch
        )
        data = fetch_json(url, cache_path)
        return ch, data.get("data", [])

    with ThreadPoolExecutor(max_workers=12) as ex:
        futures = [ex.submit(fetch_one, ch) for ch in range(1, num_chapters + 1)]
        for fut in as_completed(futures):
            ch, verses = fut.result()
            chapters[ch] = verses
    return chapters


# Kapitelzahl je Buch: ermittelt aus dem tatsaechlichen Dateibaum der
# Luther-1912-Quelle (git ls-tree), nicht auswendig gelernt -> fehlerfrei.
CHAPTER_COUNT_BY_LUTHER_DIR = {
    "1.mose": 50, "2.mose": 40, "3.mose": 27, "4.mose": 36, "5.mose": 34,
    "josua": 24, "richter": 21, "ruth": 4, "1.samuel": 31, "2.samuel": 24,
    "1.könige": 22, "2.könige": 25, "1.chonik": 29, "2.chronik": 36,
    "esra": 10, "nehemia": 13, "esther": 10, "hiob": 42, "psalmen": 150,
    "sprüche": 31, "prediger": 12, "hohelied": 8, "jesaja": 66,
    "jeremia": 52, "klagelieder": 5, "hesekiel": 48, "daniel": 12,
    "hosea": 14, "joel": 3, "amos": 9, "obadja": 1, "jona": 4, "micha": 7,
    "nahum": 3, "habakuk": 3, "zephanja": 3, "haggai": 2, "sacharja": 14,
    "maleachi": 4, "matthäus": 28, "markus": 16, "lukas": 24,
    "johannes": 21, "apostelgeschichte": 28, "römer": 16,
    "1.korinther": 16, "2.korinther": 13, "galater": 6, "epheser": 6,
    "philipper": 4, "kolosser": 4, "1.thessalonicher": 5,
    "2.thessalonicher": 3, "1.timotheus": 6, "2.timotheus": 4, "titus": 3,
    "philemon": 1, "hebräer": 13, "jakobus": 5, "1.petrus": 5,
    "2.petrus": 3, "1.johannes": 5, "2.johannes": 1, "3.johannes": 1,
    "judas": 1, "offenbarung": 22,
}


def main():
    assert len(CHAPTER_COUNT_BY_LUTHER_DIR) == 66
    for osis, name_de, testament, luther_dir, en_name in BOOKS:
        assert luther_dir in CHAPTER_COUNT_BY_LUTHER_DIR, luther_dir
    os.makedirs(OUT_DIR, exist_ok=True)
    if os.path.exists(OUT_DB):
        os.remove(OUT_DB)

    print("Lade Schlachter 1951 + Menge 1939 (Voll-Dumps) ...")
    sch = fetch_json(GERSCH_URL, os.path.join(CACHE_DIR, "GerSch.json"))
    menge = fetch_json(GERMENGE_URL, os.path.join(CACHE_DIR, "GerMenge.json"))
    sch_by_name = {b["name"]: b for b in sch["books"]}
    menge_by_name = {b["name"]: b for b in menge["books"]}

    conn = sqlite3.connect(OUT_DB)
    cur = conn.cursor()
    cur.executescript(
        """
        PRAGMA journal_mode=OFF;
        CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
        CREATE TABLE books (
            id INTEGER PRIMARY KEY,
            osis TEXT NOT NULL UNIQUE,
            name_de TEXT NOT NULL,
            testament TEXT NOT NULL,
            book_order INTEGER NOT NULL
        );
        CREATE TABLE verses (
            id INTEGER PRIMARY KEY,
            book_id INTEGER NOT NULL,
            chapter INTEGER NOT NULL,
            verse INTEGER NOT NULL,
            text TEXT NOT NULL,
            text_norm TEXT NOT NULL
        );
        CREATE TABLE uebers (
            id INTEGER PRIMARY KEY,
            book_id INTEGER NOT NULL,
            chapter INTEGER NOT NULL,
            verse INTEGER NOT NULL,
            translation TEXT NOT NULL,
            text TEXT NOT NULL
        );
        CREATE TABLE daily (
            id INTEGER PRIMARY KEY,
            day_of_year INTEGER NOT NULL,
            book_id INTEGER NOT NULL,
            chapter INTEGER NOT NULL,
            verse_von INTEGER NOT NULL,
            verse_bis INTEGER NOT NULL
        );
        CREATE TABLE topics (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            farbe TEXT NOT NULL
        );
        CREATE TABLE topic_verses (
            id INTEGER PRIMARY KEY,
            topic_id INTEGER NOT NULL,
            book_id INTEGER NOT NULL,
            chapter INTEGER NOT NULL,
            verse INTEGER NOT NULL
        );
        CREATE INDEX idx_verses_loc ON verses(book_id, chapter, verse);
        CREATE INDEX idx_uebers_loc ON uebers(book_id, chapter, verse, translation);
        CREATE INDEX idx_verses_norm ON verses(text_norm);
        """
    )

    osis_to_id = {}
    for idx, (osis, name_de, testament, luther_dir, en_name) in enumerate(BOOKS):
        book_id = idx + 1
        osis_to_id[osis] = book_id
        cur.execute(
            "INSERT INTO books (id, osis, name_de, testament, book_order) VALUES (?,?,?,?,?)",
            (book_id, osis, name_de, testament, book_id),
        )

    verse_pk = 1
    uebers_pk = 1
    print("Lade Luther 1912 (1189 Kapitel) und fuege Schlachter/Menge zusammen ...")
    for idx, (osis, name_de, testament, luther_dir, en_name) in enumerate(BOOKS):
        book_id = idx + 1
        n_chapters = CHAPTER_COUNT_BY_LUTHER_DIR[luther_dir]
        chapters = fetch_luther_book(osis, luther_dir, n_chapters)

        for ch in range(1, n_chapters + 1):
            for v in chapters.get(ch, []):
                try:
                    vnum = int(v["verse"])
                except (KeyError, ValueError):
                    continue
                text = v["text"].strip()
                cur.execute(
                    "INSERT INTO verses (id, book_id, chapter, verse, text, text_norm) VALUES (?,?,?,?,?,?)",
                    (verse_pk, book_id, ch, vnum, text, normalize_text(text)),
                )
                verse_pk += 1

        sch_book = sch_by_name.get(en_name)
        if sch_book:
            for chap in sch_book["chapters"]:
                for v in chap["verses"]:
                    cur.execute(
                        "INSERT INTO uebers (id, book_id, chapter, verse, translation, text) VALUES (?,?,?,?,?,?)",
                        (uebers_pk, book_id, chap["chapter"], v["verse"], "SCH1951", v["text"].strip()),
                    )
                    uebers_pk += 1

        menge_book = menge_by_name.get(en_name)
        if menge_book:
            for chap in menge_book["chapters"]:
                for v in chap["verses"]:
                    cur.execute(
                        "INSERT INTO uebers (id, book_id, chapter, verse, translation, text) VALUES (?,?,?,?,?,?)",
                        (uebers_pk, book_id, chap["chapter"], v["verse"], "MENGE1939", v["text"].strip()),
                    )
                    uebers_pk += 1

        print(f"  {name_de} ({osis}) fertig – {n_chapters} Kapitel")

    print(f"Insgesamt {verse_pk - 1} Luther-Verse, {uebers_pk - 1} Vergleichs-Verse.")

    print("Schreibe Vers-des-Tages-Liste ...")
    for i, (osis, chapter, v_von, v_bis) in enumerate(DAILY_VERSES):
        cur.execute(
            "INSERT INTO daily (id, day_of_year, book_id, chapter, verse_von, verse_bis) VALUES (?,?,?,?,?,?)",
            (i + 1, i + 1, osis_to_id[osis], chapter, v_von, v_bis),
        )

    print("Schreibe Themen (Erforschen-Chips) ...")
    topic_pk = 1
    tv_pk = 1
    for topic in TOPICS:
        cur.execute(
            "INSERT INTO topics (id, name, farbe) VALUES (?,?,?)",
            (topic_pk, topic["name"], topic["farbe"]),
        )
        for (osis, chapter, vers) in topic["verses"]:
            cur.execute(
                "INSERT INTO topic_verses (id, topic_id, book_id, chapter, verse) VALUES (?,?,?,?,?)",
                (tv_pk, topic_pk, osis_to_id[osis], chapter, vers),
            )
            tv_pk += 1
        topic_pk += 1

    cur.execute("INSERT INTO meta (key, value) VALUES ('schema_version', '1')")
    cur.execute("INSERT INTO meta (key, value) VALUES ('translations', 'LUT1912,SCH1951,MENGE1939')")
    cur.execute("INSERT INTO meta (key, value) VALUES ('build_source', 'wldeh/bible-api (Luther 1912), scrollmapper/bible_databases (Schlachter 1951, Menge 1939)')")

    conn.commit()
    conn.execute("VACUUM")
    conn.close()

    size_mb = os.path.getsize(OUT_DB) / (1024 * 1024)
    print(f"Fertig: {OUT_DB} ({size_mb:.1f} MB)")


if __name__ == "__main__":
    main()
