# KundiCalc-ID in der Benutzerverwaltung

Administratoren sollen die ID eines Benutzers bequem kopieren können, um sie in Kundivent zu hinterlegen.

## Geprüfter Ist-Zustand

- Die Benutzerverwaltung ist eine reine Tabellenansicht (Name, E-Mail, Rolle, Status, letzte Anmeldung, Aktionen); eine Detail- oder Bearbeitungsansicht existiert heute nicht.
- Der Zugriff ist bereits auf Administratoren beschränkt: die Seite leitet Nicht-Admins weiter, und jede Server-Aktion prüft die Adminrolle erneut serverseitig.
- Die ID, die beim Übergeben an Kundivent als Absender-ID mitgeschickt wird, ist die Anmelde-ID des angemeldeten Benutzers.
- Datenbankabgleich aller vier bestehenden Konten: Profil-ID und Anmelde-ID sind identisch. Die in der Benutzerliste geführte ID ist also genau die ID, die der Versand verwendet.

## Was gebaut wird

1. **Neue Detailansicht pro Benutzer**: In der Aktionsspalte kommt eine Schaltfläche „Details“ hinzu, die ein Dialogfenster mit Name, E-Mail, Rolle, Status und dem neuen Feld **KundiCalc-ID** öffnet. Bestehende Aktionen (Passwort, Aktivieren/Deaktivieren) bleiben unverändert.
2. **Feld KundiCalc-ID**: schreibgeschützt, vollständig markierbar, in Monospace dargestellt.
3. **Schaltfläche „ID kopieren“**: kopiert exakt die ID ohne Beschriftung oder Leerzeichen. Erst nach erfolgreichem Kopieren erscheint die Bestätigung „KundiCalc-ID kopiert“. Schlägt der Zugriff auf die Zwischenablage fehl, wird der Text automatisch markiert und ein Hinweis zum manuellen Kopieren angezeigt – keine falsche Erfolgsmeldung.
4. **Hilfetext** unter dem Feld: „Diese ID beim entsprechenden Benutzer in Kundivent hinterlegen. Nur erforderlich, wenn diese Person Events an Kundivent übergibt.“
5. **Neu angelegte Benutzer**: Der Anlegen-Dialog zeigt die ID erst nach erfolgreicher Erstellung des Kontos, mit derselben Kopierfunktion und demselben Hilfetext. Vorher wird kein Platzhalter angezeigt.
6. Es wird keine eigene Integrations-ID erzeugt und keine Zuordnungstabelle angelegt. Kein Hinweis darauf, dass eine Person in Kundivent verknüpft sei – das ist von hier aus nicht überprüfbar.

## Technische Details

- `src/routes/_authenticated/_app/einstellungen/benutzer.tsx`: Aktion „Details“ und Dialog-State.
- Neue Komponente `src/components/users/UserIdField.tsx` (schreibgeschütztes Feld, Kopierlogik mit `navigator.clipboard` und Fallback über Textmarkierung) sowie `src/components/users/UserDetailDialog.tsx`.
- `src/components/users/CreateUserDialog.tsx`: Erfolgsschritt nach `createUser` (liefert bereits `{ id }`) statt sofortigem Schliessen; wiederverwendet `UserIdField`.
- Quelle der ID bleibt `ManagedUser.id` aus `listUsers`, das direkt aus dem Auth-Konto abgeglichen wird – identisch mit `source_actor_id` in `src/lib/kundivent.functions.ts`.
- Keine Migration, keine Änderung an Server-Funktionen, Rollen, Aktivierung oder RLS. Die ID wird ausschliesslich über die bestehende, adminbeschränkte Server-Funktion geliefert.

## Verifikation

- Abgleich der angezeigten ID mit der Absender-ID und der Datenbank.
- Kopieren im Browser prüfen (vollständiger Wert, Bestätigung erst nach Erfolg).
- Bestehende Benutzeraktionen (Passwort zurücksetzen, aktivieren/deaktivieren) weiterhin funktionsfähig.
- Aufruf der Benutzerverwaltung als Nicht-Administrator wird weiterhin abgewiesen.
