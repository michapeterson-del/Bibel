import type { ReactElement } from "react";

type NavIconName = "start" | "lesen" | "suche" | "chat" | "mehr";

const PFADE: Record<NavIconName, ReactElement> = {
  start: (
    <>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-6h4v6h3a1 1 0 0 0 1-1v-9" />
    </>
  ),
  lesen: (
    <>
      <path d="M12 6c-1.8-1.3-4.2-2-7-2v13c2.8 0 5.2.7 7 2" />
      <path d="M12 6c1.8-1.3 4.2-2 7-2v13c-2.8 0-5.2.7-7 2" />
      <path d="M12 6v13" />
    </>
  ),
  suche: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </>
  ),
  chat: <path d="M4 5h16v10H9l-4 4v-4H4z" />,
  mehr: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.6M12 18.4V21M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M3 12h2.6M18.4 12H21M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
    </>
  ),
};

/** Schlichte Linien-Icons fuer die untere Navigation, statt Emojis. */
export default function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="21"
      height="21"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PFADE[name]}
    </svg>
  );
}
