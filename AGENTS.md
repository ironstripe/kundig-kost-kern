<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Use `docs/KUNDI-UI-STANDARD.md` for shared visual roles while preserving KundiCalc's sidebar and yellow icon accent, because the family language must not alter calculation workflows.
- Ordinary form dialogs opt into `<DialogContent submitShortcut busy={pending}>` (Ctrl/Cmd+Enter = primary CTA, no close while saving); approval/handover/import-commit dialogs never opt in, so domain decisions stay separate from Save.
- Edit dialogs are mounted conditionally with `key={entity id}` so local form state never leaks between records; atomic value fields use `atomicInputProps` (Enter commits once, Escape restores, unchanged = no write).
- Interaction tests run with `bun run test` (vitest + jsdom, `vitest.config.ts`), kept separate from the app build config.
- Authenticated home is `/start`; it reveals calculation types only after intent selection, while `/uebersicht` remains the analytical dashboard and the logo is the sole home affordance.
