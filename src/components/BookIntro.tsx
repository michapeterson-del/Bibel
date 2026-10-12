import { useState } from "react";

export default function BookIntro() {
  const [oeffnetSich, setOeffnetSich] = useState(false);
  const [fertig, setFertig] = useState(false);

  if (fertig) return null;

  return (
    <div className="book-intro-overlay">
      <button
        type="button"
        className={`book-intro-cover ${oeffnetSich ? "book-intro-cover--offen" : ""}`}
        aria-label="Buch öffnen"
        onClick={() => setOeffnetSich(true)}
        onTransitionEnd={(e) => {
          if (e.propertyName === "opacity" && oeffnetSich) setFertig(true);
        }}
      >
        <span className="book-intro-title">Amibel</span>
        <span className="book-intro-subtitle">Die Bibel</span>
        {!oeffnetSich && <span className="book-intro-hint">Zum Öffnen tippen</span>}
      </button>
    </div>
  );
}
