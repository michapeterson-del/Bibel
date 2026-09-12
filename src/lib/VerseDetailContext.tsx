import { createContext, useContext, useState, type ReactNode } from "react";

export interface VerseDetailTarget {
  osis: string;
  bookName: string;
  chapter: number;
  verseVon: number;
  verseBis: number;
}

interface Ctx {
  target: VerseDetailTarget | null;
  open: (t: VerseDetailTarget) => void;
  close: () => void;
}

const VerseDetailCtx = createContext<Ctx | null>(null);

export function VerseDetailProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<VerseDetailTarget | null>(null);
  return (
    <VerseDetailCtx.Provider value={{ target, open: setTarget, close: () => setTarget(null) }}>
      {children}
    </VerseDetailCtx.Provider>
  );
}

export function useVerseDetail() {
  const ctx = useContext(VerseDetailCtx);
  if (!ctx) throw new Error("useVerseDetail muss innerhalb von VerseDetailProvider verwendet werden.");
  return ctx;
}
