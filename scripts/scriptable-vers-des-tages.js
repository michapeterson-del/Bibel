// Amibel - Vers des Tages (Scriptable-Widget)
//
// Einrichtung:
// 1. Scriptable-App auf dem iPhone öffnen, neues Script anlegen (z.B. "Vers des Tages")
// 2. Diesen kompletten Code einfügen, speichern
// 3. Auf dem Homescreen ein Scriptable-Widget hinzufügen, dieses Script auswählen
//
// Zeigt denselben "Vers des Tages" an, den auch die Amibel-App auf dem
// Startbildschirm zeigt (beide berechnen den Tag-im-Jahr identisch).

const URL = "https://michapeterson-del.github.io/Bibel/vers-des-tages.json";

function tagImJahr(datum) {
  const jan0 = new Date(datum.getFullYear(), 0, 0);
  return Math.floor((datum.getTime() - jan0.getTime()) / 86400000);
}

async function ladeVersDesTages() {
  const req = new Request(URL);
  const alle = await req.loadJSON();
  const heute = tagImJahr(new Date());
  return alle[String(heute)] ?? null;
}

async function erstelleWidget(vers) {
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
const widget = await erstelleWidget(vers);

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
