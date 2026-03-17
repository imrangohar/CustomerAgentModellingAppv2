# User Guide: Policy-Driven Autonomous AP Setup

## 1) Overview
This web app is a guided onboarding workspace for AP policy setup. It helps business users capture policy decisions, review prefilled suggestions from uploads, collaborate on unanswered questions, and export policy/SOP outputs.

Primary audience:
- Business users (Controller, AP Ops, Procurement, Treasury, Tax)

Secondary audience:
- IT/implementation users who need integration, troubleshooting, and export context

Key terms in the UI:
- `Step`: A stage in onboarding (Step 1 to Step 9)
- `Prefilled`: Suggested answer loaded from uploaded files or defaults
- `Confirm`: Marks an answer as accepted
- `Assign`: Sends a question to a teammate using a simulated share flow
- `Pending / Partial / Complete`: Section completion status

## 2) Roles & Permissions
There is no strict role-based access control in the current prototype.

What exists:
- Persona ownership labels per question (for guidance only)
- Collaboration assignment workflow with accept/reject states

What does not exist yet:
- User invitation management
- Permission-based restrictions by role

## 3) Quick Start
Use [Quick_Start.md](./Quick_Start.md) for a fast first run.

## 4) Navigation & Layout
Left sidebar routes:
- `/onboarding` → `Onboarding`
- `/inbox` → `Status`
- `/collaboration` → `Collaboration`
- `/sop` → `SOP`
- `/settings` → `Settings`

Top bar:
- Route title and subtitle
- Static `Help & Guidance` link

Notes:
- `/` redirects to `/onboarding`
- `Settings` is a placeholder in this prototype

## 5) Core Workflows

### Workflow A: Complete onboarding and activate
Goal:
- Capture required policy decisions and activate the prototype

Preconditions:
- Access to `/onboarding`
- Optional policy/input files for import

Steps:
1. In `Step 1: Onboarding Scope & Setup`, enter:
   - `Company Name`
   - `Rollout Track`
   - `ERP/P2P System`
   - `PO Usage Band`
   - `AP Team Size`
   - `Industry Vertical`
2. Click `Apply Tailoring`.
3. In `Step 2: Policy Inputs & Prefill`, upload files or click `Demo Mode: Auto-load Sample Policy Pack`.
4. Review prefilled records in `Controller Priority Review` and `Prefill Review Queue`.
5. Confirm values using `Accept` and optionally `Bulk accept high confidence (>=0.8)`.
6. Complete Steps 3 to 8 question by question.
7. In `Step 9: Review, Activate & Export`, use `Review missing`, `Assign remaining`, and `View SOP section`.
8. Click `Activate`.

Success looks like:
- High required confirmed counts in section cards
- Step 9 table shows mostly `Complete` or `Partial` with low unresolved items
- `/inbox` (`Status`) opens successfully after activation

Common mistakes and fixes:
- PO matching appears missing:
  - Cause: `PO Usage Band` is `none`
  - Fix: update Step 1 tailoring and re-apply
- Section stays incomplete:
  - Cause: answers are `prefilled_needs_confirmation` but not `confirmed`
  - Fix: click `Confirm` on required answers

What this affects:
- Section completion metrics
- Review hub readiness
- Exported policy/SOP outputs

### Workflow B: Upload and prefill
Goal:
- Import policy inputs and reduce manual entry

Where:
- `/onboarding` → Step 2 (`Policy Inputs & Prefill`)

Upload types in UI:
- `Accounting Policy`
- `AP SOP`
- `Procurement Policy`
- `DoA CSV/XLSX`
- `SOP Config CSV`
- `CoA CSV`
- `Cost Center CSV`
- `Other`

Steps:
1. Select `Upload Type`.
2. Click `Upload file`.
3. Review upload status message.
4. Open prefill queue items and confirm valid suggestions.

Success looks like:
- Upload status message confirms imported/extracted counts
- `Prefilled Policies` and confidence counters update

Common mistakes and fixes:
- `Upload parse failed` message:
  - Check file structure and selected upload type
- Weak document extraction from PDF/DOCX:
  - Use structured CSV (`SOP Config CSV`) for deterministic mapping

What this affects:
- Prefill queue quality
- Answer confidence and source references

### Workflow C: Collaboration assignment and acceptance
Goal:
- Route unanswered questions to teammates and confirm responses

Where:
- Assign from question rows in onboarding steps
- Bulk assign using `Assign by Step`
- Manage in `/collaboration`
- Respond in `/collaboration/respond?assignmentId=...&token=...`

Steps:
1. Click `Assign` on a question (or use `Assign by Step`).
2. Send/share generated response link.
3. Responder enters `Your Email`, `Your Answer`, optional `Comment`, then submits.
4. Controller opens `/collaboration` and uses `Accept` or `Request clarification`.

Success looks like:
- Assignment statuses progress through `sent`, `viewed`, `responded`, `accepted`
- Accepted responses update answer status to confirmed

Common mistakes and fixes:
- `Invalid token` on responder page:
  - Use the exact generated URL from the assignment action

What this affects:
- Audit trail and source history
- Section completion status

### Workflow D: SOP and policy exports
Goal:
- Produce shareable policy and SOP outputs

Where:
- Step 9 in onboarding
- `/sop`

Available actions:
- Step 9: `Export Policy and Controls` (PDF)
- `/sop`: `Save Version`, `Download PDF`, `Export JSON`

Success looks like:
- Downloaded files are generated successfully
- Saved SOP versions appear in the `Saved versions` list

## 6) Data/Input/Upload Guide
CSV and upload behavior implemented:
- `SOP Config CSV`: maps `policyKey` to prefilled values
- `CoA CSV`: loads accounts for account-picker questions
- `Cost Center CSV`: loads cost centers for cost-center-picker questions
- `DoA CSV/XLSX`: parses and stores matrix rows in approvals answer state
- Policy docs (`Accounting Policy`, `AP SOP`, `Procurement Policy`): best-effort text extraction and keyword inference

Supported CSV column expectations:
- CoA: `code`, `name`, `type`, `active`, optional `parentCode`/`parent_code`
- Cost Center: `id`, `name`, `active`, `ownerEmail`, `ownerName`, `entity`
- SOP Config: `policyKey`, `value`, optional `valueType`

Best practices:
- Use exact header names
- Prefer structured CSV for high-confidence prefill
- Confirm prefilled values before activation

## 7) Settings & Configuration
`/settings` currently displays a placeholder `Workspace Settings` card and informational text only.
No editable workspace-level settings are implemented yet.

## 8) Exports, Reports, and Audit
Available exports:
- Step 9 `Export Policy and Controls` (PDF)
- `/sop` `Download PDF`
- `/sop` `Export JSON`

Audit and traceability available in app state:
- Per-question sources (`manual`, `sop_csv`, `document_extract`, `collaboration`)
- Per-question history timeline
- Assignment audit trail
- SOP version snapshots

## 9) Notifications & Collaboration
Implemented collaboration behavior:
- Per-question assignment
- Multi-step assignment via `Assign by Step`
- Simulated communication helpers:
  - copied email text
  - mailto link text in confirmation alert
  - responder share link with token validation

Not implemented:
- Real email sending
- External notification channels (Slack/Teams/etc.)

## 10) FAQ & Troubleshooting

### Why can’t I complete a section?
Only required questions count toward completion. `Prefilled` answers still need `Confirm`.

### Why is a section/question not showing?
Step 1 tailoring controls visibility. Example: PO matching can be hidden when `PO Usage Band` is `none`.

### How do I reset and retry?
Clear local storage key `policy-driven-ap-onboarding` and reload the app.

### Where do I find history and sources?
Use `View sources` and `View history` on each question row.

### Where do I see collaboration status?
Use `/collaboration` and filter by status.

### How do I contact support?
Use your internal implementation owner/contact (placeholder in this prototype).

## 11) Admin/IT Reference (Code Map)
For implementation users, key workflow code is located at:
- Main routes: `src/app/onboarding/page.tsx`, `src/app/collaboration/page.tsx`, `src/app/collaboration/respond/page.tsx`, `src/app/sop/page.tsx`, `src/app/inbox/page.tsx`
- Layout and navigation: `src/components/layout/*`
- Question rendering and interaction: `src/components/QuestionRow.tsx`, `src/components/AssignmentModal.tsx`, `src/components/BulkAssignDialog.tsx`
- State and persistence: `src/store/onboardingStore.ts`
- Scope and status logic: `src/lib/scopeRules.ts`, `src/lib/layerStatus.ts`
- Prefill/import logic: `src/lib/prefillEngine.ts`, `src/lib/prefillMappings.ts`
- SOP/export logic: `src/lib/sopGenerator.ts`, `src/lib/pdfExport.ts`, `src/lib/policyControlsGenerator.ts`

## Screenshots
Screenshots are not included in this version due environment capture constraints.
Add images to `/docs/images` and reference them here when captured.
