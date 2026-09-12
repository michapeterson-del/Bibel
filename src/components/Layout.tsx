import { NavLink, Outlet } from "react-router-dom";
import VerseDetailModal from "./VerseDetailModal";

const NAV_ITEMS = [
  { to: "/", label: "Start", icon: "🏠" },
  { to: "/lesen", label: "Lesen", icon: "📖" },
  { to: "/suche", label: "Suche", icon: "🔍" },
  { to: "/chat", label: "Chat", icon: "💬" },
  { to: "/einstellungen", label: "Mehr", icon: "⚙️" },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <main className="app-main">
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
