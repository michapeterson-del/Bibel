import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./styles/global.css";
import App from "./App.tsx";
import { SettingsProvider } from "./lib/SettingsContext.tsx";
import { VerseDetailProvider } from "./lib/VerseDetailContext.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <SettingsProvider>
        <VerseDetailProvider>
          <App />
        </VerseDetailProvider>
      </SettingsProvider>
    </HashRouter>
  </StrictMode>
);
