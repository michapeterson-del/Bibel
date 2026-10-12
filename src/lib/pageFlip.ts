import { useCallback } from "react";
import { useNavigate, type NavigateOptions, type To } from "react-router-dom";

export type FlipRichtung = "vor" | "zurueck";

// Haupt-Inhaltsbereich (<main> in Layout.tsx) - wird dort per ref gesetzt, damit
// von ueberall im Baum (ohne Context-Gefrickel, es gibt nur ein Layout) ein
// Umblaettern auf dem sichtbaren Bereich ausgeloest werden kann.
export const hauptbereichRef: { current: HTMLElement | null } = { current: null };

/**
 * Simuliert ein echtes Umblaettern: klont den aktuell sichtbaren Ausschnitt von
 * `container`, legt den Klon als fixiertes Blatt obendrauf und dreht ihn per
 * CSS-3D-Transform wie eine Buchseite weg, waehrend der echte Inhalt darunter
 * schon auf den neuen Zustand aktualisiert wird. Muss VOR der Zustands-/Routen-
 * aenderung aufgerufen werden, solange `container` noch den alten Inhalt zeigt.
 */
export function flipPage(container: HTMLElement | null, richtung: FlipRichtung = "vor") {
  if (!container) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const rect = container.getBoundingClientRect();
  const navEl = document.querySelector(".bottom-nav");
  const navHoehe = navEl ? navEl.getBoundingClientRect().height : 0;
  const sichtbareHoehe = Math.min(rect.height, window.innerHeight - Math.max(rect.top, 0) - navHoehe);
  if (sichtbareHoehe < 10 || rect.width < 10) return;

  const klon = container.cloneNode(true) as HTMLElement;
  klon.querySelectorAll("audio, video, iframe").forEach((el) => el.remove());
  klon.removeAttribute("id");
  klon.style.margin = "0";
  klon.style.width = `${rect.width}px`;
  klon.style.boxSizing = "border-box";

  const blatt = document.createElement("div");
  blatt.className = "page-flip-sheet";
  blatt.style.marginTop = `${Math.min(rect.top, 0)}px`;
  blatt.appendChild(klon);

  const glanz = document.createElement("div");
  glanz.className = "page-flip-shine";
  blatt.appendChild(glanz);

  const overlay = document.createElement("div");
  overlay.className = `page-flip-overlay page-flip-${richtung}`;
  overlay.style.top = `${Math.max(rect.top, 0)}px`;
  overlay.style.left = `${rect.left}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${sichtbareHoehe}px`;
  overlay.appendChild(blatt);

  document.body.appendChild(overlay);

  const entfernen = () => overlay.remove();
  blatt.addEventListener("animationend", entfernen, { once: true });
  window.setTimeout(entfernen, 900);
}

/**
 * Ersatz fuer react-router-doms useNavigate(): loest beim Verlassen des
 * aktuellen Bildschirms automatisch das Umblaettern auf dem Haupt-Inhaltsbereich
 * aus, bevor navigiert wird. Fuer Bildschirm-interne Uebergaenge (z.B. der
 * Kapitelwechsel im Lese-Bildschirm, der gezielt nur die Verskarte umblaettert)
 * wird stattdessen direkt flipPage() mit einem eigenen Ziel-Element verwendet.
 */
export function useFlipNavigate() {
  const navigate = useNavigate();
  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      const richtung: FlipRichtung = typeof to === "number" && to < 0 ? "zurueck" : "vor";
      flipPage(hauptbereichRef.current, richtung);
      if (typeof to === "number") navigate(to);
      else navigate(to, options);
    },
    [navigate]
  );
}
