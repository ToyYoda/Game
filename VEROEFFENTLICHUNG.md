# Lichtschlinge veröffentlichen: Steam und Google Play

Was im Repo vorbereitet ist und was du selbst erledigen musst. Gebühren und Regeln der Stores ändern sich gelegentlich: die Angaben unten vor dem Bezahlen in Steamworks bzw. der Play Console gegenprüfen.

## Was schon fertig ist

| Teil | Ort |
| --- | --- |
| Desktop-App für Steam (Electron, Vollbild, Beenden-Knopf, F11) | `app/electron/` |
| Android-App (Capacitor, Zurück-Taste, Icons, Startbild) | `app/android/` |
| Offline-Fassung des Spiels (Schriften und PeerJS mitgeliefert) | `app/build-www.mjs` → `app/www/` |
| Automatische Builds (Windows, Linux, Android) | `.github/workflows/apps.yml` |
| App-Icon und alle Store-Grafiken | `app/assets/`, `store/steam/`, `store/play/` (Quelle: `app/assets-src/`) |
| Screenshots Desktop 1920×1080 und Handy 1080×1920 | `store/screenshots/` |
| Store-Texte deutsch und englisch | `store/TEXTE.md` |
| Datenschutzerklärung (deutsch und englisch) | `privacy.html` → https://toyyoda.github.io/Game/privacy.html |
| SteamPipe-Vorlagen für den Upload | `store/steam/steampipe/` |

Die Builds findest du nach jedem Push auf `main` unter GitHub → Actions → „Apps“ → letzter Lauf → *Artifacts*.

## Vorher erledigen (beide Stores)

1. **Datenschutzerklärung:** ausgefüllt unter https://toyyoda.github.io/Game/privacy.html. Bei Änderungen am Spiel (z. B. Werbung, Analyse, neue Online-Dienste) mit anpassen.
2. **Impressum:** https://toyyoda.github.io/Game/impressum.html (im Spielmenü verlinkt). Für die KI-Angabe bei Steam den Text aus `store/KI-OFFENLEGUNG.md` verwenden.
3. **Arena-Server:** Der kostenlose Render-Tarif schläft ein und hat wenig Rechenleistung. Für eine Store-Veröffentlichung einen bezahlten Tarif mit einem vollen Kern wählen, sonst erleben neue Spieler beim ersten Start eine Minute Wartezeit.
4. **Musik:** `music/theme.mp3` ablegen (siehe `music/LIESMICH.md`). Für Steam und Google Play muss die Musik kommerziell genutzt werden dürfen; bei Suno gilt das nur für Stücke, die mit einem bezahlten Tarif erzeugt wurden.
5. **Sprachen:** Das Spiel ist deutsch und englisch. In den Stores beide Sprachen für die Oberfläche angeben (kein Ton mit Sprache, keine Untertitel nötig).

## Steam

1. **Steamworks-Konto:** https://partner.steamgames.com → als Entwickler registrieren, Identität, Steuerdaten (W-8BEN für Deutschland) und Bankverbindung hinterlegen.
2. **Steam-Direct-Gebühr** (derzeit 100 US-Dollar pro Spiel) zahlen. Danach bekommst du eine **App-ID**. Nach der Zahlung gilt eine Wartezeit von 30 Tagen bis zur Veröffentlichung.
3. **Shop-Seite anlegen:**
   - Texte aus `store/TEXTE.md`
   - Grafiken aus `store/steam/`: Header-Capsule 920×430, Small 462×174, Main 1232×706, Vertical 748×896, Library Capsule 600×900, Library Header 920×430, Library Hero 3840×1240, Library Logo 1280×720, Seitenhintergrund 1438×810, Community-Icon 184×184
   - mindestens 5 Screenshots aus `store/screenshots/desktop-*.png`
   - ein Trailer ist nicht Pflicht, verbessert die Sichtbarkeit aber deutlich
   - Fragebogen zu Inhalten ausfüllen, Preis festlegen (oder kostenlos)
   - Die Seite muss mindestens zwei Wochen als „Demnächst verfügbar“ sichtbar sein, bevor du veröffentlichen kannst.
4. **Depots anlegen:** In Steamworks unter *SteamPipe → Depots* ein Depot für Windows und eines für Linux anlegen. Die Depot-IDs in `store/steam/steampipe/*.vdf` statt `APP_ID`, `DEPOT_ID_WINDOWS`, `DEPOT_ID_LINUX` eintragen.
5. **Build hochladen:**
   - Steamworks-SDK herunterladen (Steamworks → *SDK*), die drei `.vdf`-Dateien nach `sdk/tools/ContentBuilder/scripts/` kopieren.
   - Artifact `lichtschlinge-steam-win` nach `ContentBuilder/content/windows/`, `lichtschlinge-steam-linux` nach `ContentBuilder/content/linux/` entpacken.
   - Hochladen: `steamcmd +login <dein-steam-login> +run_app_build ..\scripts\app_build.vdf +quit`
   - In Steamworks den Build dem Branch `default` zuweisen.
6. **Startoptionen** (*Installation → Allgemein*): Windows `Lichtschlinge.exe`, Linux `lichtschlinge`.
7. **Prüfung beantragen:** Valve prüft Shop-Seite und Build (meist einige Werktage). Danach kannst du veröffentlichen.

Hinweise:
- **Steam Deck:** Das Spiel braucht Maus oder Touchscreen. Auf dem Deck funktioniert es über Touchscreen und Trackpad, eine Controller-Steuerung gibt es nicht. Rechne mit der Einstufung „Spielbar“ oder „Nicht unterstützt“.
- **macOS:** nicht vorbereitet. Mac-Builds müssen mit einem Apple-Entwicklerkonto (99 US-Dollar pro Jahr) signiert und notarisiert werden.
- **Steam-Erfolge, Overlay und Bestenlisten** sind nicht eingebaut. Das ginge später mit `steamworks.js`.

## Google Play

1. **Entwicklerkonto:** https://play.google.com/console → einmalig 25 US-Dollar, Identität bestätigen.
   - **Wichtig für private Konten:** Neue private Entwicklerkonten müssen vor der Veröffentlichung einen **geschlossenen Test mit mindestens 12 Testern über 14 Tage** durchführen. Erst danach lässt sich der Produktionszugang beantragen. Freunde und Teammitglieder als Tester einladen.
2. **Upload-Schlüssel erzeugen** (einmalig, auf deinem Rechner, Java nötig):
   ```bash
   keytool -genkeypair -v -keystore lichtschlinge-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   Die Datei und die Passwörter sicher aufbewahren (Passwort-Manager), **nie ins Repo**.
3. **Schlüssel bei GitHub hinterlegen:** GitHub → Repository → *Settings → Secrets and variables → Actions → New repository secret*:
   - `ANDROID_KEYSTORE_BASE64`: Inhalt von `base64 -w0 lichtschlinge-upload.jks` (Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("lichtschlinge-upload.jks"))`)
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (z. B. `upload`), `ANDROID_KEY_PASSWORD`

   Danach baut jeder Lauf von „Apps“ zusätzlich das signierte `.aab` (Artifact `lichtschlinge-android`). Den Lauf startest du mit einem Push oder unter Actions → Apps → *Run workflow*.
4. **App in der Play Console anlegen:** Name „Lichtschlinge“, Spiel, kostenlos oder kostenpflichtig. *Play App Signing* aktiviert lassen.
5. **Store-Eintrag:** Texte aus `store/TEXTE.md`, Icon `store/play/icon-512.png`, Feature-Grafik `store/play/feature-graphic-1024x500.png`, Handy-Screenshots `store/screenshots/phone-*.png`.
6. **App-Inhalte** (*Richtlinien → App-Inhalte*):
   - Datenschutz-URL: https://toyyoda.github.io/Game/privacy.html
   - Werbung: keine
   - Zielgruppe: ab 13 Jahren. Bei jüngeren Zielgruppen gelten die strengeren Familienrichtlinien.
   - Inhaltseinstufung: IARC-Fragebogen ausfüllen (abstrakte Gewalt gegen geometrische Formen, Online-Interaktion zwischen Spielern, keine Chats)
   - **Datensicherheit:** Übertragen wird der selbst gewählte Spielername (nutzergenerierter Inhalt) und Spielaktivität für die Online-Modi. Verschlüsselte Übertragung: ja. Keine Weitergabe an Dritte zu Werbezwecken. Keine dauerhafte Speicherung außer der flüchtigen Bestenliste. Bitte anhand der aktuellen Fragen in der Console prüfen.
7. **Geschlossenen Test starten:** `.aab` aus dem Artifact unter *Testen → Geschlossener Test* hochladen, Tester per E-Mail-Liste einladen, 14 Tage laufen lassen.
8. **Produktion beantragen**, dann veröffentlichen. Die erste Prüfung dauert oft einige Tage.

Vor dem Hochladen am besten die **Test-APK** (`app-debug.apk` im Artifact `lichtschlinge-android`) auf einem echten Handy ausprobieren: Datei aufs Handy laden und Installation aus unbekannten Quellen erlauben. Achte dabei besonders auf Ränder (Kamera-Aussparung, Navigationsleiste), die Zurück-Taste und das Spielgefühl mit dem Finger.

## Updates

- **Steam:** neuen Build aus Actions hochladen (Schritt 5) und dem Branch `default` zuweisen.
- **Google Play:** Jeder Lauf bekommt automatisch eine höhere Versionsnummer (`versionCode` = Laufnummer). Neues `.aab` hochladen. Den sichtbaren Versionsnamen änderst du in `app/android/app/build.gradle` (`versionName`) und `app/package.json` (`version`).
- **Spielinhalt** kommt immer aus `src/`. Web, Steam und Android bauen alle daraus.
