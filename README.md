# Policy-Driven Autonomous AP Onboarding (Prototype)

Enterprise-style Next.js prototype for AP onboarding with:
- Tailored 7-layer policy questionnaire (plus scoping + review hub)
- Upload + prefill (SOP CSV, CoA CSV, Cost Center CSV, DoA CSV, policy docs)
- Simulated collaboration assignments with share-link responder flow
- Layer completion statuses (Complete / Partial / Pending)
- SOP generation, local versioning, JSON export, and client-side PDF download

No backend and no real email sending are used. State persists in `localStorage`.

## Tech
- Next.js (App Router) + TypeScript
- Tailwind CSS + reusable UI components
- react-hook-form + zod
- Zustand persistence
- CSV parsing: `papaparse`
- DOCX parsing: `mammoth` (best-effort)
- PDF export: `jspdf`

## Run
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

## Routes
- `/onboarding`
  - Step 0: Initial Scoping (tailors layers/questions)
  - Step 1: Uploads + Prefill Review
  - Steps 2-8: Layers 1-7 questionnaire pages
  - Step 9: Review hub (status table, export, activate)
- `/collaboration`
  - Assignment dashboard, filters, accept/reject flow
- `/collaboration/respond?assignmentId=...&token=...`
  - Share-link responder page that writes back into app state
- `/sop`
  - SOP viewer, version save, PDF download, SOP JSON export
- `/inbox`
  - Mock activated inbox + collaboration request panel

## Scoping Tailoring Rules
- `poUsageBand = none` hides Layer 2 (PO/Matching) questions.
- Manufacturing/distribution + 3-way match increases requirement for GR/receipt/freight questions.
- Compliance modules are enabled from Phase 1 countries:
  - VAT module: Germany, UK, Nordics
  - India GST module: India
- If ERP is not SAP, all `sap.*` questions are hidden.
- If DoA exists, DoA upload/matrix questions are required.

## Uploads + Prefill
Supported upload types in Step 1:
- `SOP Config CSV` columns: `policyKey,layer,value,valueType,scope,notes`
- `CoA CSV` columns: `code,name,type,active,parentCode?`
- `Cost Center CSV` columns: `id,name,active,ownerEmail,ownerName,entity`
- `DoA CSV/XLSX` (CSV parsing in prototype)
- Policy documents (`.pdf`, `.docx`, `.txt`) for heuristic suggestions

Prefilled answers are stored as `prefilled_needs_confirmation` and must be accepted/confirmed.

## Collaboration Flow
For any question:
1. Assign teammate (name/email/persona)
2. Simulated outbound options:
   - Copy email text (auto-copied)
   - mailto link (shown in prompt)
   - Share link to responder page
3. Responder submits answer
4. Controller accepts response to confirm answer

All assignment and answer updates are persisted with source references and audit trail.

## SOP + Export
- `/sop` generates SOP text from scope + current answers.
- Unanswered values show `TBD`; responded-not-accepted shows `Awaiting confirmation`.
- Save snapshots as local SOP versions.
- Download SOP PDF client-side.
- Step 9 exports onboarding package JSON:
  - scope profile
  - answers + statuses + sources + history
  - assignments + audit trails
  - reference data metadata
  - layer statuses

## AppZen Design System
- This repo now enforces AppZen design-system usage via root [AGENTS.md](/Users/akale/Projects/my-codex-webapp/AGENTS.md).
- Token mapping is centralized in:
  - [globals.css](/Users/akale/Projects/my-codex-webapp/src/app/globals.css)
  - [tailwind.config.js](/Users/akale/Projects/my-codex-webapp/tailwind.config.js)
- Adoption notes from the provided design ZIP are documented in:
  - [AppZen_Design_System_Adoption.md](/Users/akale/Projects/my-codex-webapp/docs/AppZen_Design_System_Adoption.md)
