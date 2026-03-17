# Extraction Report

Generated: 2026-02-27T23:52:28.384Z

## Inputs
- Schema PDF: /Users/akale/Downloads/Inbox AppZen Data Schema - AppZen Data Schema.pdf
- Deck PDF: /Users/akale/Downloads/Inbox AP Service Center First Call Deck_V2 (2).pdf

## What Was Extracted
- Schema sections detected: 1
- Deck agents detected: 8
- Canonical agents mapped into catalog: 8
- Schema domains mapped into catalog: 12

## Confidence Notes
- High-confidence deck matches: 4
- Medium-confidence deck matches: 4
- Low-confidence deck matches: 0

## Manual Review Checklist
1. Validate each field requirement level (mandatory/recommended/optional) against the schema PDF table.
2. Confirm every field's `usedByAgents` list matches the schema "Used for Agent(s)" column.
3. Review `impactIfMissing` wording and severity bucket (blocked/degraded/restricted).
4. For low-confidence deck agents, verify name/description from slide headings and adjust `sourceRef`.
5. If a schema field appears with variant names across exports, normalize to one key convention (snake_case).

## TODO: Manual Mapping Required
- None detected from deck heuristics.

## Key Normalization Convention
- Domain keys: lowercase snake_case (e.g., `invoice_header`)
- Field keys: lowercase snake_case (e.g., `payment_id`)
- Agent keys: lowercase snake_case (e.g., `payment_status_inquiry`)
