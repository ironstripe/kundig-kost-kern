# Eventideen, Freigabe der Durchführung und Vorbereitung der Übergabe

Der Eventbereich erhält eine vorgelagerte Ideenphase und eine ausdrückliche Freigabe der Durchführung. Bestehende Eventkalkulationen, Nachkalkulation, Annahmen und die Beer & Dine Demo bleiben unverändert nutzbar.

## Ablauf für Benutzerinnen und Benutzer

```text
Idee erfassen -> diskutieren -> zur Kalkulation freigeben
   -> Bierdeckel erstellen -> prüfen
   -> Durchführung freigeben -> "Zur Übergabe bereit"
```

## 1. Events erhält zwei Unterbereiche

- "Ideen" (neu) und "Kalkulationen" (die heutige Eventliste).
- Bestehende Kalkulationen ohne Idee bleiben vollständig nutzbar; niemand muss nachträglich eine Idee anlegen.

## 2. Ideen erfassen und besprechen

- Pflicht: Titel und Kurzbeschreibung. Alles andere ist freiwillig: Eventformat, Zielgruppe, Wunschdatum oder Zeitraum, erwartete Gäste, Partner, verantwortliche Person, Diskussionsnotizen.
- Eine Idee lässt sich ohne Datum, Gästezahl und Preis speichern.
- Stufen: Neu, In Diskussion, Zur Kalkulation freigegeben, Zurückgestellt, Verworfen.
- Zurückgestellte und verworfene Ideen bleiben erhalten, sind filterbar und können in die Diskussion zurückgeholt werden. Löschen ist nicht der normale Weg.
- Bei "Zur Kalkulation freigegeben" werden Person und Zeitpunkt festgehalten. Diese Freigabe erlaubt nur das Rechnen, nie die Durchführung.

## 3. Von der Idee zum Bierdeckel

- Aktion "Bierdeckel erstellen" nur bei freigegebenen Ideen.
- Es entsteht eine Kalkulation im bestehenden Eventmodell. Übernommen werden nur bekannte, passende Angaben (Titel, Wunschdatum, Eventformat, erwartete Gäste). Unbekanntes bleibt offen und wird nie als Null gerechnet.
- Pro Idee genau eine verknüpfte Kalkulation. Mehrfaches Klicken erzeugt keine zweite; stattdessen erscheint "Kalkulation öffnen".
- Von beiden Seiten gibt es einen sichtbaren Rückverweis. Spätere Änderungen an der Idee verändern die Kalkulation nicht.

## 4. Bierdeckel-Prüfung

Die bestehende Eventkalkulation wird weiterverwendet und zusätzlich klar unterschieden in:

- rechnerisch vollständig, aber auf Annahmen gestützt
- unvollständig, weil Pflichtwerte fehlen

Fehlende Werte, geschätzte Werte und die verwendeten Annahmen werden aufgeführt. Keine automatische Rentabilitätsschwelle, kein Deckungsbeitrag als "Gewinn".

## 5. Durchführung freigeben

- Eigene Aktion "Durchführung freigeben" mit Bestätigungsdialog: Eventtitel, aktuelle Ergebnisübersicht, Annahmen, Hinweise auf fehlende Daten, optionale Entscheidnotiz.
- Solange Pflichtwerte fehlen, ist die Freigabe blockiert (auch serverseitig, nicht nur im Knopf).
- Geschätzte Werte dürfen freigegeben werden, bleiben aber geschätzt.
- Festgehalten werden freigebende Person, Zeitpunkt, Notiz und eine unveränderliche Momentaufnahme der Entscheidgrundlage.
- Ändern sich danach finanziell relevante Werte, bleibt der alte Freigabeeintrag erhalten und es wird sichtbar eine erneute Freigabe verlangt. Eine Übergabe stützt sich nie auf eine überholte Freigabe.
- Ein gutes Ergebnis führt nie automatisch zu einer Freigabe.

## 6. Vorbereitung der Kundivent-Übergabe (ohne Verbindung)

- Nach der Freigabe erscheint "Zur Übergabe bereit".
- Zusätzlich der Hinweis "Kundivent-Übergabe noch nicht eingerichtet." Es gibt keinen aktiven Übergabeknopf, keine erfundenen Ziel-IDs, keine simulierten Übertragungen.
- Die Anzeige unterscheidet bereits "Durchführung freigegeben" und "An Kundivent übergeben"; letzteres bleibt leer, bis eine echte Rückmeldung vorliegt.
- Für die spätere Übergabe wird eine stabile Quellkennung je Kalkulation gespeichert, damit später keine doppelten Zielevents entstehen.

## Technische Umsetzung

Additive Migration, keine bestehenden Strukturen verändert:

- `event_ideas`: Titel, Kurzbeschreibung, Format, Zielgruppe, Wunschdatum/Zeitraum, erwartete Gäste, Partner, verantwortliche Person, Notizen, Stufe (neuer Enum `event_idea_stage`), `calc_approved_by`/`calc_approved_at`, Ersteller, Zeitstempel.
- `event_idea_notes` für Diskussionsbeiträge (Autor, Text, Zeitstempel).
- `events` erhält additiv: `idea_id` (eindeutig, damit pro Idee eine Kalkulation), `handover_state` (neuer Enum: `not_ready`, `ready`, `handed_over`), `handover_ref`, `handover_url`, `source_key` als stabile Quellkennung.
- `event_execution_approvals`: Event, freigebende Person, Zeitpunkt, Notiz, `basis_snapshot` (jsonb, unveränderlich), `basis_fingerprint`, `superseded_at`.
- GRANTs für `authenticated`/`service_role`, RLS wie bestehend über `is_active_user(auth.uid())`; Freigabesätze sind nur einfügbar, nicht änderbar/löschbar.
- Serverseitige Prüfung der Übergänge in SECURITY-INVOKER-Funktionen: `approve_idea_for_calculation`, `create_event_from_idea` (idempotent über `idea_id`), `approve_event_execution` (weist fehlende Pflichtwerte ab und schreibt die Momentaufnahme).
- Der `basis_fingerprint` fasst die finanzrelevanten Eingaben zusammen; weicht er ab, gilt die Freigabe als überholt.

Neue Frontend-Teile: `src/lib/event-ideas.ts`, `src/lib/event-approvals.ts`, Routen `events.ideen.index.tsx` und `events.ideen.$ideaId.tsx`, Komponenten `EventIdeaDialog`, `IdeaStageBadge`, `EventApprovalPanel`, `HandoverPanel`; Navigation um "Ideen" und "Kalkulationen" ergänzt. Bestehende Kalkulations- und Nachkalkulationslogik bleibt unangetastet.

## Prüfungen

Typprüfung und Build, plus Durchgang im Browser: Idee ohne Datum speichern, zurückgestellte Idee wiederfinden, "Bierdeckel erstellen" zweimal klicken, Freigabe bei fehlenden Werten blockiert, Freigabe mit gekennzeichneten Schätzwerten möglich, Änderung danach verlangt erneute Freigabe, Demo- und Menüdaten unverändert.

## Nicht Teil dieses Schritts

Die eigentliche Kundivent-Verbindung (Schritt 2 und 3): keine Schnittstelle, keine Zugangsdaten, keine Übertragung.
