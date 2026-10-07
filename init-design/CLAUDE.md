# Project Tracker

A phone-first project tracker: projects → tickets → ticket detail. Tickets go out to Claude Code as copied prompts, and Claude Code's replies come back as pasted reports.

## Sources of truth

- **`SPEC.md`** describes every screen, rule, piece of copy and design value. Before changing anything, read the sections your task touches.
- **`design/*.dc.html`** is the approved prototype. Match its sizes, colors, copy and motion exactly. SPEC.md §0 explains how to read these files.
- **New features:** don't add anything that isn't in SPEC.md without asking first (see §15).

## Conventions

- **Tokens:** all colors, type, radii, shadows and motion come from one token file (SPEC.md §9–10). Components contain no raw hex values.
- **Screen sizes:** every screen must work at 375px and at 1280px wide.
- **Phones:**
  - touch targets are at least 44px
  - inputs use 16px text
  - safe-area insets are respected
- **Focus rings** must never be clipped (SPEC.md §11).
- **Pure logic in plain functions with unit tests.** This covers:
  - prompt builders
  - report parser
  - prefix derivation
  - ranks
  - drop logic
- **Before you say a task is done:** run the tests, plus the acceptance checks in SPEC.md §13 that your change touches. Check them at both widths.

## Reports

Some messages end with a TICKET / STATUS / SUMMARY / FILES / NEXT block template. When one does, end your reply with that block filled in.
