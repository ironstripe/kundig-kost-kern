# Menüs, Events und Beer-&-Dine-Demo

Additive Erweiterung von KundiCalc um wiederverwendbare Menüs, Eventkalkulation (Bierdeckel), Nachkalkulation, Erfahrungswerte und zentrale Kalkulationsannahmen. Bestehende Speisekarten, Gerichte, Zutaten, Szenario, Importe und Benutzerverwaltung bleiben unverändert.

## Was neu entsteht

### 1. Menüs (wiederverwendbar)
Neuer Bereich «Menüs» mit Liste und Detailseite.

- Ein Menü hat Name, Notiz, Status (Entwurf / Teilweise geprüft / Geprüft / Archiviert), Brutto-Preis pro Person, MWST (Standard 8.1 %), optionale Gültigkeit.
- Ein Menü enthält Varianten (z. B. Standard, Vegetarisch, Kinder) mit erwarteter Gästezahl und Notizen.
- Jede Variante enthält geordnete Gänge (Apéro, Vorspeise, Suppe, Hauptgang, Dessert, Zusatz), die je eine **bestehende Gericht-Variante** referenzieren, plus Menge pro Gast.
- Rezepte werden nie kopiert: die Kosten kommen live aus der bestehenden Gerichtskalkulation.
- Berechnet pro Person: Brutto, Netto, Wareneinsatz, Wareneinsatzquote, DB I, DB-I-Marge, Vollständigkeit, Datenqualität.
- Ist ein Gericht unvollständig, wird die Menüvariante als unvollständig markiert, die betroffenen Gerichte werden benannt, kein DB I wird angezeigt. Keine Null-Annahmen, kein NaN.
- Vergleichstabelle bei mehreren Varianten.
- Ein Menü funktioniert ohne Event; Aktionen «Menü ohne Event verwenden» und «Mit Event verknüpfen».

### 2. Auswahl der Kalkulationsart
Beim Start einer neuen Kalkulation wählt der Benutzer «À-la-carte-Speisekarte» (bestehender Ablauf) oder «Menü» (neuer Ablauf). Die Auswahl erfolgt am Anfang.

### 3. Events
Neuer Bereich «Events» mit Liste und Detailseite.

- Felder: Name, Datum, Eventtyp (Beer & Dine, Bankett, Lounge / Fingerfood, Sonstiger Event), Status (Entwurf, Vorkalkulation, Freigegeben, Durchgeführt, Nachkalkuliert, Archiviert), geplante und effektive zahlende sowie Gratis-Gäste, Notizen, verknüpftes Menü.
- Beim Verknüpfen eines Menüs wird ein **nicht editierbarer Snapshot** gespeichert (Quelle + Snapshot-Datum). Spätere Menüänderungen verändern freigegebene oder durchgeführte Events nicht. «Aktuelle Menüversion übernehmen» nur vor Abschluss und nur mit Bestätigung.

### 4. Bierdeckel-Vorkalkulation
Kompakte Detailansicht mit den Abschnitten Gäste, Erlöse, Menü und variable Kosten, Personal, Partner und direkte Fixkosten, Ergebnis.

Jede Finanzzeile: Bezeichnung, Kategorie, Erlös/Kosten, fix oder pro Gast, Plan-Betrag und -Menge, Plan-Total, Ist-Betrag und -Menge, Ist-Total, Wertstatus (Offen, Annahme, Bestätigt, Effektiv), Notiz.

Ergebnis: Brutto- und Nettoerlös, variable Kosten, DB I Event und pro zahlendem Gast, Personalkosten, direkte Fixkosten, DB II Event und pro Gast, DB-II-Marge, Break-even-Gäste. Nie als «Gewinn» bezeichnet.

Informative Werte (Gutscheinnominal, Sachleistungen) wirken nie automatisch auf DB I/II.

Vollständigkeitspanel mit Zählung bestätigter, angenommener, effektiver, offener und informativer Werte sowie Label «Vollständig» / «Teilweise vollständig» / «Nicht vollständig kalkulierbar». Bei offenen Kosten dauerhafter Hinweis: «Diese Eventkalkulation enthält offene Kosten. Zwischensalden sind kein vollständiger Deckungsbeitrag.» Eine bewusste Null bleibt von einem fehlenden Wert unterscheidbar.

### 5. Kalkulationsannahmen (Einstellungen → Konfiguration)
Neuer Abschnitt «Kalkulationsannahmen Events»: Stundensätze Küche/Service/Organisation/Logistik, Kleinmaterial pro Gast, Reserve-%, Gebühren-%, weitere variable Kosten pro Gast, Standard-Fixkosten. Je Annahme: Label, Schlüssel, Eventtyp oder «Alle», Wert, Einheit (CHF pro Stunde / pro Gast / fix / Prozent), aktiv, gültig ab, Beschreibung, geändert von/am.

Nur Admins dürfen Annahmen anlegen, ändern, aktivieren oder deaktivieren; aktive Benutzer dürfen lesen.

Standardverhalten: beim Anlegen eines Events wird der aktuelle Standard in das Event kopiert und dort gespeichert; Überschreiben ist möglich. Änderungen am globalen Standard verändern bestehende Events nie. Herkunft wird je Wert angezeigt (Standard / Überschrieben / Effektiv), mit Aktion «Aktuellen Standard übernehmen».

### 6. Nachkalkulation und Erfahrungswerte
Für durchgeführte Events: Plan/Ist-Tabelle je Zeile mit absoluter und prozentualer Abweichung, Status und kurzer Abweichungsnotiz. Erfasst werden Gäste, Menümengen, Erlöse, Wareneinsatz, Getränke, Personalstunden und -sätze, Partnerabrechnungen, Marketing, Transport, sonstige Kosten.

«Erfahrungswerte»-Ansicht gruppiert nach Eventtyp mit Anzahl abgeschlossener Events, Zeitraum, Mittelwert, Minimum und Maximum. Keine automatische Übernahme; Admins können «Als neuen Standard übernehmen» mit Gegenüberstellung und Bestätigung auslösen.

### 7. Beer-&-Dine-Demo
Einmalig, idempotent, klar mit «Demo» gekennzeichnet: Beer & Dine, 14.11.2026, Status Vorkalkulation, 50 zahlende Gäste, 0 Gratisgäste.

- Ticket CHF 120 brutto × 50 = CHF 6'000
- «Barfüsser Anteil / Gutschrift» CHF 25 × 50 = CHF 1'250 als variabler Partnerabzug, mit Herkunftsnotiz
- «Bekannter Zwischensaldo vor offenen Eventkosten» CHF 4'750 — nie als DB oder Gewinn
- Falken-Gutscheine CHF 1'000 rein informativ mit Hinweis «Nominalwert bekannt, effektiver wirtschaftlicher Aufwand offen»
- Hofrundgang und Shuttle je CHF 10, 0 Teilnehmende als bestätigte Null; Shuttle-Kosten «Offerte ausstehend»
- Entwurfsmenü «Beer & Dine – 3-Gang-Menü + Apéro», ohne erfundene Gerichte oder Mengen, als unvollständig markiert
- Offene Pflichtpositionen ohne Werte: Wareneinsatz Menü, Personal Küche, Personal Service, Glühbier / Hofrundgang, Marketing / Drucksachen, Sonstige Eventkosten, Shuttle-Kosten
- Kein vollständiges DB I oder DB II; die blockierenden Positionen werden benannt
- Admin-Aktion unter Konfiguration «Beer-&-Dine-Demo erneut erstellen» mit Bestätigung; nach bewusstem Löschen wird sie nicht automatisch neu erzeugt

### Navigation
Übersicht, Speisekarten, Gerichte, **Menüs**, **Events**, Zutaten & EK, Verkaufsmengen, Szenario, Einstellungen (Benutzer, Konfiguration).

## Technische Umsetzung

- Additive Migrationen: `menus`, `menu_variants`, `menu_positions` (FK auf `variants`), `events`, `event_menu_links` mit JSONB-Snapshot, `event_lines`, `event_assumptions` (global) und `event_assumption_values` (pro Event). Enums für Menü-/Event-Status, Eventtyp, Zeilenkategorie, Wertstatus, Annahme-Einheit.
- Pro Tabelle: GRANT an `authenticated` (kein `anon`), RLS aktiv, Policies über `is_active_user`; `event_assumptions` nur mit `is_admin` mutierbar. Bestehende Policies bleiben unverändert.
- CHECK-Constraints/Trigger gegen negative Gästezahlen und ungültige Prozentwerte; Beträge nullable, damit «fehlend» von «Null» unterscheidbar bleibt.
- Rechenlogik: `src/lib/costing.ts` bleibt Basis; neu `src/lib/menu-costing.ts` und `src/lib/event-costing.ts` als einzige Quelle für Menü- und Event-Totale, verwendet in Listen, Details und Zusammenfassungen.
- Daten werden gebündelt über wenige Abfragen mit `in`-Filtern geladen (Query-Options-Pattern wie bei `dishes`/`menu-cards`), keine Abfrage pro Position.
- Neue Routen unter `src/routes/_authenticated/_app/`: `menues.index`, `menues.$menuId`, `events.index`, `events.$eventId`, `events.erfahrungswerte`, plus Startdialog für die Kalkulationsart und ein Abschnitt in `einstellungen/konfiguration`.
- Demo-Seeding über eine idempotente SQL-Funktion mit stabilem Demo-Schlüssel und Löschmarkierung.

## Prüfungen

Typecheck, Build und ein Playwright-Durchlauf über Menü-Erstellung, Event-Verknüpfung, Vollständigkeitsanzeige und Beer-&-Dine-Demo. Ergebnisse werden nur berichtet, wenn sie tatsächlich ausgeführt wurden.
