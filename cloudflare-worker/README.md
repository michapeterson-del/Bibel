# Amibel-Proxy einrichten (einmalig, kostenlos)

Dieser eine kleine, kostenlose "Worker" bei Cloudflare übernimmt zwei Aufgaben:

1. **KI-Chat ohne eigenen Schlüssel:** Damit alle Nutzer der App den Chat nutzen
   können, ohne selbst einen API-Schlüssel einzutragen, versteckt der Worker
   deinen echten Anthropic-Schlüssel vor dem Browser.
2. **Vorlesen (ElevenLabs):** ElevenLabs erlaubt keine direkten Audio-Anfragen
   aus dem Browser (das zeigt sich als Fehler wie „Load failed"). Der Worker
   leitet diese eine Anfrage serverseitig weiter - mit dem Schlüssel, den der
   jeweilige Nutzer selbst in den Einstellungen einträgt. Diesen Schlüssel
   speichert der Worker nicht, er reicht ihn nur für die eine Anfrage durch.

Dauert ca. 5 Minuten, alles im Browser (auch am Handy machbar), keine
Programmierkenntnisse nötig. Hast du den Worker schon für den KI-Chat
eingerichtet? Dann reicht es, den Code im Worker durch die aktuelle
`worker.js` aus diesem Ordner zu ersetzen (Schritt 2.5) - Schritt 3
(API-Schlüssel-Secret) bleibt unverändert bestehen.

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

## Schritt 3: Deinen API-Schlüssel sicher hinterlegen (nur für den KI-Chat nötig)

Willst du nur das Vorlesen reparieren und nicht auch den schlüssellosen KI-Chat
anbieten, kannst du diesen Schritt überspringen - Vorlesen funktioniert auch ohne.

1. Im Worker auf **„Settings"** / **„Einstellungen"** → **„Variables and Secrets"**
   (oder „Variablen und Secrets") gehen.
2. Eine neue Variable hinzufügen:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Wert:** dein echter Anthropic-API-Schlüssel (beginnt mit `sk-ant-...`)
   - **Typ:** unbedingt **„Secret" / „Verschlüsselt"** auswählen (nicht "Text"/"Plain"),
     damit ihn niemand - auch du später nicht mehr - im Klartext einsehen kann.
3. Speichern und erneut deployen, falls danach gefragt wird.

## Schritt 4: Wichtig - Ausgabenlimit setzen (nur falls Schritt 3 gemacht wurde)

Geh zu **https://console.anthropic.com/settings/limits** und setze ein monatliches
Ausgabenlimit für deinen API-Schlüssel (z. B. 5-10 €). Das ist dein Sicherheitsnetz,
falls doch mal jemand den Dienst missbraucht - dann kostet es dich höchstens diesen
Betrag, nie mehr.

## Schritt 5: Die Worker-Adresse an mich schicken

Nach dem Deploy zeigt Cloudflare dir eine Adresse wie
`https://amibel-proxy.<dein-name>.workers.dev`. Schick mir genau diese Adresse -
ich trage sie in die App ein, dann funktioniert Vorlesen (und falls eingerichtet
auch der schlüssellose KI-Chat).

## Wie das funktioniert (kurz erklärt)

- Die App schickt KI-Chat-Anfragen und Vorlese-Anfragen an deine Worker-Adresse
  statt direkt an Anthropic bzw. ElevenLabs.
- Beim KI-Chat hängt der Worker deinen hinterlegten Schlüssel an (den nur er
  kennt) und leitet die Anfrage an Anthropic weiter.
- Beim Vorlesen reicht der Worker nur den Schlüssel durch, den der jeweilige
  Nutzer selbst in der App eingegeben hat - der Worker speichert ihn nicht.
- Nur Anfragen von deiner Amibel-Seite werden angenommen (siehe `ERLAUBTE_URSPRUENGE`
  im Code) - das hält beiläufigen Missbrauch ab, ist aber kein hundertprozentiger
  Schutz. Das Ausgabenlimit aus Schritt 4 ist dein eigentliches Sicherheitsnetz
  für den KI-Chat.
