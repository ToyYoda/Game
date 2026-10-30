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

## Entwicklung

Quelle ist `src/lichtschlinge.html`. `node build.mjs` erzeugt daraus die eigenständige `index.html`.
Für GitHub Pages reicht es, Pages auf den Branch mit `index.html` im Wurzelverzeichnis zu stellen.
