# Lichtschlinge

Ein kleines Action-Browserspiel für die Maus. Keine Installation: `index.html` im Browser öffnen.

## Spielprinzip

- Dein Licht folgt dem Mauszeiger und zieht einen leuchtenden Schweif hinter sich her.
- Kreuzt der Schweif sich selbst, schließt sich eine **Schlinge**. Alle Gegner darin verglühen.
- Mehrere Gegner in einer Schlinge geben deutlich mehr Punkte. Jede erfolgreiche Schlinge erhöht die **Kette** (Multiplikator) und verlängert den Schweif. Ohne neue Treffer zerfällt die Kette Stufe für Stufe.
- **Klick** löst eine Schockwelle aus, die Gegner wegstößt. Sie lädt sich durch Treffer und eingesammelte Funken wieder auf (Ring um das Licht).
- Eine Berührung mit einem Gegner beendet die Runde. Der Rekord wird im Browser gespeichert.

| Gegner | Verhalten |
| --- | --- |
| Pinke Pfeile | verfolgen dich |
| Cyan-Quadrate | treiben umher, kommen oft im Schwarm |
| Gelbe Rauten | zielen (gestrichelte Linie) und springen dann vor |
| Rote Klingen | zerschneiden deinen Schweif |
| Violette Sechsecke | explodieren beim Einfangen und reißen alles im Umkreis mit |

## Arena (online, bis zu 200 Lichter)

- **Arena** → Namen eingeben → **Arena betreten**. Eine große Welt (7000 × 7000), die Kamera folgt deinem Licht.
- Neue Lichter landen in der Nähe anderer Spieler. Jedes Licht hat seinen eigenen Schwierigkeitsgrad, der mit seiner Lebenszeit steigt.
- Oben rechts steht die Live-Rangliste, unten links die Übersichtskarte. Wer verglüht, sieht Platz und Bestenliste und steigt mit **Nochmal** sofort wieder ein.
- Fremde Lichter in der eigenen Schlinge verlieren ihre Kette (wie im Modus mit Freunden).

Die Arena braucht den Server aus `server/` (siehe unten). Ohne eingetragene Server-Adresse zeigt das Spiel „Der Arena-Server ist noch nicht eingerichtet“.

## Mit Freunden (online, bis zu 4 Lichter)

- **Mit Freunden** → Namen eingeben → **Raum erstellen**. Den Link (oder den fünfstelligen Code) an die anderen schicken.
- Die anderen öffnen den Link oder geben den Code ein und klicken **Beitreten**. Der Host startet die Runde.
- Alle spielen in derselben Arena gegen dieselben Gegner. Wer am Ende die meisten Punkte hat, gewinnt.
- Gerät ein anderes Licht in deine Schlinge, zerreißt seine Kette (Multiplikator auf ×1) und du bekommst einen Bonus.
- Wer verglüht, schaut bis zum Rundenende zu. Danach startet der Host die nächste Runde.

Technik: Die Browser verbinden sich direkt per WebRTC (Bibliothek PeerJS, Vermittlung über den kostenlosen PeerJS-Server).
Das Spiel selbst simuliert der Browser des Hosts; sein Tab sollte deshalb im Vordergrund bleiben.
In sehr restriktiven Netzen (manche Firmen- oder Mobilfunknetze) kann die direkte Verbindung scheitern.

Tasten (optional): `Leertaste` neue Runde, `Esc`/`P` Pause, `M` Ton.
Auf dem Handy: Finger steuert, Doppeltipp löst die Schockwelle aus.

## Arena-Server einrichten

Der Server (`server/server.js`, Node.js + WebSocket) simuliert die Welt mit 30 Takten pro Sekunde und schickt jedem Licht 15-mal pro Sekunde nur den Ausschnitt um sich herum. Er liefert unter seiner eigenen Adresse auch das Spiel aus.

**Render (am einfachsten):** render.com → *New* → *Blueprint* → dieses Repository wählen. `render.yaml` richtet alles ein. Danach ist das Spiel unter `https://<name>.onrender.com` spielbar.
Die GitHub-Pages-Seite verbindet sich mit `wss://lichtschlinge-arena.onrender.com` (Konstante `ARENA_URL` in `src/lichtschlinge.html`; nach Änderungen `node build.mjs`).

**Andere Hoster:** Das `Dockerfile` baut einen Container (Port über `PORT`, Standard 8787).

Einstellungen über Umgebungsvariablen: `MAX_PLAYERS` (200), `WORLD_SIZE` (7000), `LOG_SECONDS` (60).

Gemessen mit 200 simulierten Spielern auf einem Kern: ca. 6 ms Rechenzeit pro Takt (Budget 33 ms), rund 1,8 MB/s ausgehend (komprimiert, ca. 9 KB/s pro Spieler).
Der kostenlose Render-Tarif hat nur einen Bruchteil eines Kerns, schläft nach 15 Minuten ohne Besucher ein (Aufwachen bis zu einer Minute) und begrenzt den Datenverkehr. Für viele gleichzeitige Spieler braucht es einen bezahlten Tarif.

Lokal testen:

```bash
cd server && npm install && cd .. && node build.mjs && node server/server.js
```

Dann `http://localhost:8787` öffnen.

## Apps (Steam, Google Play)

Desktop-App (Electron) und Android-App (Capacitor) liegen in `app/`, Store-Grafiken und -Texte in `store/`.
Die Builds entstehen automatisch in GitHub Actions („Apps“). Schritt-für-Schritt-Anleitung: [VEROEFFENTLICHUNG.md](VEROEFFENTLICHUNG.md).

Lokal: `cd app && npm install && npm start` startet die Desktop-App (`--windowed` für ein Fenster).

## Entwicklung

Quellen sind `src/lichtschlinge.html` (Seite) und `src/sim.js` (Spiellogik, gemeinsam für Browser und Arena-Server). `node build.mjs` erzeugt daraus die eigenständige `index.html`.
Für GitHub Pages reicht es, Pages auf den Branch mit `index.html` im Wurzelverzeichnis zu stellen.
