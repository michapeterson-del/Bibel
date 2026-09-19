import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDailyVerse, getChapterCountsAllBooks, type DailyVerseInfo } from "../lib/db/bibleDb";
import { getCurrentStreakCount, getSettings, listChats, listLesezeichen, listStilleZeit } from "../lib/db/userDb";
import { anzahlGeleseneKapitel, createChat, getGeleseneKapitel, saveChat } from "../lib/db/userDb";
import type { ChatGespraech } from "../types";
import { useVerseDetail } from "../lib/VerseDetailContext";

function greeting(name: string): string {
  const h = new Date().getHours();
  const base = h < 11 ? "Guten Morgen" : h < 18 ? "Guten Tag" : "Guten Abend";
  return name ? `${base}, ${name}` : base;
}

const TILES = [
  { to: "/lesen", titel: "Bibel lesen", sub: "Weiterlesen", bg: "var(--bibel-bg)", fg: "var(--bibel-fg)" },
  { to: "/suche", titel: "Eine Stelle finden", sub: "Volltextsuche", bg: "var(--blau-weich-bg)", fg: "var(--blau-weich-fg)" },
  { to: "/spiele", titel: "BibelSpiele", sub: "Quiz, Tabu, Spion", bg: "var(--lavendel-bg)", fg: "var(--lavendel-fg)" },
  { to: "/lernen", titel: "Bibelverse lernen", sub: "Merkverse üben", bg: "var(--blau-hell-bg)", fg: "var(--blau-hell-fg)" },
  { to: "/erforschen", titel: "Erforschen", sub: "Themen-Aufsätze", bg: "var(--salbei-bg)", fg: "var(--salbei-fg)" },
];

export default function HomeScreen() {
  const navigate = useNavigate();
  const { open: openVerseDetail } = useVerseDetail();
  const [name, setName] = useState("");
  const [daily, setDaily] = useState<DailyVerseInfo | null>(null);
  const [streak, setStreak] = useState(0);
  const [recentChats, setRecentChats] = useState<ChatGespraech[]>([]);
  const [fortschritt, setFortschritt] = useState<{ gelesen: number; gesamt: number } | null>(null);
  const [stilleZeitAnzahl, setStilleZeitAnzahl] = useState(0);
  const [markierungenAnzahl, setMarkierungenAnzahl] = useState(0);

  useEffect(() => {
    getSettings().then((s) => setName(s.profilName));
    getDailyVerse().then(setDaily);
    getCurrentStreakCount().then(setStreak);
    listChats().then((chats) => setRecentChats(chats.slice(0, 3)));
    Promise.all([getChapterCountsAllBooks(), getGeleseneKapitel()]).then(([counts, gelesen]) => {
      const gesamt = Object.values(counts).reduce((s, n) => s + n, 0);
      setFortschritt({ gelesen: anzahlGeleseneKapitel(gelesen), gesamt });
    });
    listStilleZeit().then((all) => setStilleZeitAnzahl(all.length));
    listLesezeichen().then((all) => setMarkierungenAnzahl(all.filter((i) => i.typ === "markierung").length));
  }, []);

  async function startChat(modus: "alltag" | "bibel", titel: string) {
    const chat = await createChat(modus, titel);
    await saveChat(chat);
    navigate(`/chat/${chat.id}`);
  }

  return (
    <div>
      <div className="header-bar" style={{ paddingTop: 8 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem" }}>Amibel</h1>
          <p style={{ margin: 0, color: "var(--text-muted)" }}>{greeting(name)}</p>
        </div>
      </div>

      <button
        className="tile"
        style={{ background: "var(--rose-bg)", color: "var(--rose-fg)", marginBottom: 14 }}
        onClick={() => startChat("alltag", "Etwas beschäftigt mich")}
      >
        <span className="tile-title">Etwas beschäftigt mich</span>
        <span className="tile-sub">Alltagsfragen, Rat und ein offenes Ohr</span>
      </button>

      <div className="tile-grid">
        <button
          className="tile"
          style={{ background: "var(--gelb-bg)", color: "var(--gelb-fg)" }}
          onClick={() => startChat("bibel", "Einen Vers verstehen")}
        >
          <span className="tile-title">Einen Vers verstehen</span>
          <span className="tile-sub">Frag nach einer Stelle</span>
        </button>
        {TILES.map((t) => (
          <button
            key={t.titel}
            className="tile"
            style={{ background: t.bg, color: t.fg }}
            onClick={() => navigate(t.to)}
          >
            <span className="tile-title">{t.titel}</span>
            <span className="tile-sub">{t.sub}</span>
          </button>
        ))}
      </div>

      {daily && (
        <div className="card" style={{ marginTop: 16, background: "var(--bibel-bg)", borderColor: "transparent" }}>
          <p style={{ margin: "0 0 6px", fontWeight: 700, color: "var(--bibel-fg)" }}>Vers des Tages</p>
          <p
            style={{ margin: "0 0 8px", color: "var(--bibel-fg)", cursor: "pointer" }}
            onClick={() =>
              openVerseDetail({
                osis: daily.osis,
                bookName: daily.bookName,
                chapter: daily.chapter,
                verseVon: daily.verse,
                verseBis: daily.verse,
              })
            }
          >
            „{daily.text}"
          </p>
          <p style={{ margin: 0, color: "var(--bibel-fg)", fontWeight: 600 }}>
            {daily.bookName} {daily.chapter},{daily.verse}
          </p>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <p style={{ margin: 0 }}>🔥 Serie: {streak} {streak === 1 ? "Tag" : "Tage"}</p>
      </div>

      {fortschritt && (
        <div
          className="card"
          style={{ marginTop: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          onClick={() => navigate("/fortschritt")}
        >
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0 }}>
              📖 Lesefortschritt: {fortschritt.gelesen}/{fortschritt.gesamt} Kapitel
              {fortschritt.gesamt > 0 && ` (${Math.round((fortschritt.gelesen / fortschritt.gesamt) * 100)}%)`}
            </p>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3, marginTop: 6, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${fortschritt.gesamt > 0 ? (fortschritt.gelesen / fortschritt.gesamt) * 100 : 0}%`,
                  background: "var(--salbei-fg)",
                }}
              />
            </div>
          </div>
          <span style={{ marginLeft: 10, color: "var(--text-muted)" }}>›</span>
        </div>
      )}

      {stilleZeitAnzahl > 0 && (
        <div
          className="card"
          style={{ marginTop: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          onClick={() => navigate("/stillezeit")}
        >
          <p style={{ margin: 0 }}>
            📝 Meine Stille Zeit: {stilleZeitAnzahl} {stilleZeitAnzahl === 1 ? "Eintrag" : "Einträge"}
          </p>
          <span style={{ color: "var(--text-muted)" }}>›</span>
        </div>
      )}

      {markierungenAnzahl > 0 && (
        <div
          className="card"
          style={{ marginTop: 10, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          onClick={() => navigate("/markierungen")}
        >
          <p style={{ margin: 0 }}>
            🖍 Meine Markierungen: {markierungenAnzahl} {markierungenAnzahl === 1 ? "Vers" : "Verse"}
          </p>
          <span style={{ color: "var(--text-muted)" }}>›</span>
        </div>
      )}

      {recentChats.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h3>Zuletzt</h3>
          {recentChats.map((c) => (
            <div key={c.id} className="card" style={{ marginBottom: 8, cursor: "pointer" }} onClick={() => navigate(`/chat/${c.id}`)}>
              <p style={{ margin: 0, fontWeight: 600 }}>{c.titel}</p>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-muted)" }}>
                {c.nachrichten.at(-1)?.text.slice(0, 80) ?? "Noch keine Nachrichten"}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
