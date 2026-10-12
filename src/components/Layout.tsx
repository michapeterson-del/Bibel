import { NavLink, Outlet, useLocation } from "react-router-dom";
import VerseDetailModal from "./VerseDetailModal";

const NAV_ITEMS = [
  { to: "/", label: "Start", icon: "🏠" },
  { to: "/lesen", label: "Lesen", icon: "📖" },
  { to: "/suche", label: "Suche", icon: "🔍" },
  { to: "/chat", label: "Chat", icon: "💬" },
  { to: "/einstellungen", label: "Mehr", icon: "⚙️" },
];

export default function Layout() {
  const location = useLocation();
  // Nur am obersten Pfadsegment festmachen (z.B. "lesen", "chat"), NICHT am
  // kompletten Pfad: sonst wuerde z.B. jeder Kapitelwechsel im Lese-Bildschirm
  // (/lesen/:osis/:kapitel) die ganze Seite neu mounten und damit den
  // laufenden Vorlese-Zustand (Audio, Vorab-Laden usw.) zerstoeren - den
  // Umblaetter-Effekt dafuer uebernimmt ReaderScreen bereits selbst.
  const bereich = location.pathname.split("/")[1] || "start";
  return (
    <div className="app-shell">
      <main className="app-main kapitel-blaettern" key={bereich}>
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            <span style={{ fontSize: "1.15rem" }}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <VerseDetailModal />
    </div>
  );
}
