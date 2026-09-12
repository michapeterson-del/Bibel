export default function ComingSoonScreen({ titel }: { titel: string }) {
  return (
    <div>
      <div className="header-bar" style={{ paddingTop: 8 }}>
        <h1 style={{ fontSize: "1.3rem" }}>{titel}</h1>
      </div>
      <div className="card">
        <p style={{ margin: 0 }}>
          {titel} ist in dieser ersten Ausbaustufe von Amibel-Web noch nicht enthalten. Lesen,
          Suchen, Lesezeichen, KI-Chat und Erforschen funktionieren bereits vollständig – {titel}{" "}
          folgt in einer der nächsten Ausbaustufen.
        </p>
      </div>
    </div>
  );
}
