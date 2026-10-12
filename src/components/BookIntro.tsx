import { useEffect, useState } from "react";

const DECKEL_DAUER = 650;
const GESAMT_DAUER = 1250;

export default function BookIntro() {
  const [oeffnetSich, setOeffnetSich] = useState(false);
  const [fertig, setFertig] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setOeffnetSich(true), DECKEL_DAUER);
    const t2 = setTimeout(() => setFertig(true), GESAMT_DAUER);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (fertig) return null;

  return (
    <div className="book-intro-overlay" aria-hidden="true">
      <div className={`book-intro-cover ${oeffnetSich ? "book-intro-cover--offen" : ""}`}>
        <span className="book-intro-title">Amibel</span>
        <span className="book-intro-subtitle">Die Bibel</span>
      </div>
    </div>
  );
}
