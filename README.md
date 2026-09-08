# KundiCalc Core

Build the foundation for a new internal web application called “KundiCalc”.

PRODUCT CONTEXT

KundiCalc is a prototype for the Kundelfingerhof restaurant in Switzerland. It will later calculate food cost, contribution margin and profitability for à-la-carte dishes and complete menu cards.

This first implementation step must only create:

- the application foundation

- navigation and responsive layout

- Supabase authentication

- central user management

- the core database schema

- empty application views

- initial demo configuration

Do not implement AI extraction, menu document uploads, Excel imports, calculation formulas, dashboards with invented results, or scenario calculations yet.

TECHNICAL FOUNDATION

Use:

- React and TypeScript

- the existing Lovable frontend stack

- Supabase database

- Supabase Auth

- Supabase Row Level Security

- reusable typed components

- additive database migrations

- clean separation between database access, business logic and UI

The interface language must be German.

Use Swiss formatting:

- currency: CHF

- decimal separator in the UI: decimal point or Swiss locale formatting consistently

- thousands separator: apostrophe

- dates: DD.MM.YYYY

- never use the German ß; use ss

- use normal German umlauts: ä, ö, ü

DESIGN DIRECTION

Create a clean, modern internal operations tool inspired by the clarity of Kundivent, but do not copy it visually.

The visual character should be:

- calm

- professional

- modern

- data-focused

- generous spacing

- strong readability

- minimal visual noise

- desktop-first

- usable on tablets

- responsive on mobile

Use a restrained natural colour palette suitable for the Kundelfingerhof:

- deep green as primary colour

- warm off-white backgrounds

- charcoal text

- subtle grey borders

- restrained accent colours

Do not use gradients, decorative illustrations, excessive cards or oversized marketing-style headings.

APP SHELL

Create a protected application shell with:

- desktop sidebar

- compact mobile navigation

- page header

- current user menu

- logout action

- clear active navigation state

Navigation items:

1. Übersicht

2. Speisekarten

3. Gerichte

4. Zutaten & EK

5. Szenario

6. Einstellungen

Under Einstellungen include:

- Benutzer

- Konfiguration

Only admins may access Einstellungen → Benutzer.

AUTHENTICATION

Implement the same central user-management principle used in Kundivent:

- no public self-sign-up

- no public registration page

- Supabase Auth is the only identity source

- users are created centrally by an admin

- login with email and password

- protected routes

- persistent authenticated sessions

- logout

- inactive users must be denied application access

- no passwords may be stored in public database tables

Create a profiles table linked one-to-one to auth.users with:

- id

- display_name

- is_admin

- is_active

- must_change_password

- created_at

- updated_at

FIRST PASSWORD FLOW

An admin creates a user with:

- display name

- email address

- temporary initial password

- admin yes/no

- active yes/no

The created user must have must_change_password = true.

After the first successful login, the user must be redirected to a mandatory password-change screen before accessing the application.

The new password must:

- be entered twice

- be validated

- be updated securely through Supabase Auth

- set must_change_password to false after success

An admin password reset must set a new temporary password and set must_change_password back to true.

Use secure server-side functions or Edge Functions for privileged user creation, activation, deactivation and password reset. Never expose a Supabase service-role key in the browser.

PROTOTYPE PERMISSIONS

There are only two access distinctions in this prototype:

- Admin: all application functions plus user management

- User: all application functions except user management

Do not create Viewer or Editor roles yet.

Enforce sensitive permissions server-side and with appropriate RLS policies. Do not rely only on hidden UI elements.

DATABASE SCHEMA

Create the following tables with UUID primary keys, foreign keys, timestamps and appropriate constraints.

1. profiles

Fields:

- id, references auth.users

- display_name

- is_admin

- is_active

- must_change_password

- created_at

- updated_at

2. menu_cards

Fields:

- id

- name

- valid_from

- valid_to

- vat_rate

- small_material_mode

- small_material_value

- opening_weekdays

- source_file_url, nullable

- import_status

- is_active

- created_at

- updated_at

- created_by

- updated_by

Use these defaults:

- name: Sommerkarte 2026

- valid_from: 2026-08-01

- valid_to: 2026-10-31

- vat_rate: 0.081

- small_material_mode: percent

- small_material_value: 0.03

- opening weekdays: Wednesday through Sunday

3. excluded_days

Fields:

- id

- menu_card_id

- excluded_date

- reason, nullable

Prevent duplicate excluded dates for the same menu card.

4. categories

Fields:

- id

- menu_card_id

- name

- sort_order

- is_food

5. dishes

Fields:

- id

- menu_card_id

- category_id

- name

- description, nullable

- sort_order

- notes, nullable

- is_active

- source_type

- created_at

- updated_at

6. variants

Fields:

- id

- dish_id

- name

- gross_price

- sales_input_mode

- expected_per_open_day

- expected_total

- small_material_override_mode, nullable

- small_material_override_value, nullable

- calculation_status

- is_default

- is_active

- notes, nullable

- created_at

- updated_at

- updated_by

Defaults:

- sales_input_mode: per_open_day

- expected_per_open_day: 1

- calculation_status: estimated

- is_active: true

7. add_ons

Fields:

- id

- menu_card_id

- name

- gross_price

- sales_input_mode

- expected_per_open_day

- expected_total

- small_material_override_mode, nullable

- small_material_override_value, nullable

- calculation_status

- is_active

- notes, nullable

- created_at

- updated_at

8. add_on_links

Fields:

- id

- dish_id

- add_on_id

Prevent duplicate dish/add-on combinations.

9. ingredients

Fields:

- id

- name

- category

- supplier, nullable

- package_quantity

- package_unit

- package_label, nullable

- package_price

- base_unit

- price_date, nullable

- is_own_production

- price_status

- source_type

- notes, nullable

- is_active

- created_at

- updated_at

- updated_by

Supported package units:

- kg

- g

- l

- ml

- piece

Supported base units:

- g

- ml

- piece

10. calculation_items

Fields:

- id

- variant_id, nullable

- add_on_id, nullable

- ingredient_id

- component_group

- net_quantity

- quantity_unit

- yield_percent

- sort_order

- quantity_source

- quantity_confirmed

- notes, nullable

- created_at

- updated_at

Add a database constraint requiring exactly one of variant_id or add_on_id to be populated.

11. import_jobs

Fields:

- id

- menu_card_id

- import_type

- file_url

- status

- extracted_payload, JSON or JSONB

- error_message, nullable

- created_at

- confirmed_at, nullable

Use enums or validated string constraints for fields with controlled values. Keep enum names and values in English internally while displaying German labels in the UI.

DATA SAFETY

Implement RLS for all application tables.

Requirements:

- unauthenticated users have no access

- inactive users have no access

- active authenticated users can read and modify the operational KundiCalc data

- only admins can list and manage user profiles beyond their own profile

- users may read their own profile

- users must not be able to promote themselves to admin

- users must not be able to reactivate themselves

- privileged Auth operations must run server-side

Do not create destructive cascade behaviour that could silently delete an entire menu card and all related calculations from the normal UI.

EMPTY VIEWS

Create functional empty-state pages for:

- Übersicht

- Speisekarten

- Gerichte

- Zutaten & EK

- Szenario

- Einstellungen → Benutzer

- Einstellungen → Konfiguration

The pages should explain their future purpose briefly, but do not display invented financial numbers.

On the Speisekarten page, show the initial “Sommerkarte 2026” configuration if it exists.

On Einstellungen → Konfiguration, allow admins and normal users to view the current configuration, but allow editing only if this is safely supported by the current permission model. Do not build detailed calculation behaviour yet.

USER MANAGEMENT UI

For admins, create a simple user-management screen with:

- user list

- display name

- email

- admin status

- active status

- create user

- activate/deactivate user

- reset temporary password

Require confirmation before deactivating a user or resetting a password.

Do not allow an admin to deactivate their own currently active account.

DELIVERABLE REQUIREMENTS

After implementation:

1. Summarise what was created.

2. List all database migrations and Edge Functions.

3. Confirm the implemented RLS rules.

4. State any steps that still require manual Supabase configuration.

5. Do not continue with menu calculations or AI import.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://kundig-kost-kern.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b902b395-5272-4eba-b8fc-e7224b7d3d8c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
