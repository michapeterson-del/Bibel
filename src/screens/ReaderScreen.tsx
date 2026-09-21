import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { BookMeta, Farbe, FarbLabels, LesezeichenEintrag, VerseRow } from "../types";
import {
  getAllBooks,
  getBookByOsis,
  getChapterCount,
  getChapterVerses,
} from "../lib/db/bibleDb";
import {
  addAktivMinuten,
  getFarbLabels,
  getLeseFortschritt,
  istKapitelGelesen,
  kvGet,
  listLesezeichen,
  saveLeseFortschritt,
  setKapitelGelesen,
} from "../lib/db/userDb";
import { useSettings } from "../lib/SettingsContext";
import { useVerseDetail } from "../lib/VerseDetailContext";
import { decryptSecret } from "../lib/crypto";
import { chunkText, synthesize } from "../lib/tts/elevenlabs";
import TranslationSwitch from "../components/TranslationSwitch";
import BookPickerModal from "../components/BookPickerModal";

type VorlesenStatus = "aus" | "laedt" | "spielt" | "pausiert";

const FARBE_HEX: Record<Farbe, string> = {
  gelb: "#EFE5BC",
  gruen: "#B2D2C2",
  blau: "#ABC6E4",
  rosa: "#E6BAC5",
  lila: "#D3B4CC",
};

export default function ReaderScreen() {
  const { osis: osisParam, kapitel: kapitelParam } = useParams();
  const navigate = useNavigate();
  const { settings, update } = useSettings();
  const { open: openVerseDetail, marksVersion } = useVerseDetail();

  const [book, setBook] = useState<BookMeta | null>(null);
  const [chapter, setChapter] = useState<number>(kapitelParam ? parseInt(kapitelParam, 10) : 1);
  const [chapterCount, setChapterCount] = useState(0);
  const [verses, setVerses] = useState<VerseRow[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [marks, setMarks] = useState<LesezeichenEintrag[]>([]);
  const [fertigMsg, setFertigMsg] = useState(false);
  const [farbLabels, setFarbLabels] = useState<FarbLabels | null>(null);

  const [vorlesenStatus, setVorlesenStatus] = useState<VorlesenStatus>("aus");
  const [vorlesenFehler, setVorlesenFehler] = useState("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlsRef = useRef<string[]>([]);
  const audioIndexRef = useRef(0);
  // true, waehrend ein automatischer Kapitelwechsel läuft, damit die
  // laufende Wiedergabe dabei nicht durch den Kapitelwechsel-Cleanup gestoppt wird
  const autoWeiterRef = useRef(false);

  useEffect(() => {
    getFarbLabels().then(setFarbLabels);
  }, []);

  function vorlesenStoppen() {
    audioRef.current?.pause();
    audioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    audioUrlsRef.current = [];
    audioIndexRef.current = 0;
    autoWeiterRef.current = false;
    setVorlesenStatus("aus");
  }

  useEffect(() => {
    // Bei einem manuell ausgeloesten Kapitelwechsel laufende Wiedergabe beenden;
    // beim automatischen Weiterlesen (naechstes Kapitel) läuft sie einfach weiter
    return () => {
      if (!autoWeiterRef.current) vorlesenStoppen();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, chapter]);

  async function naechstesKapitelBestimmen(): Promise<{ osis: string; chapter: number } | null> {
    if (!book) return null;
    if (chapter < chapterCount) return { osis: book.osis, chapter: chapter + 1 };
    const books = await getAllBooks();
    const idx = books.findIndex((b) => b.osis === book.osis);
    const naechstesBuch = idx >= 0 ? books[idx + 1] : undefined;
    return naechstesBuch ? { osis: naechstesBuch.osis, chapter: 1 } : null;
  }

  async function kapitelEndeErreicht() {
    const next = await naechstesKapitelBestimmen();
    if (!next || !book) {
      setVorlesenStatus("aus");
      return;
    }
    audioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    audioUrlsRef.current = [];
    audioIndexRef.current = 0;
    autoWeiterRef.current = true;
    if (next.osis === book.osis) {
      setChapter(next.chapter);
      navigate(`/lesen/${book.osis}/${next.chapter}`, { replace: true });
      return;
    }
    const nb = await getBookByOsis(next.osis);
    if (!nb) {
      autoWeiterRef.current = false;
      setVorlesenStatus("aus");
      return;
    }
    setBook(nb);
    setChapter(next.chapter);
    navigate(`/lesen/${next.osis}/${next.chapter}`, { replace: true });
  }

  function spieleChunk(index: number) {
    const audio = audioRef.current;
    if (!audio || index >= audioUrlsRef.current.length) {
      kapitelEndeErreicht();
      return;
    }
    audioIndexRef.current = index;
    audio.src = audioUrlsRef.current[index];
    audio.play().catch(() => setVorlesenFehler("Wiedergabe konnte nicht gestartet werden."));
    setVorlesenStatus("spielt");
  }

  async function starteFrischeWiedergabe() {
    setVorlesenFehler("");
    if (!settings?.elevenlabsVoiceId) {
      setVorlesenFehler("Keine ElevenLabs-Stimme eingerichtet. Öffne Einstellungen → Vorlesen.");
      setVorlesenStatus("aus");
      return;
    }
    const enc = await kvGet<string>("api_key_elevenlabs");
    const apiKey = enc ? await decryptSecret(enc) : "";
    if (!apiKey) {
      setVorlesenFehler("Kein ElevenLabs-API-Schlüssel hinterlegt. Öffne Einstellungen → Vorlesen.");
      setVorlesenStatus("aus");
      return;
    }
    setVorlesenStatus("laedt");
    try {
      const chunks = chunkText(verses.map((v) => v.text));
      const urls: string[] = [];
      for (const chunk of chunks) {
        const blob = await synthesize(apiKey, settings.elevenlabsVoiceId, chunk);
        urls.push(URL.createObjectURL(blob));
      }
      audioUrlsRef.current = urls;
      spieleChunk(0);
    } catch (e) {
      setVorlesenFehler(e instanceof Error ? e.message : "Vorlesen ist fehlgeschlagen.");
      setVorlesenStatus("aus");
    }
  }

  async function vorlesenStarten() {
    if (vorlesenStatus === "spielt") {
      audioRef.current?.pause();
      setVorlesenStatus("pausiert");
      return;
    }
    if (vorlesenStatus === "pausiert") {
      audioRef.current?.play().catch(() => setVorlesenFehler("Wiedergabe konnte nicht gestartet werden."));
      setVorlesenStatus("spielt");
      return;
    }
    await starteFrischeWiedergabe();
  }

  // Nach einem automatischen Kapitelwechsel: sobald die Verse des neuen
  // Kapitels geladen sind, Vorlesen dort nahtlos fortsetzen
  useEffect(() => {
    if (!autoWeiterRef.current || verses.length === 0) return;
    autoWeiterRef.current = false;
    starteFrischeWiedergabe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verses]);

  // Initiales Buch/Kapitel bestimmen: aus URL, sonst Lesefortschritt, sonst Johannes 1
  useEffect(() => {
    (async () => {
      if (osisParam) {
        const b = await getBookByOsis(osisParam);
        if (b) {
          setBook(b);
          setChapter(kapitelParam ? parseInt(kapitelParam, 10) : 1);
          return;
        }
      }
      const progress = await getLeseFortschritt();
      if (progress) {
        const b = await getBookByOsis(progress.osis);
        if (b) {
          setBook(b);
          setChapter(progress.kapitel);
          return;
        }
      }
      const books = await getAllBooks();
      const john = books.find((b) => b.osis === "JHN");
      setBook(john ?? books[0]);
      setChapter(1);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osisParam, kapitelParam]);

  useEffect(() => {
    if (!book) return;
    getChapterCount(book.osis).then(setChapterCount);
  }, [book]);

  useEffect(() => {
    if (!book || !settings) return;
    getChapterVerses(book.osis, chapter, settings.standardUebersetzung).then(setVerses);
    saveLeseFortschritt({ osis: book.osis, kapitel: chapter, vers: 1, uebersetzung: settings.standardUebersetzung });
    istKapitelGelesen(book.osis, chapter).then(setFertigMsg);
  }, [book, chapter, settings?.standardUebersetzung]);

  useEffect(() => {
    if (!book) return;
    listLesezeichen().then((all) =>
      setMarks(all.filter((m) => m.buch === book.osis && m.kapitel === chapter))
    );
  }, [book, chapter, marksVersion]);

  if (!book || !settings) return <p>Lädt…</p>;

  function goChapter(delta: number) {
    const next = chapter + delta;
    if (next < 1 || next > chapterCount) return;
    setChapter(next);
    navigate(`/lesen/${book!.osis}/${next}`, { replace: true });
  }

  function markForVerse(verseNum: number) {
    return marks.find(
      (m) => m.typ !== "notiz" && verseNum >= m.vers_von && verseNum <= m.vers_bis
    );
  }

  function notizFuerVerse(verseNum: number) {
    return marks.find(
      (m) => m.typ === "notiz" && verseNum >= m.vers_von && verseNum <= m.vers_bis
    );
  }

  async function kapitelFertig() {
    const neuerStatus = !fertigMsg;
    await setKapitelGelesen(book!.osis, chapter, neuerStatus);
    if (neuerStatus) {
      await addAktivMinuten(5);
      setFertigMsg(neuerStatus);
      navigate(`/stillezeit/${book!.osis}/${chapter}`);
      return;
    }
    setFertigMsg(neuerStatus);
  }

  return (
    <div>
      <div className="header-bar" style={{ paddingTop: 8, flexWrap: "wrap" }}>
        <button className="chip" onClick={() => setShowPicker(true)} style={{ fontWeight: 700 }}>
          {book.name_de} {chapter} ▾
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
          <button className="chip" onClick={() => navigate(`/stillezeit/kapitel/${book.osis}/${chapter}`)}>
            📋 Einträge
          </button>
          <button className="icon-btn" onClick={() => goChapter(-1)} disabled={chapter <= 1}>‹</button>
          <button className="icon-btn" onClick={() => goChapter(1)} disabled={chapter >= chapterCount}>›</button>
        </div>
      </div>

      <TranslationSwitch value={settings.standardUebersetzung} onChange={(t) => update({ standardUebersetzung: t })} />

      <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="chip" onClick={vorlesenStarten} disabled={vorlesenStatus === "laedt"}>
          {vorlesenStatus === "laedt" && "⏳ Bereite Vorlesen vor…"}
          {vorlesenStatus === "spielt" && "⏸ Pause"}
          {vorlesenStatus === "pausiert" && "▶︎ Weiter"}
          {vorlesenStatus === "aus" && "🔊 Vorlesen"}
        </button>
        {vorlesenStatus !== "aus" && (
          <button className="icon-btn" onClick={vorlesenStoppen} aria-label="Vorlesen stoppen">⏹</button>
        )}
      </div>
      {vorlesenFehler && (
        <p style={{ color: "var(--lila-fg)", fontSize: "0.82rem", marginTop: 4 }}>
          {vorlesenFehler}
          {vorlesenFehler.includes("Einstellungen") && (
            <>
              {" "}
              <button className="chip" onClick={() => navigate("/einstellungen")} style={{ marginLeft: 6 }}>
                Zu den Einstellungen
              </button>
            </>
          )}
        </p>
      )}
      <audio
        ref={audioRef}
        onEnded={() => spieleChunk(audioIndexRef.current + 1)}
        style={{ display: "none" }}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 10, marginBottom: 10 }}>
        <select
          value={settings.schriftgroesse}
          onChange={(e) => update({ schriftgroesse: e.target.value as typeof settings.schriftgroesse })}
          style={{ width: "auto" }}
        >
          <option value="klein">Klein</option>
          <option value="normal">Normal</option>
          <option value="gross">Groß</option>
        </select>
        <select
          value={settings.zeilenabstand}
          onChange={(e) => update({ zeilenabstand: e.target.value as typeof settings.zeilenabstand })}
          style={{ width: "auto" }}
        >
          <option value="eng">Eng</option>
          <option value="normal">Normal</option>
          <option value="locker">Locker</option>
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.85rem" }}>
          <input
            type="checkbox"
            checked={settings.versnummernAn}
            onChange={(e) => update({ versnummernAn: e.target.checked })}
          />
          Versnummern
        </label>
      </div>

      <div
        className="card"
        style={{ fontSize: "var(--base-font-size)", lineHeight: "var(--base-line-height)" }}
      >
        {verses.map((v) => {
          const mark = markForVerse(v.verse);
          const istMarkierung = mark?.typ === "markierung";
          const istLesezeichen = mark?.typ === "lesezeichen";
          const notiz = notizFuerVerse(v.verse);
          return (
            <span
              key={v.verse}
              className={`verse-row ${mark ? "marked" : ""}`}
              title={istMarkierung ? farbLabels?.[mark!.farbe] : undefined}
              style={{
                display: "inline",
                background: istMarkierung ? FARBE_HEX[mark!.farbe] : undefined,
                color: istMarkierung ? "#332f1a" : undefined,
                boxDecorationBreak: istMarkierung ? "clone" : undefined,
                WebkitBoxDecorationBreak: istMarkierung ? "clone" : undefined,
                cursor: "pointer",
              }}
              onClick={() =>
                openVerseDetail({
                  osis: book.osis,
                  bookName: book.name_de,
                  chapter,
                  verseVon: v.verse,
                  verseBis: v.verse,
                })
              }
            >
              {settings.versnummernAn && <sup className="verse-num">{v.verse}</sup>}
              {istLesezeichen && <span title="Lesezeichen" style={{ marginRight: 2 }}>⭐</span>}
              {v.text}
              {notiz && (
                <span title={notiz.notiz} style={{ marginLeft: 3, marginRight: 3 }}>
                  ✏️
                </span>
              )}
              {" "}
            </span>
          );
        })}
      </div>

      <button
        className={fertigMsg ? "btn" : "btn secondary"}
        style={{ width: "100%", marginTop: 14 }}
        onClick={kapitelFertig}
      >
        {fertigMsg ? "✓ Kapitel fertig gelesen" : "Als gelesen markieren"}
      </button>

      {showPicker && (
        <BookPickerModal
          onClose={() => setShowPicker(false)}
          onSelect={(osis, ch) => {
            setShowPicker(false);
            navigate(`/lesen/${osis}/${ch}`);
          }}
        />
      )}
    </div>
  );
}
