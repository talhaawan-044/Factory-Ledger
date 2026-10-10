# Factory Ledger Agent Instructions

Before working in this repository, read every file in `.agents/rules/` and `Ai-always-read-this/ai-read-this.md`. Follow the current issue-tracking instructions there and preserve unrelated working-tree changes.

## Mandatory UI Direction

All product UI must look and behave like a polished, native Apple iOS application. This requirement applies to every screen and every control, including date/time pickers, dropdowns, searchable selectors, text and number fields, dialogs, confirmations, alerts, bottom sheets, menus, tabs, switches, loading states, empty states, and toasts.

- Reuse the repository's established components before creating a new control: `IOSDatePicker`, `IOSSelect`, `FloatingField`, `IOSConfirmModal`, and the existing iOS sheet, navigation, grouped-card, segmented-control, and toast patterns.
- Do not use a raw browser `<select>`, browser date input, `alert()`, `confirm()`, or `prompt()` for product UI when an established app component can provide the interaction.
- Use mobile-first iPhone spacing, safe-area-aware layouts, at least 44px touch targets, clear pressed/selected/disabled/error/loading states, and complete light/dark theme support.
- Use flat solid colors only. Gradients, neon effects, and glowing shadows are forbidden.
- Prefer restrained separators, soft rounded corners, semantic iOS system colors, and the repository's Lucide icons. Do not use emoji when an appropriate icon already exists.
- Financial state must be explicit: linked, locked, calculated, unavailable, destructive, and sync-conflict states need clear inline explanations. Read-only accounting snapshots must look intentionally locked.
- Match neighboring screens and shared design tokens; never introduce an isolated visual language for one feature.
- **never** use emoji in the UI or in text. **EVER**. 

These instructions are always-on and apply even when a prompt does not repeat the iOS requirement.
