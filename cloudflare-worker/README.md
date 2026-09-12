# Amibel KI-Proxy einrichten (einmalig, kostenlos)

Damit alle Nutzer der App den Chat nutzen können, ohne selbst einen API-Schlüssel
einzutragen, brauchst du einen kleinen kostenlosen "Worker" bei Cloudflare. Er
versteckt deinen echten Anthropic-Schlüssel vor dem Browser. Dauert ca. 5 Minuten,
alles im Browser (auch am Handy machbar), keine Programmierkenntnisse nötig.

## Schritt 1: Cloudflare-Konto anlegen

1. Gehe zu **https://dash.cloudflare.com/sign-up** und lege ein kostenloses Konto an.
2. Bestätige deine E-Mail-Adresse.

## Schritt 2: Worker erstellen

1. Im Cloudflare-Dashboard links im Menü auf **„Workers & Pages"** tippen.
2. **„Create"** / **„Erstellen"** → **„Create Worker"** auswählen.
3. Gib einen Namen ein, z. B. `amibel-proxy`. Auf **„Deploy"** tippen (erstellt erstmal
   eine Standard-Vorlage - das ist ok, die ersetzen wir gleich).
4. Danach auf **„Edit code"** / **„Code bearbeiten"** tippen - das öffnet einen
   Code-Editor direkt im Browser.
5. **Den kompletten vorhandenen Code löschen** und stattdessen den Inhalt der Datei
   `worker.js` aus diesem Ordner einfügen (die Datei, die neben dieser README liegt).
6. Oben auf **„Deploy"** / **„Bereitstellen"** tippen.

## Schritt 3: Deinen API-Schlüssel sicher hinterlegen

1. Im Worker auf **„Settings"** / **„Einstellungen"** → **„Variables and Secrets"**
   (oder „Variablen und Secrets") gehen.
2. Eine neue Variable hinzufügen:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Wert:** dein echter Anthropic-API-Schlüssel (beginnt mit `sk-ant-...`)
   - **Typ:** unbedingt **„Secret" / „Verschlüsselt"** auswählen (nicht "Text"/"Plain"),
     damit ihn niemand - auch du später nicht mehr - im Klartext einsehen kann.
3. Speichern und erneut deployen, falls danach gefragt wird.

## Schritt 4: Wichtig - Ausgabenlimit setzen

Geh zu **https://console.anthropic.com/settings/limits** und setze ein monatliches
Ausgabenlimit für deinen API-Schlüssel (z. B. 5-10 €). Das ist dein Sicherheitsnetz,
falls doch mal jemand den Dienst missbraucht - dann kostet es dich höchstens diesen
Betrag, nie mehr.

## Schritt 5: Die Worker-Adresse an mich schicken

Nach dem Deploy zeigt Cloudflare dir eine Adresse wie
`https://amibel-proxy.<dein-name>.workers.dev`. Schick mir genau diese Adresse -
ich trage sie in die App ein, dann funktioniert der Chat für alle Besucher ohne
eigenen Schlüssel.

## Wie das funktioniert (kurz erklärt)

- Die App schickt Chat-Anfragen an deine Worker-Adresse statt direkt an Anthropic.
- Der Worker hängt deinen Schlüssel dran (den nur er kennt) und leitet die Anfrage
  an Anthropic weiter.
- Nur Anfragen von deiner Amibel-Seite werden angenommen (siehe `ERLAUBTE_URSPRUENGE`
  im Code) - das hält beiläufigen Missbrauch ab, ist aber kein hundertprozentiger
  Schutz. Das Ausgabenlimit aus Schritt 4 ist dein eigentliches Sicherheitsnetz.
