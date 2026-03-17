# AppZen Design System Enforcement

This repository must follow the AppZen design system in all new UI work.

## Mandatory Rules

1. Use existing shared UI components first from `src/components/ui` and `src/components/ui-extensions`.
2. Do not hardcode colors, spacing, radii, or shadows in JSX unless there is a documented exception.
3. Prefer semantic classes/tokens (`bg-app-card`, `text-app-text`, `border-app-border`, etc.).
4. Keep typography hierarchy consistent:
   - Page title: `text-2xl` / `text-3xl` + `font-semibold`
   - Section title: `text-sm` / `text-base` + `font-semibold`
   - Helper text: `text-xs` / `text-sm` + muted color
5. Use enterprise layout pattern:
   - Dark left sidebar
   - Light content canvas
   - Card-based sections
   - Consistent spacing rhythm (`gap-4`, `p-4`, `p-5`, `space-y-5`)
6. Keep accessibility baseline:
   - Focus-visible styles
   - Sufficient contrast for text and controls
   - Keyboard reachable controls

## For New App/Route Scaffolding

When creating new app sections, start with:
- Shared shell (`src/components/layout/app-shell.tsx`)
- Shared top bar and sidebar
- Existing shadcn/AppZen-styled primitives
- Tokenized styles from `tailwind.config.js` and `src/app/globals.css`

## Review Checklist (required before completion)

- No obvious hardcoded hex values in page/components unless justified
- Uses shared primitives instead of one-off controls
- Visual hierarchy consistent with existing AppZen screens
- Spacing and button styles match existing patterns
- Works on desktop and mobile widths
