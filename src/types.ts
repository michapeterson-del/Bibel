export type Translation = "LUT1912" | "SCH1951" | "MENGE1939";

export interface BookMeta {
  id: number;
  osis: string;
  name_de: string;
  testament: "AT" | "NT";
  book_order: number;
}

export interface VerseRef {
  osis: string;
  bookName: string;
  chapter: number;
  verse: number;
}

export interface VerseRow extends VerseRef {
  text: string;
}

export type LesezeichenTyp = "lesezeichen" | "markierung" | "notiz";
export type Farbe = "gelb" | "gruen" | "blau" | "rosa" | "lila";

export interface LesezeichenEintrag {
  id: string;
  typ: LesezeichenTyp;
  uebersetzung: Translation;
  buch: string; // OSIS
  kapitel: number;
  vers_von: number;
  vers_bis: number;
  farbe: Farbe;
  notiz?: string;
  name?: string;
  tags: string[];
  erstellt_am: string;
  geaendert_am: string;
}

export interface LesezeichenExport {
  schema_version: 1;
  lesezeichen: LesezeichenEintrag[];
}

export type Klarheitsstufe = "kurz" | "normal" | "ausfuehrlich";
export type AiProvider = "anthropic" | "openai" | "gemini" | "deepseek" | "aus";
export type ChatModus = "bibel" | "alltag";

export interface Bibelstelle {
  referenz: string;
  warum_relevant: string;
}

export type Einordnung = "klar" | "auslegungsfrage" | "keine_biblische_aussage" | "alltag";

export interface AiAntwort {
  kurzantwort: string;
  bibelstellen: Bibelstelle[];
  erklaerung: string;
  einordnung: Einordnung;
  konfessionell_umstritten: boolean;
  naechster_schritt: string;
  warnung?: string;
}

export interface ChatMessage {
  id: string;
  rolle: "user" | "assistant";
  text: string;
  antwort?: AiAntwort;
  erstellt_am: string;
}

export interface ChatGespraech {
  id: string;
  titel: string;
  modus: ChatModus;
  nachrichten: ChatMessage[];
  erstellt_am: string;
  geaendert_am: string;
}

export interface Einstellungen {
  profilName: string;
  profilTelefon: string;
  darkMode: "system" | "hell" | "dunkel";
  schriftgroesse: "klein" | "normal" | "gross";
  zeilenabstand: "eng" | "normal" | "locker";
  standardUebersetzung: Translation;
  versnummernAn: boolean;
  klarheitsstufe: Klarheitsstufe;
  konfessionelleVarianten: boolean;
  aiProvider: AiProvider;
  aiModell: string;
  streakAn: boolean;
  streakFreezeAn: boolean;
  tagesErinnerungAn: boolean;
  tagesErinnerungZeit: string;
  lernErinnerungAn: boolean;
  lernErinnerungZeit: string;
}

export interface LeseFortschritt {
  osis: string;
  kapitel: number;
  vers: number;
  uebersetzung: Translation;
  aktualisiert_am: string;
}

export interface StreakTag {
  datum: string; // YYYY-MM-DD
  minuten: number;
}

export interface StreakStatus {
  tage: StreakTag[];
  freezesVerfuegbar: number;
  laengsteSerie: number;
}

export interface LernVers {
  id: string;
  osis: string;
  kapitel: number;
  vers: number;
  uebersetzung: Translation;
  gewusstCount: number;
  gelernt: boolean;
  erstellt_am: string;
}

export interface AntwortFeedback {
  id: string;
  chatId: string;
  nachrichtId: string;
  bewertung: "positiv" | "negativ";
  grund?: string;
  erstellt_am: string;
}

// ---------- BibelSpiele ----------

export type QuizStufe = "lehrling" | "erwachsener" | "diakon" | "gemeindeleiter";
export type QuizTyp = "single" | "multi" | "wahrfalsch" | "zahl" | "orden";

export interface QuizBeleg {
  osis: string;
  bookName: string;
  kapitel: number;
  versVon: number;
  versBis: number;
}

export interface QuizFrage {
  id: string;
  stufe: QuizStufe;
  typ: QuizTyp;
  frage: string;
  optionen: string[] | null;
  richtig: string | string[];
  beleg: QuizBeleg;
  erklaerung: string;
}

export interface QuizSpieler {
  name: string;
  punkte: number;
}

export interface QuizSpielleiterErgebnis {
  datum: string;
  stufe: QuizStufe;
  spieler: QuizSpieler[];
}
