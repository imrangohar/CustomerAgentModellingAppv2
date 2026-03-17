# AppZen Design System Adoption

This project is aligned to the design guidance shared in:
- `/Users/akale/Downloads/appzeneng-product-design.zip`
- `DESIGN-SYSTEM-OVERVIEW.md` inside that archive

## What was adopted in this repo

1. Token-first styling policy
- Semantic color tokens are centralized in `src/app/globals.css`.
- Tailwind theme colors in `tailwind.config.js` are mapped to token variables.
- Components consume semantic tokens (`app-bg`, `app-card`, `app-border`, etc.).

2. Shared component-first policy
- Prefer existing UI primitives in `src/components/ui/*`.
- Prefer shared wrappers in `src/components/ui-extensions/*`.
- Avoid one-off custom controls if equivalent primitives already exist.

3. Enterprise layout conventions
- Dark left sidebar + light content canvas
- Card sections with soft borders
- Clear typography hierarchy for page, section, helper text

4. Accessibility baseline
- Focus-visible styles are globally defined in `src/app/globals.css`.
- Contrast-safe defaults for text and controls.

## Ongoing enforcement for future app work

- `AGENTS.md` in repo root contains mandatory design constraints.
- New pages should follow the same shell and tokenized styling.
- Hardcoded visual values should be treated as exceptions only.

## Notes

The ZIP mostly provides process/docs/rules and does not include a single importable npm package for this exact app. The current adoption is therefore implemented via token mapping, component usage rules, and repo-level standards.
