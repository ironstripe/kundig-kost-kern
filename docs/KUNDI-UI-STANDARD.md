# Kundi UI Standard — Family Standard v1 (KundiCalc)

Reference: KundiMKT Family Standard v1. This document governs shared visual language, not KundiCalc business rules, calculations, permissions, or workflows.

## Shared language, app-specific navigation

KundiCalc uses an expanded sidebar, collapsed icon rail, and mobile drawer. This is the chosen navigation pattern for its many calculation areas; do not replace it with KundiMKT's topbar. Active destinations use a subtle accent surface and readable foreground, not a filled primary button. Preserve child flyouts, navigation ownership, and local collapse preference.

## Typography

Manrope for UI text. Page titles: 24px/600. Section and work-area titles: 18px/600, sentence-case. Body: 15px. Controls and tables: 14px. Helpers and metadata: 12–13px. Use tabular numerals for CHF, percentages, dates, and aligned measures. Reserve monospace for genuinely technical identifiers; small uppercase micro-labels may remain metadata, not section headings.

## Colors and icons

Warm off-white background; near-white surfaces; dark green-black text; dark Kundi green primary actions. Semantic success green, warning amber, destructive red, neutral/blue info, muted inactive states. Use semantic tokens in both themes. No gradients or decorative color. Status color never substitutes for a text label.

KundiCalc's **#F8D04F** is its own icon/feature accent for navigation, sections, and empty states. The yellow KC icon and existing favicon remain KundiCalc-specific. Do not use yellow for every primary action, financial chart, status, or warning.

## Spacing and surfaces

Prefer 4/8/12/16/24/32/48px rhythm, 6–8px corners, subtle borders, minimal shadow, and horizontal row dividers. Keep cards where distinct calculations need functional grouping; avoid decorative nested cards.

## Controls and data

Default desktop controls about 36px; compact controls 32px; mobile/tablet interactive targets at least 44px where feasible. Icons 16–18px. Tables use clear headers, subtle hover, strongest entity column, right-aligned tabular numeric values, and compact desktop rows where the content allows. Retain existing columns, filters, and sorting.

Status is information, not a CTA. Avoid redundant badges, but never remove a status needed for costing or approval decisions. Keep action semantics and save behavior unchanged in Pass 1.

## Responsive

Review at 390px mobile, 768px tablet (drawer), 1024px desktop transition, and 1440px wide. No shell overflow at 390px. Dialogs, actions, labels, and rows must remain usable. The sidebar is KundiCalc-specific; calculation and business interfaces are also app-specific rather than prescribed by the family reference.

## Scope boundary

Family styling does not supersede project-specific business rules or existing operational behavior. Interaction and save-semantics harmonisation belongs to a separate Pass 2.