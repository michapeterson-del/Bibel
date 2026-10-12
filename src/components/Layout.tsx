import { useRef } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import VerseDetailModal from "./VerseDetailModal";
import NavIcon from "./NavIcons";
import { flipPage, hauptbereichRef } from "../lib/pageFlip";

const NAV_ITEMS = [
  { to: "/", label: "Start", icon: "start" as const },
  { to: "/lesen", label: "Lesen", icon: "lesen" as const },
  { to: "/suche", label: "Suche", icon: "suche" as const },
  { to: "/chat", label: "Chat", icon: "chat" as const },
  { to: "/einstellungen", label: "Mehr", icon: "mehr" as const },
];

function bereichsIndex(pathname: string): number {
  const gefunden = [...NAV_ITEMS]
    .map((item, i) => ({ item, i }))
    .reverse()
    .find(({ item }) => (item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)));
  return gefunden ? gefunden.i : 0;
}

export default function Layout() {
  const location = useLocation();
  const mainRef = useRef<HTMLElement | null>(null);
  const aktiverIndex = bereichsIndex(location.pathname);

  return (
    <div className="app-shell">
      <main
        className="app-main"
        ref={(el) => {
          mainRef.current = el;
          hauptbereichRef.current = el;
        }}
      >
        <Outlet />
      </main>
      <nav className="bottom-nav">
        {NAV_ITEMS.map((item, i) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => (isActive ? "active" : "")}
            onClick={() => {
              if (i !== aktiverIndex) flipPage(mainRef.current, i > aktiverIndex ? "vor" : "zurueck");
            }}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <VerseDetailModal />
    </div>
  );
}
