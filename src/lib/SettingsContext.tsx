import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Einstellungen } from "../types";
import { getSettings, saveSettings as persistSettings } from "./db/userDb";

interface SettingsContextValue {
  settings: Einstellungen | null;
  update: (patch: Partial<Einstellungen>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function applyThemeAndTypography(settings: Einstellungen) {
  const root = document.documentElement;
  if (settings.darkMode === "hell") root.setAttribute("data-theme", "light");
  else if (settings.darkMode === "dunkel") root.setAttribute("data-theme", "dark");
  else root.removeAttribute("data-theme");

  root.style.setProperty(
    "--base-font-size",
    settings.schriftgroesse === "klein" ? "15px" : settings.schriftgroesse === "gross" ? "19px" : "17px"
  );
  root.style.fontSize = root.style.getPropertyValue("--base-font-size");

  root.style.setProperty(
    "--base-line-height",
    settings.zeilenabstand === "eng" ? "1.35" : settings.zeilenabstand === "locker" ? "1.75" : "1.55"
  );
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Einstellungen | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setSettings(s);
      applyThemeAndTypography(s);
    });
  }, []);

  async function update(patch: Partial<Einstellungen>) {
    const next = await persistSettings(patch);
    setSettings(next);
    applyThemeAndTypography(next);
  }

  return <SettingsContext.Provider value={{ settings, update }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings muss innerhalb von SettingsProvider verwendet werden.");
  return ctx;
}
