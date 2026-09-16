# KundiCalc-Favicon aus bestehendem App-Icon

## Umsetzung
- Das bestehende gelbe KC-App-Icon als eigenständiges SVG nachbauen; die Buchstaben werden als Vektorpfade eingebettet.
- Daraus ein Mehrgrössen-ICO mit 16 × 16 und 32 × 32 Pixeln sowie ein Apple-Touch-Icon mit 180 × 180 Pixeln erzeugen.
- Die vorhandene Standard-Favicon-Datei ersetzen und im Dokumentkopf eindeutige, versionierte Verweise auf SVG, ICO und Apple-Touch-Icon setzen.
- Kein Manifest und keine PWA-Funktion ergänzen, da aktuell keines vorhanden ist.

## Technische Details
- Gelbe Fläche: `#F8D04F`; dunkle KC-Pfade mit ausreichend kräftigen Formen für kleine Darstellungen.
- Öffentliche Dateien: `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`.
- Validierung über Dateiformat, Abmessungen, enthaltene ICO-Grössen, HTTP-Antworten der Vorschau und eine Sichtprüfung bei 16 × 16 und 32 × 32 Pixeln.
- Abschliessend Konflikte im Dokumentkopf sowie den aktuellen Build-Status prüfen.
