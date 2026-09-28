# Architecture Spike: Dish/Recipe independent of Speisekarte (analysis only)

Nothing was changed. Read-only inspection of the schema, current data and code.

## A. Current architecture map

Current data: 2 cards, 2 categories, 3 dishes, 6 variants, 40 calculation items, 2 add-ons, 2 add-on links, 1 menu, 0 menu positions, 2 events, 1 import job.

Finding from Pass 3.2: an inactive draft card **«Rehrücken»** (created 2026-09-27 22:04, validity 28.09–28.09, 0 dishes) was created by the Pass-3.2 flow. It's listed here only. Removing it is a separate, explicit decision.

| Table | Card coupling | Notes |
|---|---|---|
| menu_cards | – | holds VAT, small-material default, validity, opening weekdays |
| categories | `menu_card_id NOT NULL`, FK RESTRICT | **per card**, structurally bound |
| dishes | `menu_card_id NOT NULL`, FK RESTRICT; `category_id` FK SET NULL | every dish has exactly one card; its category is on the same card (verified for all 3 rows) |
| variants | `dish_id` only | **gross price, sales quantity (per_open_day/total), small-material override are on the variant**, so they're dish-level today |
| calculation_items | `variant_id` / `add_on_id` | recipe components are dish-level, no card reference |
| ingredients | none | global |
| add_ons | `menu_card_id NOT NULL` | per card; add_on_links connect add-on and dish |
| excluded_days, import_jobs | `menu_card_id` | truly card-specific |
| menus / menu_positions | `variant_id` | not card-bound; the menu has its own VAT |
| events / event_menu_links | menu + snapshot | not card-bound |

## B. Dependency classification

**A: true card domain (keep):** opening days and excluded days, used for `openDaysCount` in the à-la-carte total (`menu-totals.ts`); card validity; card-level scenario overrides for small material; import_jobs and storage path `uploads/{cardId}/`; card counts; card admin (`MenuCardSummary`, `MenuCardConfigDialog`).

**B: accidental prototype coupling (remove):**
- `dishes.menu_card_id NOT NULL`
- the Gerichte list is filtered by the selected card (`gerichte.index.tsx:86`), so creating a dish requires a card
- `createCategory(menuCardId)`
- `DishLike.menu_card_id: string` in `menu-costing.ts` and `DishPickerDialog`, which only look up the card for VAT and small material

**C: compatibility (adapt step by step):**
- `calculateVariant(…, card | null)` already works **without a card**: VAT falls back to `VAT_RATE_DEFAULT` (8.1 %) and small material to percent 3 %
- `menuCardDataQuery` (card view) stays as it is
- `import.functions.ts` matching by name within a card (lines 272/373)
- `import_menu_payload` inserts dishes and categories under the card
- add-ons stay per card for now

## C. Comparison of the options

| | A: nullable `menu_card_id` | B: `menu_card_dishes` join table | C: recipe master + card usage |
|---|---|---|---|
| Supports Rehrücken without a card | yes | yes | yes |
| Same dish on several cards | no | yes | yes |
| Migration effort | 1 column + policy check | new table, backfill, all card queries switched to the join | new entity, duplicated variants/items or re-pointing, very large |
| Risk to calculations | minimal (already runs with null) | medium: sales quantity is on the variant, so it would have to move to the join for real reuse | high |
| Categories | card-less dish without a category, or a new global category | category moves into the join | category stays on the usage |

The effort of C isn't justified with 3 dishes. B only pays off once the same dish is actually sold on several cards at the same time. Even then, **sales quantities (variant level) would have to move to the join**, which touches à-la-carte analysis and scenarios.

## D. Recommended target model (smallest safe step: Option A, B-compatible)

```text
dishes.menu_card_id   uuid NULL   (FK stays, RESTRICT)
dishes.category_id    NULL allowed as today; trigger enforces:
                      category.menu_card_id = dish.menu_card_id, or both null
dishes.source_type    unchanged (manual | menu_import)
```

- A dish without a card is a **library dish**: calculable and usable in Menüs and Events, but not part of any à-la-carte total or card analysis.
- Assigning a dish to a card = setting `menu_card_id` (the move stays explicit).
- The path to B stays open: later, `menu_card_dishes` can be backfilled 1:1 from `dishes.menu_card_id` without changing IDs.

## E. Migration and backfill

1. Additive: `ALTER COLUMN menu_card_id DROP NOT NULL` plus a consistency trigger for category and card. **No backfill needed**: all 3 dishes keep their card, and every ID stays the same.
2. Variants, calculation items, menu_positions (variant_id), event snapshots and URLs (`/gerichte/$dishId`) are unaffected.
3. RLS: current policies check active users, not the card (to confirm before building). Unchanged.
4. Code compatibility: `DishLike.menu_card_id: string | null`, and a null-safe card lookup in `menu-costing`, `DishPickerDialog` and `gerichte.index` (list shows «Ohne Speisekarte» / all dishes). Card views keep filtering with `.eq(menu_card_id)`, so card-less dishes automatically drop out of card analyses.
5. Rollback: while no card-less dishes exist, `SET NOT NULL` again. Afterwards, assign each card-less dish to a card first, then set NOT NULL. No destructive cleanup in this phase.

## F. Calculation decision points

- **Recipe level (card-independent today):** calculation items, ingredient prices, yield, food cost in CHF. So Rehrücken's **food cost** can be calculated today without a card.
- **Selling context:** gross price (variant), VAT and small material (card or variant override), sales quantity (variant, but meaningful only together with the card's opening days).
- Without a card, the code silently uses 8.1 % VAT and 3 % small material today. **Decision needed:** should a library dish keep these defaults and show them visibly as «Standard-Annahme» (recommended, no new economics), or show only food cost, with DB I shown only once a card is assigned?
- Sales quantity on a library dish: hide it or mark it as «nicht in à-la-carte-Auswertung»; no change to the formula.

## G. Import and signature recipes (target flow)

1. The import stays card-bound (job, storage, review unchanged).
2. Change in the review step only: match against **all** dishes (library plus the card), not just the card (`import.functions.ts:272`).
3. Actions per item: «Neu anlegen» (dish on the card), «Bestehendes Gericht zuordnen» (sets `menu_card_id` on a library dish), or «Aktualisieren».
4. Provenance: `source_type = menu_import` plus import_jobs as today.
5. Card prices are written to the variant (as today). With Option A that isn't a leak, because a dish has at most one card. With Option B it would require price overrides in the join.

## H. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Duplicate dishes from repeated imports | card-wide name matching in the review, plus a «Duplikat möglich» notice |
| Historical cards change when the recipe changes | menus and events already use immutable snapshots; à-la-carte cards are live today (unchanged behaviour, documented) |
| Card prices leak into a global recipe | not possible with Option A (one card per dish). Price overrides only come with Option B |
| Category ambiguity | trigger: category only on the same card; library dishes without a category |
| Card analyses lose scope | card queries keep filtering by `menu_card_id`, so library dishes are excluded |
| Menu/event calculation changes unexpectedly | null card gives exactly the current fallback values; a parity test compares old and new results |

## I. Smallest informative implementation test

Automated only, using an in-memory fixture (no production write): a «Rehrücken» dish with `menu_card_id = null`, 1 variant, 3 items.
- Success: `calculateVariant(v, items, ing, null)` returns the expected food cost and DB I with 8.1 % / 3 %. Menu costing with this variant gives a result with no errors. `calculateMenuCardTotals` for Sommerkarte 2026 is **exactly identical** before and after (parity snapshot of the 3 existing dishes). The category trigger rejects a foreign category.
- Failure: any difference in existing totals, a crash with a null card, or a card-less dish showing up in the card analysis.
- The schema part (DROP NOT NULL plus trigger) is checked in a separate draft or preview environment before it's applied to live data.

## Phases (tailored)

1. Additive schema change plus null-safe code plus parity test.
2. Dish-first creation: `Kalkulation starten → Gericht → Name` creates a library dish and opens the detail page. Undo the Pass-3.2 draft card creation in the launcher.
3. Import review with library matching.
4. Option B only when multi-card reuse is actually needed.

## J. Verdict: NEEDS ONE DECISION

Technically ready. The model (Option A) and the migration are small and additive. The open product decision: **how is a card-less dish priced?** Either with visible standard assumptions (8.1 % VAT, 3 % small material, shown as DB I), or food cost only until it's assigned to a card. There's also a follow-up question: should the orphaned draft card «Rehrücken» be removed or kept?
