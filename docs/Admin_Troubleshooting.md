# Admin Troubleshooting

This document is for admins/IT running and deploying the prototype.

## Environment
- Framework: Next.js App Router
- Package manager: npm
- Persistence: browser localStorage (`policy-driven-ap-onboarding`)

## Basic checks
- Install: `npm install`
- Dev run: `npm run dev`
- Build check: `npm run build`
- Lint check: `npm run lint`

## Common issues and fixes

### 1) Dev lock error
Symptom:
- `Unable to acquire lock at .next/dev/lock`

Fix:
1. Stop running Next dev processes.
2. Remove lock/cache.
3. Start again.

Commands:
```bash
pkill -f "next dev" || true
rm -f .next/dev/lock
rm -rf .next
npm run dev
```

### 2) Port 3000 already in use
Symptom:
- `Port 3000 is in use ... using available port ...`

Fix:
- Use the exact `Local:` URL printed by terminal.

### 3) Turbopack font/TLS fetch issues
Symptoms:
- `Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'`
- TLS errors fetching `fonts.gstatic.com` resources

Fix options:
1. Clear cache and restart.
2. Avoid runtime Google font dependency in app layout.
3. Use webpack dev mode if needed in local troubleshooting.

### 4) Vercel build error: missing identifier
Example:
- `Cannot find name 'assignQuestion'` in `src/app/onboarding/page.tsx`

Fix:
- Ensure store destructuring includes `assignQuestion` when used.

### 5) Vercel/Next build error with `useSearchParams`
Example:
- `useSearchParams() should be wrapped in a suspense boundary at page "/collaboration/respond"`

Fix:
- Wrap the page content using `Suspense` and place `useSearchParams` logic in the child client component.

### 6) 404 route after creating a new app
Symptom:
- `/onboarding` returns 404

Fix:
- Ensure `src/app/onboarding/page.tsx` exists.
- Restart dev server after creating the file.

## Safe reset steps
When local state appears inconsistent:
1. Open browser developer tools for the app origin.
2. Remove localStorage key:
   - `policy-driven-ap-onboarding`
3. Reload app.

## Deployment checklist (Vercel)
1. Local build passes: `npm run build`
2. Commit + push to GitHub
3. Import repo in Vercel
4. Redeploy after each fix commit

## Known prototype constraints
- No real backend APIs
- No real email sending
- Settings page is informational/placeholder
- PDF/DOCX extraction is best-effort
