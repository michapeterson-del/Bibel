// Amibel - Vers des Tages (Scriptable-Widget)
//
// Einrichtung:
// 1. Scriptable-App auf dem iPhone öffnen, neues Script anlegen (z.B. "Vers des Tages")
// 2. Diesen kompletten Code einfügen, speichern
// 3. Auf dem Homescreen ein Scriptable-Widget hinzufügen, dieses Script auswählen
//
// Zeigt denselben "Vers des Tages" an, den auch die Amibel-App auf dem
// Startbildschirm zeigt (beide berechnen den Tag-im-Jahr identisch).

const APP_BASIS_URL = "https://michapeterson-del.github.io/Bibel/";
const DATEN_URL = "https://michapeterson-del.github.io/Bibel/vers-des-tages.json";

function versLinkZurApp(vers) {
  if (!vers) return APP_BASIS_URL;
  return `${APP_BASIS_URL}#/lesen/${vers.osis}/${vers.kapitel}`;
}

function tagImJahr(datum) {
  const jan0 = new Date(datum.getFullYear(), 0, 0);
  return Math.floor((datum.getTime() - jan0.getTime()) / 86400000);
}

async function ladeVersDesTages() {
  const req = new Request(DATEN_URL);
  const alle = await req.loadJSON();
  const heute = tagImJahr(new Date());
  return alle[String(heute)] ?? null;
}

function kuerzeText(text, maxLen) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trim() + "…";
}

// Sperrbildschirm-Widgets (klein, iOS zeigt dort ohnehin nur gedimmtes
// Grau statt eigener Farben) - hier soll der Bibeltext selbst so viel
// Platz wie moeglich bekommen, ohne Ueberschrift, Referenz nur klein.
function widgetFuerSperrbildschirm(vers) {
  const w = new ListWidget();
  if (!vers) {
    w.addText("Vers konnte nicht geladen werden.");
    return w;
  }
  const text = w.addText(kuerzeText(vers.text, 110));
  text.font = Font.systemFont(15);
  text.minimumScaleFactor = 0.7;
  w.addSpacer(2);
  const ref = w.addText(vers.referenz);
  ref.font = Font.systemFont(11);
  return w;
}

// Homescreen-Widget (mehr Platz, eigene Farben moeglich)
function widgetFuerHomescreen(vers) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#FCF9F3");
  w.setPadding(16, 16, 16, 16);

  const titel = w.addText("Vers des Tages");
  titel.font = Font.mediumSystemFont(13);
  titel.textColor = new Color("#8a8370");
  w.addSpacer(6);

  if (vers) {
    const text = w.addText(vers.text);
    text.font = Font.systemFont(15);
    text.textColor = new Color("#2b2820");
    text.minimumScaleFactor = 0.6;
    w.addSpacer(8);

    const ref = w.addText(vers.referenz);
    ref.font = Font.boldSystemFont(13);
    ref.textColor = new Color("#5c7a63");
  } else {
    const fehler = w.addText("Vers konnte nicht geladen werden.");
    fehler.font = Font.systemFont(14);
    fehler.textColor = new Color("#a04c5c");
  }

  return w;
}

const vers = await ladeVersDesTages();

const aufSperrbildschirm =
  config.widgetFamily === "accessoryRectangular" ||
  config.widgetFamily === "accessoryInline" ||
  config.widgetFamily === "accessoryCircular";

const widget = aufSperrbildschirm ? widgetFuerSperrbildschirm(vers) : widgetFuerHomescreen(vers);
// Tipp auf das Widget oeffnet Amibel direkt beim heutigen Kapitel
widget.url = versLinkZurApp(vers);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
