# Project Tracker: handoff for Claude Code

This folder has everything Claude Code needs to build the real app from the design.

## Build it with Claude Code on your Mac

1. Move this `project-tracker` folder to where you keep code, for example `~/code/project-tracker`.
2. Open Terminal in that folder and start Claude Code:

   ```bash
   cd ~/code/project-tracker
   git init
   claude
   ```

3. Paste this message:

   ```
   Read CLAUDE.md, SPEC.md and the three files in design/, then build the app SPEC.md describes. Before writing any code, ask me the questions in SPEC.md §1 and show me your plan, following the build order in §14. Wait for my OK, then build it step by step and commit after each step.
   ```

Claude Code will ask you three things first: which stack to use, whether your data should sync between phone and laptop, and where to host the app. Then it will show you its plan.

## Or use Claude Code on the web

1. Push this folder to a new private GitHub repository.
2. Open claude.ai/code and pick that repository.
3. Send the same message.

## What's inside

| File | What it is |
|---|---|
| `SPEC.md` | The build spec. It covers the screens, data and every behavior, the Claude Code prompt and report formats, design tokens, motion, accessibility, acceptance checks and build order. |
| `CLAUDE.md` | Short rules Claude Code reads at the start of every session. |
| `design/Main.dc.html` | The app prototype: every screen, on phone and desktop. |
| `design/DesignSystem.dc.html` | Foundations: colors, type, spacing, radii, elevation, icons, focus. |
| `design/Components.dc.html` | Components, the drag-and-drop demo and the motion specs. |

## Tips

- **If something doesn't match the design,** add a screenshot of the design to the Claude Code chat and ask it to match.
- **Use the tracker to build the tracker.** Once the app runs, add "Project Tracker" as a project in it, with this folder as its repository. Then use **Send to Claude Code** for new tickets and **Paste report** for the replies.
