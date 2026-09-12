import { useEffect, useState } from "react";
import type { BookMeta } from "../types";
import { getAllBooks, getChapterCount } from "../lib/db/bibleDb";

export default function BookPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (osis: string, chapter: number) => void;
  onClose: () => void;
}) {
  const [books, setBooks] = useState<BookMeta[]>([]);
  const [testament, setTestament] = useState<"AT" | "NT">("AT");
  const [selectedBook, setSelectedBook] = useState<BookMeta | null>(null);
  const [chapterCount, setChapterCount] = useState(0);

  useEffect(() => {
    getAllBooks().then(setBooks);
  }, []);

  useEffect(() => {
    if (selectedBook) getChapterCount(selectedBook.osis).then(setChapterCount);
  }, [selectedBook]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{selectedBook ? selectedBook.name_de : "Buch wählen"}</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>

        {!selectedBook && (
          <>
            <div className="chip-row" style={{ margin: "10px 0" }}>
              <button className={`chip ${testament === "AT" ? "active" : ""}`} onClick={() => setTestament("AT")}>
                Altes Testament
              </button>
              <button className={`chip ${testament === "NT" ? "active" : ""}`} onClick={() => setTestament("NT")}>
                Neues Testament
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {books
                .filter((b) => b.testament === testament)
                .map((b) => (
                  <button key={b.osis} className="chip" style={{ justifyContent: "flex-start" }} onClick={() => setSelectedBook(b)}>
                    {b.name_de}
                  </button>
                ))}
            </div>
          </>
        )}

        {selectedBook && (
          <>
            <button className="chip" onClick={() => setSelectedBook(null)} style={{ marginBottom: 10 }}>
              ← Andere Bücher
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
              {Array.from({ length: chapterCount }, (_, i) => i + 1).map((ch) => (
                <button
                  key={ch}
                  className="chip"
                  style={{ justifyContent: "center" }}
                  onClick={() => onSelect(selectedBook.osis, ch)}
                >
                  {ch}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
