# KundiCalc Family UX Pass 3

## Ziel

Die angemeldete Startseite wird zu einem ruhigen, aufgabenorientierten Einstieg. Analyse bleibt unverändert unter «Übersicht», während Kalkulationsarten erst nach der ersten Auswahl erscheinen. Bestehende Navigation, Abläufe und Fachlogik bleiben erhalten.

## Umsetzung

- Neue geschützte Seite `/start` innerhalb der bestehenden KundiCalc-Oberfläche erstellen.
  - Erste Ansicht enthält ausschliesslich zwei gleichwertige, grosszügige Auswahlflächen: «Kalkulation starten» und «Analysieren».
  - «Analysieren» führt direkt zu `/uebersicht`.
  - «Kalkulation starten» wechselt ohne Datenänderung in einen einfachen zweiten Schritt mit der Überschrift «Was möchtest du kalkulieren?».
  - Der zweite Schritt enthält genau «À-la-carte», «Menü» und «Event» und führt zu `/speisekarten`, `/menues` beziehungsweise `/events`.
  - Eine sichtbare Zurück-Aktion kehrt zum ersten Schritt zurück; es werden keine Datensätze angelegt und keine bestehenden Erfassungsdialoge umgangen.
- Den angemeldeten Root-Einstieg von `/uebersicht` auf `/start` umstellen; der nicht angemeldete Einstieg bleibt `/auth`.
- Das bestehende KundiCalc-Logo in ausgeklappter Seitenleiste, Icon-Leiste und mobilem Kopfbereich als zugänglichen Link zu `/start` ausführen, inklusive Fokuszustand und `aria-label="KundiCalc Startseite"`.
- Seitenleiste, Reihenfolge und Zielseiten unverändert lassen; auf `/start` bleibt bewusst kein Eintrag aktiv.
- Die visuelle Hierarchie bestehender Entity-Links vereinheitlichen:
  - Dashboard-Beitragstabelle: Gericht und Add-on.
  - Gerichte, Menüs, Events und Speisekarten: verlinkte Namen.
  - `font-semibold`, dezente Unterstreichung/Textbetonung bei Hover und klarer Tastaturfokus.
  - Zutaten bleiben normal gewichtet, weil dort kein Namenslink zu einer eigenen Detailseite existiert; der vorhandene Bearbeiten-Befehl bleibt unverändert.
- Keine Änderung an `/uebersicht`, Berechnungen, Speichern, Freigaben, Importen, Daten oder Integrationen.

## Technische Details

- TanStack-Routenlinks für alle Navigationen verwenden; keine programmatische Navigation für anklickbare Ziele.
- Die Startseite erhält eigene Seitentitel-, Beschreibungs- und Social-Metadaten.
- Die zwei Einstiegsauswahlen und drei Kalkulationsarten verwenden stabile, mindestens 44 px hohe Link-/Button-Ziele, semantische Farbtokens und vorhandene Family-v1-Abstände.
- Desktop ab 1024 px: zwei gleich breite Auswahlflächen; 390/768 px: sauber gestapelt, ohne horizontalen Überlauf.
- Die zweite Stufe wird inline umgesetzt, da dies die einfachste zugängliche Lösung mit natürlicher Zurück-Navigation und ohne Dialog-/Escape-Konflikte ist.
- Die bestehende Interaktionslogik aus Pass 2 wird nicht berührt.

## Prüfung

- Automatisierte Tests ergänzen für Startauswahl, zweiten Schritt, Ziel-Links und Logo-Startlink, ohne Datenmutationen.
- Bestehende Interaktionstests ausführen.
- Vorschau bei 390, 768 und 1024 px prüfen: erster Schritt, zweiter Schritt, Navigation zur Übersicht und repräsentative Entity-Links.
- Root-Weiterleitung angemeldet zu `/start` und abgemeldet zu `/auth` prüfen.
- Aktuellen Build-Status und Typprüfung kontrollieren; Berechnungsansicht vor/nach Navigation unverändert lassen.
