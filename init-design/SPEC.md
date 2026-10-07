# Project Tracker: build spec

A simple project tracker that feels like a native app on a phone and works well on desktop.

The flow is **Projects → Tickets → Ticket detail**. There is also a two-way loop with Claude Code:

- **Send:** copy a ready-made prompt for one ticket, or for all open tickets in a project.
- **Report back:** paste Claude Code's reply. Its `TICKET / STATUS` block updates the tickets.

The design was built and approved as an interactive prototype; its files are in `design/`. This document describes the same thing in words: every screen, rule, piece of copy, design value, motion and accessibility requirement.

---

## 0. How to use this folder

| File | What it is |
|---|---|
| `SPEC.md` | This file. The source of truth for behavior. |
| `design/Main.dc.html` | The approved app prototype: every screen, sheet and behavior. It is responsive: below 768px it switches to the phone layout. |
| `design/DesignSystem.dc.html` | Foundations: colors, type, spacing, radii, elevation, sizes, icons, focus. |
| `design/Components.dc.html` | Components, a working drag-and-drop demo, and the motion specs. |

**Matching rule.** Match the design files exactly: sizes, colors, copy, spacing and motion. If this spec and a design file disagree on something visual, the design file wins. If they disagree on behavior, ask.

**How to read a `.dc.html` file.** Each one is an artboard exported from a design tool:

- **Markup** is plain HTML. Inline styles hold the exact values to match.
- **`{{ name }}`** is a value or handler returned by `renderVals()`. That function lives in the `<script type="text/x-dc">` block at the bottom of the file.
- **Event props** like `onClick="{{ open }}"` are handlers from that same object.
- **`<sc-if value="{{ x }}">`** renders its children when `x` is truthy.
- **`<sc-for list="{{ items }}" as="t">`** repeats its children once per item, so you can use `{{ t.title }}` inside. Ignore the `hint-*` attributes; they are design-tool hints.
- **`class Component extends DCLogic`** works like a React class component (`this.state`, `this.setState`, lifecycle methods). Read it for exact rules. It contains the prompt builders, report parser, ranks, drag and drop, dropdown placement, and so on.
- **`<helmet>`** holds the font links and a `<style>` block with hover, focus, keyframes and phone overrides.
- **`support.js`** is the design tool's runtime. It is not included and not needed.

---

## 1. Decide with the user before writing code

Ask these questions and wait for answers. The defaults are suggestions.

1. **Stack.**
   - Default: React + TypeScript + Vite, plain CSS with CSS variables for the tokens, and no UI kit. The prototype is HTML/CSS, so it ports one to one.
   - Other options are fine, for example Flutter web or Next.js.
2. **Data.**
   - Default: on this device only, using IndexedDB or localStorage, like the prototype.
   - Alternative: sync between phone and laptop. That needs a backend and sign-in, for example Supabase, or a small Node/Express API with SQLite.
   - Either way, keep all reads and writes behind one storage module so sync can be added later.
3. **Install and hosting.**
   - Default: an installable PWA. It gets a home-screen icon, opens full screen and works offline.
   - Deploy as a static site: Vercel, Netlify, Cloudflare Pages or GitHub Pages.
4. **First run.**
   - Default: start empty, showing the "No projects yet" state.
   - Keep the prototype's sample data (`seed()` in `Main.dc.html`) as a fixture for development and tests only.

---

## 2. The product

- **Projects** have a name, a short ticket prefix (for example `MOB`), an optional description and an optional repository/folder path. The path is added to every Claude Code prompt.
- **Tickets** belong to a project and are numbered with that prefix: `MOB-1`, `MOB-2`… Each ticket has:
  - a title and description
  - a status: **To do**, **In progress** or **Done**
  - a priority: **High**, **Medium** or **Low**
  - an assignee (free-text name) and a due date
  - an activity timeline of events, comments and Claude Code reports
- **Ordering.** Within each status, tickets are in a manual order. Change it by dragging, or with the arrow keys on the drag handle.
- **One user.** There are no accounts in the design. Every activity line is written as "You …".

---

## 3. Layout and navigation

**Breakpoint.** Phone is `max-width: 767px`. Desktop is 768px and up.

### Desktop

**Sidebar.** 240px wide, background Fill `#F7F7F8`, 1px right border Line `#EBEBEE`, padding 12px 8px, items stacked with 20px gaps.
- **Brand.** A 22×22 logo tile (radius 6, Ink background, white 2×2 squares glyph, two of them at 55% opacity) next to "Tracker" (14/600).
- **Nav item "All projects".** Uses the layout-grid icon.
- **Projects section.**
  - Header: "Projects" (12/500 Muted) with a 24×24 "+" button (aria-label "New project").
  - One item per project: a 10×10 color square (radius 3), the name (ellipsis) and the open-ticket count (12px `#8E8E99`, tabular numbers).
- **Items.** 32px tall, radius 8, 13px text.
  - Hover: Fill 2 `#EFEFF1`.
  - Active (`#EFEFF1`): "All projects" on the Projects screen. A project when you are on it or on one of its tickets.

**Header.** 52px tall, 1px bottom border, padding 6px 16px 6px 20px.
- **Breadcrumb** (13px):
  - Projects screen: `Projects`
  - Project screen: `Projects › ■ Project name`
  - Ticket screen: `Projects › ■ Project name › MOB-3`. The key is mono 12/500.
  - Crumbs that link are 28px buttons, Muted. Hover: Ink text on Fill.
  - Separators are a 14px chevron-right in `#B4B4BC`.
- **Right side:**
  - Projects screen: a "New project" primary button.
  - Project screen: a "New ticket" primary button and a 32×32 "•••" button (aria-label "Project options") that opens the options menu (§5.4).

### Phone

There is no sidebar and no desktop header.

**Nav bar.** Sticky at the top, 52px, padding 4px 6px. Background `rgba(255,255,255,0.9)` with `backdrop-filter: saturate(180%) blur(16px)` and a 1px bottom border. It has three columns:

| Screen | Left | Center title | Right |
|---|---|---|---|
| Projects | none | none (the page has a large "Projects" title) | "+" New project |
| Project | "‹ Projects" | Project name | "•••" Project options, "+" New ticket (To do) |
| Ticket | "‹ {Project name}" | Ticket key, in mono | An empty 44px spacer, so the title stays centered |

- The back button is a 20px chevron-left plus a 16px label, 44px tall. The label ellipsizes.
- The title is 15/600 with ellipsis. When it changes, it fades up 4px over 260ms.
- Right-side buttons are 44×44 and round, with 20px icons.

**Bottom action bar.** Shown on the Project and Ticket screens.
- Fixed to the bottom, with background `rgba(255,255,255,0.92)`, the same blur, and a top border.
- Padding: 10px 16px, plus `env(safe-area-inset-bottom)` at the bottom.
- Two buttons, 48px tall, radius 12, 15px text:
  - "Paste report": secondary, with the clipboard-check icon, `flex: 1`.
  - Primary, with the terminal icon, `flex: 1.35`. Label: "Send open tickets" on a project, "Send to Claude" on a ticket.
- Slides up over 340ms when it appears.

### Routes

The prototype keeps the current view in state. The real app should use URLs:

- `/`: Projects
- `/p/:key`: Project, for example `/p/MOB`
- `/p/:key/:num`: Ticket, for example `/p/MOB/3`

**Behavior:**
- Browser back/forward and refresh must work.
- An unknown ticket falls back to its project. An unknown project falls back to Projects.
- Opening a project resets the filter to All and clears the search.
- Every navigation scrolls to the top.

**Transitions:**
- Going deeper ("push"): the new content slides in from x+28px with a fade.
- Going back ("pop"): it slides in from x−28px.
- Both take 240ms with ease-out.
- On first load, content fades up 6px.

---

## 4. Screens

### 4.1 Projects

**Container.** Padding 28px 32px 48px (16px at the sides on phones). Content max-width 1040px, 16px gaps.

**Title row.**
- "Projects" as an `h1`: 20/600, letter-spacing −0.015em. On phones it is the large title: 30/700, −0.02em, line-height 1.15.
- The project count beside it: 13px `#8E8E99`.

**Empty state.**
- A bordered box: radius 12, padding 56px 24px, centered.
- Inside: a 44×44 tile (radius 12, Fill, folder icon at 20px), then "No projects yet" (15/600), then "Projects hold your tickets. Create one to get started." (13px Muted, max-width 280).
- A primary "New project" button below.

**List.** A container with a 1px Line border, radius 10 (12 on phones) and `overflow: hidden`.
- **Header row** (desktop only): 36px tall, Fill background, 12px Muted text. Columns: **Name** (flex), **Progress** (168px), **Open** (56px, right-aligned), **Updated** (96px, right-aligned).
- **Rows.** Each is a button, at least 60px tall, padding 10px 16px, gap 16:
  - Name column: a 10×10 color square, the name (500 weight, ellipsis), the key (mono 12 `#8E8E99`). Below them, the description (13px Muted, ellipsis), or "No description".
  - Progress: a 4px bar (track `#EFEFF1`, fill Accent `#5B5BD6`, radius 2). The fill grows from 0 over 700ms. Next to it, "NN%" (12px Muted, 36px wide, right-aligned).
  - Open: 13px, tabular numbers.
  - Updated: a relative time (13px Muted).
  - On phones, Progress and Updated are hidden and a 20px chevron-right (`#B4B4BC`) is shown at the end.
  - Rows are separated by 1px Line. Hover: Fill.
  - Rows rise in, staggered 24ms each (max 12 rows).

**Values.**
- Order: creation order.
- Open: tickets that are not Done.
- Progress: `round(done / total × 100)`, or 0 when the project has no tickets.
- Updated: the newest of the tickets' `updatedAt` and the project's `createdAt`.

### 4.2 Project

**Desktop toolbar.** Padding 16px 32px 0. It wraps, with 8px gaps, and holds:
- The repository path, if set: folder icon (14px) plus the path in mono 12 `#55555F`, ellipsized.
- "Send open tickets to Claude Code": a secondary button, 30px, with the terminal icon.
- "Paste report": a secondary button, 30px, with the clipboard-check icon.

On phones these actions live in the bottom bar.

**Filter row.** Padding 14px 32px 16px. It wraps and uses `space-between`, with gaps of 10px 16px.

- **Segmented control.**
  - Role `group`, aria-label "Filter tickets". Up to 300px wide; full width on phones.
  - Track: Fill 2 `#EFEFF1`, radius 10, padding 2px. Three equal buttons with a 2px gap.
  - Buttons: 30px tall, 13/500. On phones: 34px, 14px. The labels are "All", "Active" and "Done", each followed by a count (12px `#8E8E99`, tabular numbers).
  - The selected button has Ink text; the others are Muted. Each button has `aria-pressed`.
  - A white thumb sits behind the selected button: radius 8, Raised shadow, width `calc((100% - 8px) / 3)`, `transform: translateX(calc(index * (100% + 2px)))`. It slides with a 260ms spring.
  - The counts always cover the whole project. Search does not change them.
- **Search.**
  - A label wrapping a search icon (16px) and an input with the placeholder "Search tickets" (aria-label "Search tickets").
  - 240px wide (min 160), 34px tall, radius 8, 1px Control line `#DEDEE3`.
  - On phones: full width, 40px tall, filled `#EFEFF1`, no visible border.
  - Focus: the border turns Accent, plus a 1px Accent ring.

**Empty project.** Centered, padding 64px 24px:
- A 44px tile with a plus icon.
- "No tickets yet"
- "Create the first ticket for {Project name}."
- A primary "New ticket" button.

**No results.** "No tickets match." (13px Muted, centered, padding 48px 24px).

**Groups.** A column with 16px gaps and padding 0 32px 24px (16px at the sides on phones). One card per status, in the order **In progress**, **To do**, **Done**. A group with no visible tickets is hidden, except during a drag (§7.4).

- **Card.** A `section` with aria-label set to the status label. 1px Line border, radius 12, `overflow: hidden`, white background.
- **Header.**
  - 40px tall, padding 0 8px 0 16px, Fill background, 1px bottom border, 13px text.
  - Contents: the status glyph (16px), the label (500 weight), the count (`#8E8E99`), a spacer, then a 28×28 "+" icon button. The button's aria-label is "New ticket in {Status}", and it opens New ticket preset to that status.
  - While a ticket is being dragged in from another status, the header background turns `#EEEEFC` (160ms transition).
- **Ticket row.** At least 44px tall (52px on phones). Rows are separated by 1px Line; hover is Fill. Clicking a row opens the ticket. Each row has:
  - **Drag handle** at the left (§7.4).
  - **Main button**, padding 8px 16px 8px 36px (left padding 40px on phones), gap 12. Contents, left to right:
    - priority bars (16px)
    - the key (mono 12 Muted, 64px wide)
    - the status glyph (16px)
    - the title: flexes, ellipsizes, line-height 1.4. Done tickets use Muted text. On phones the title wraps.
    - the due date, if set: calendar icon (14px) plus "Oct 9" at 12px, in `#55555F`, or Danger when overdue. Hidden on phones.
    - the avatar (24px)
- **Footer.** "Show N more" (§7.3).
- **Bottom padding.** The page has 96px of bottom padding, so content clears the phone bar.

### 4.3 Ticket

**Grid.**
- Desktop: `grid-template-columns: minmax(0,1fr) 300px`, with areas `"main side" "act side"`.
- Phone: one column, in the order main → side → activity.

**Main.** Padding 28px 40px 8px, max-width 760. Contents:
- The key: mono 12 Muted.
- **Title**: a borderless textarea that grows with its content. 22/600, line-height 1.3, letter-spacing −0.015em. Placeholder "Ticket title".
- **Description**: a borderless growing textarea. 14px, line-height 1.65, color `#2A2A30`, min-height 96px. Placeholder "Add details, steps or acceptance criteria…".
- Both textareas have a transparent 1px border and radius 8. They are offset −7px so the text lines up with the key. Hover border: `#DEDEE3`. Focus border: Accent.
- Changes save as you type and add no activity event.

**Side panel.**
- Padding 24px 20px 40px, background Panel `#FBFBFC`, 1px left border. On phones: no left border, a top and bottom border instead.
- Sections are stacked with 20px gaps.

1. **Claude Code** (desktop only):
   - The label "Claude Code" (12/500 Muted).
   - "Send to Claude Code": a primary button, full width, 36px.
   - "Paste report": a secondary button, full width, 36px.
   - "Last report 2h ago" (12px Muted), only if the ticket has a report.
2. **Details.** The label "Details", then a grouped card (white, 1px Line border, radius 12). Each row is 44px tall (50px with 16px text on phones), separated by 1px Line, with a `#FAFAFB` hover:
   - **Status**: a button that opens the dropdown. It shows the glyph, "Status", the value in Muted, and a chevron-down in `#B4B4BC`.
   - **Priority**: the same pattern with priority bars.
   - **Assignee**: a label row with a 20px avatar, "Assignee" and a right-aligned text input (placeholder "Unassigned").
     - Suggestions are every assignee name used on any ticket, sorted (a `<datalist>` is fine).
     - On blur, if the trimmed value changed, log an event (§6.2).
   - **Due date**:
     - Contents: a calendar icon, "Due date", and the value ("Wed, Oct 7", or "None").
     - Colors: the icon and the value share one color. It is `#55555F` when a date is set, Danger when overdue, and `#9A9AA3` with no date. In the New ticket sheet the icon is `#6B6B76`, or Danger when overdue.
     - When a date is set, a clear button appears: 24px round, `#EFEFF1`, x icon, aria-label "Clear due date". Otherwise a chevron-down shows.
     - The whole row is covered by a native `<input type="date">` at opacity 0, which calls `showPicker()` on click. The clear button sits above it.
3. **Info card** (13px). Rows are 40px with labels on the left and values on the right:
   - **Project**: color square + name
   - **Created**: "Oct 2, 2026"
   - **Updated**: relative time
4. **Delete ticket**: a text button in Danger with the trash icon. It opens an inline confirm card (role `alert`, 1px `#F4CFCA` border, radius 12, padding 12):
   - Text: "Delete MOB-3? This can't be undone."
   - Buttons: "Cancel" (secondary) and "Delete" (filled Danger).
   - Delete goes back to the project and shows the toast "MOB-3 deleted".

**Activity.**
- Padding 8px 40px 56px. On phones the bottom padding is 120px, to clear the bar.
- Max-width 760, a 1px top border, and the heading "Activity" (14/600). Items run oldest first and rise in, staggered 16ms (max 10).

| Item | Look |
|---|---|
| **Event** | A 6px dot (`#C4C4CC`) in a 20px slot, then "**You** {text} · {when}". 13px Muted; "You" in Ink 500; the time in `#9A9AA3`. |
| **Comment** | A card: 1px Line border, radius 12, padding 12px 14px. Header: a 20px Ink avatar reading "Y", "You" (500), and the time. Body: 14px, `pre-wrap`, `#2A2A30`. |
| **Report** | A card with background `#F7F7FE` and border `#E3E3F8`. Header: a 20px Ink tile (radius 6) with a white terminal icon, "Claude Code report" (500), and the time. Body: mono 12.5px, line-height 1.6, `pre-wrap`, `overflow-wrap: anywhere`. |

**Composer.**
- A bordered box: Control line border, radius 12. On focus, the border turns Accent with a 1px ring.
- It holds a growing textarea (placeholder "Leave a comment…", min-height 64px) and a "Comment" secondary button.
- The button is disabled until the text is non-blank. Submitting adds a comment and clears the box.

---

## 5. Sheets, menus and feedback

### 5.1 Sheet shell (New ticket, New/Edit project, Send to Claude Code, Paste report)

- **Desktop:** a centered dialog, 10vh from the top (8vh for prompt and report).
  - Max-widths: 540px for ticket and project, 620px for prompt, 600px for report.
  - Radius 14, Overlay shadow. The overlay scrolls if the dialog is taller than the screen.
- **Phone:** a bottom sheet at full width.
  - Radius 14px on the top corners only, with a 36×5 grabber (`#DEDEE3`) at the top.
  - `max-height: calc(100vh - 32px)` with internal scrolling, and safe-area padding at the bottom.
- **Scrim:** `rgba(20,20,26,0.36)`. Tapping it closes the sheet.
- **Escape:** closes the sheet. If a dropdown is open, Escape closes only the dropdown.
- **Header:**
  - 56px tall with a bottom border, in three columns.
  - Left: a text button ("Cancel" or "Close").
  - Center: the title (15/600), with an optional subtitle (12px Muted).
  - Right: the primary action ("Create", "Save" or "Apply"), 32px tall. On phones it is 34px with 15px text. It sits at 35% opacity and is disabled until the form is valid.
- **Motion:**
  - Desktop dialog: in 240ms (from scale .97, y+10px); out 160ms.
  - Phone sheet: slides up in 340ms; down in 220ms.
  - Unmount after the exit animation.
- **Focus:** when New ticket or New project opens on desktop, focus the first field. Don't do this on phones, so the keyboard doesn't jump up.

### 5.2 New ticket

**Header.** "Cancel" | "New ticket", with a subtitle showing an 8px color square and the project name | "Create".

**Body.**
- A title input: 20/600, letter-spacing −0.01em, placeholder "Ticket title".
- A description textarea: 15px, line-height 1.55, placeholder "Add details, steps or acceptance criteria…". It grows up to 40vh.
- A grouped card, the same as the ticket's Details: Status and Priority (dropdowns), Assignee (with suggestions), Due date.

**Defaults.** Status To do, or the group's status when opened from a group's "+". Priority Medium.

**Validation.** Create stays disabled until the title has text. Pressing Enter with a blank title shows "Add a title to create the ticket." (role `alert`, Danger).

**Create.**
1. The new ticket's number is the project's `nextNum`; then `nextNum` goes up by one.
2. The ticket is placed at the top of its status group.
3. Event "created the ticket".
4. If the current filter would hide the new ticket, or any search text is active, reset the filter to All and clear the search.
5. Close the sheet, highlight the row (§5.6), and show the toast "MOB-7 created".

### 5.3 New / Edit project

**Header.** "Cancel" | "New project" or "Edit project" | "Create" or "Save".

**Body.**
- A name input: 20/600, placeholder "Project name".
- A description textarea: placeholder "What is this project about?". It grows up to 30vh.
- A grouped card with:
  - **Repository**: folder icon, a mono 13px input, placeholder `~/code/my-app`.
  - **Ticket prefix**: hash icon, a mono uppercase input whose placeholder is the derived key (§6.2). Shown only when creating, because the prefix can't change later.

**Hint** below the card (12px Muted):

| State | Hint |
|---|---|
| New, nothing typed | "Tickets are numbered with a short prefix, like MOB-1. The repository is added to every Claude Code prompt." |
| New, after typing | "Tickets will be numbered MOB-1, MOB-2 and so on. The repository is added to every Claude Code prompt." It uses the typed prefix (cleaned up) or the derived one, before any duplicate suffix. |
| Edit | "The repository is added to every Claude Code prompt for this project." |

**Validation.** Create stays disabled until the name has text. Pressing Enter with a blank name shows "Add a name to create the project."

**Create** opens the new project with a push transition and shows the toast "“Name” created". **Save** shows the toast "Project updated".

### 5.4 Project options

**Desktop.** The "•••" button opens a popover:
- 260px wide, right-aligned, 6px below the button. Radius 10, Floating shadow, padding 4.
- Items are 34px tall and 13px:
  - "Edit project" (pen-line icon)
  - "Delete project" (trash icon, Danger)
- "Delete project" turns the menu into a confirm: "Delete this project and its N tickets? This can't be undone." with "Cancel" and "Delete" (filled Danger).
- Clicking outside closes the menu.

**Phone.** An action sheet:
- It sits at the bottom with 8px margins plus the safe area, and has two white cards (radius 14) with an 8px gap.
- Card 1:
  - A caption with the project name (13px Muted, centered).
  - "Edit project"
  - "Delete project" (Danger)
  - Rows are 56px tall with 17px text.
- Card 2: "Cancel" (17/600).
- "Delete project" changes the caption to "Delete “Name” and its N tickets? This can't be undone." and leaves a single "Delete project" button (Danger, 600).

**Delete.** Removes the project and all its tickets, returns to Projects (pop), and shows the toast "“Name” deleted".

### 5.5 Status and priority dropdown

The status and priority pickers are dropdowns. Use a custom listbox, not a segmented control and not a native `<select>`.

**Trigger.** `aria-haspopup="listbox"`, with `aria-expanded` reflecting the state.

**Menu.**
- `role="listbox"` with aria-label "Status" or "Priority".
- Fixed position, 220px wide (240 on phones), padding 4, radius 10, 1px Line border, Floating shadow.
- Options:
  - Status: To do, In progress, Done.
  - Priority: High, Medium, Low.
  - Each option is a `role="option"` button, 36px tall (44px with 16px text on phones), showing a glyph or bars, the label, and an Accent check when selected. The selected option has a Fill background and `aria-selected="true"`.
- **Placement:**
  - The menu's right edge sits 6px inside the trigger's right edge, 4px below the trigger.
  - Horizontally, it is clamped to 8px from the viewport edges.
  - The menu height is estimated as 3 × item height + 10.
  - If the menu would end less than 8px from the bottom of the viewport, and it fits above the trigger (4px gap, at least 8px from the top), it opens above. Otherwise it stays below.
  - It animates in over 160ms from scale .96, anchored at the corner nearest the trigger.

**Keyboard and closing.**
- On open, focus the selected option.
- ↑/↓ move focus and wrap around. Home and End jump to the first and last option.
- Escape and Tab close the menu. Choosing an option closes it too, and focus returns to the trigger.
- Clicking outside closes it. So does scrolling the page, but ignore scroll during the first 300ms after opening.

**Effect on a ticket.**
- Choosing logs "changed status to X" or "set priority to X".
- A status change moves the ticket to the top of its new group.
- In New ticket, choosing only sets the form value.

### 5.6 Toasts and highlights

**Toast.**
- Position: bottom center, 24px from the bottom. On phones, while the bottom bar is visible, it sits at `calc(88px + env(safe-area-inset-bottom))`.
- Look: Ink background, white 14/500 text, radius 12, padding 10px 16px 10px 12px, a circle-check icon, shadow `0 8px 24px rgba(20,20,26,0.18)`. It doesn't wrap and is at most `100vw − 32px` wide.
- Timing: in over 240ms, on screen for 2.2s, out over 160ms. A new toast replaces the current one.
- Accessibility: `role="status"`.

**Messages.**

| Message | When |
|---|---|
| "Prompt copied" | The prompt is copied |
| "MOB-7 created" | A ticket is created |
| "“Name” created" | A project is created |
| "Project updated" | A project is saved |
| "“Name” deleted" | A project is deleted |
| "MOB-3 deleted" | A ticket is deleted |
| "Report applied to 2 tickets" | A report is applied ("1 ticket" when singular) |
| "MOB-3 moved to Done" | A drag or keyboard move changes status |

**Row highlight.** A row that was just created, moved, or updated by a report gets a `#E4E4FA` overlay (`mix-blend-mode: multiply`) that fades out over 1400ms.

---

## 6. Data

### 6.1 Model

```ts
type Status = 'todo' | 'doing' | 'done';      // labels: "To do", "In progress", "Done"
type Priority = 'low' | 'medium' | 'high';    // labels: "Low", "Medium", "High"

interface Project {
  id: string;
  name: string;
  key: string;        // ticket prefix: A–Z/0–9, max 5 chars, unique, never changes
  desc: string;
  repo: string;       // folder or repo; added to every Claude Code prompt
  color: string;      // from the project palette (§9.1)
  nextNum: number;    // next ticket number; numbers are never reused
  createdAt: number;  // epoch ms
}

interface Ticket {
  id: string;
  projectId: string;
  num: number;        // shown as `${project.key}-${num}`, e.g. MOB-3
  rank: number;       // manual order within (project, status), ascending
  title: string;
  desc: string;
  status: Status;
  priority: Priority; // default 'medium'
  assignee: string;   // free-text name; '' = unassigned
  due: string;        // 'YYYY-MM-DD' or ''
  createdAt: number;
  updatedAt: number;
  activity: Activity[];
}

interface Activity {
  id: string;
  type: 'event' | 'comment' | 'report';
  text: string;       // event text, comment text, or the full report block
  at: number;
}
```

### 6.2 Rules

**Deriving a prefix** from the name, used as the placeholder and the default:
1. Uppercase the name. Turn anything that isn't A–Z or 0–9 into a space. Split into words.
2. No words → `PRJ`.
3. One word → its first 3 characters (Website → `WEB`).
4. Several words → their initials, up to 4 characters (Mobile app → `MA`).

**Entering a prefix.** If the input is blank, use the derived prefix. Otherwise uppercase it, strip anything that isn't A–Z or 0–9, and keep at most 5 characters. If nothing is left (for example `--`), use `PRJ`.

**Duplicate prefixes.** If the prefix is taken, use the first 4 characters plus 2, 3 and so on.

**Project color.** Use `palette[projectCount % 6]` (§9.1).

**Ticket numbers.** Each project keeps its own counter. Deleting a ticket never frees its number.

**Deleting a project.** Its tickets are deleted too.

**Order within a group** (same project and status):
- Sort by `rank` ascending. Ties go to the higher `num` first.
- These go to the **top** of a group, using `min(rank in group) − 1000`, or 0 if the group is empty:
  - a newly created ticket
  - a ticket whose status changed via the dropdown, a report, or "Send to Claude Code"
- A drag or keyboard move renumbers the destination group as 0, 1000, 2000 and so on.
- Every ticket always has a rank. The prototype's `withRanks()` only migrates older saved data, so the new app doesn't need it.

**Activity event texts.** Shown as "You {text} · {when}".

| Event text | When it's logged |
|---|---|
| `created the ticket` | Always, on create |
| `changed status to To do` / `In progress` / `Done` | Status changed |
| `set priority to Low` / `Medium` / `High` | Priority changed |
| `assigned the ticket to {name}` / `removed the assignee` | On blur, if the assignee changed |
| `set the due date to {Oct 7}` / `removed the due date` | Due date changed |
| `sent the ticket to Claude Code` | Prompt copied or shared |
| `sent the ticket to Claude Code and moved it to In progress` | The same, with the switch on and the ticket in To do |
| `changed status to {X} from a Claude Code report` | A report changed the status |

Editing the title or description adds no event; it only updates `updatedAt`.

**Time and date formats** (en-US):

| Format | Rule | Examples |
|---|---|---|
| Relative | Each unit is rounded from the one before it: `s = round(ms/1000)`, `m = round(s/60)`, `h = round(m/60)`, `d = round(h/24)`. Show the first that fits: s < 60, m < 60, h < 24, d < 7. Otherwise show the full date. So 90s reads "2m ago". | "just now", "5m ago", "3h ago", "2d ago", "Oct 2, 2026" |
| Short day | Used for due dates in rows and prompts. The year is added only if it isn't the current year. | "Oct 9" |
| Long day | Used in the Due date row. The same year rule applies. | "Wed, Oct 9" |
| Full | Used for Created | "Oct 2, 2026" |

**Overdue.** A ticket is overdue when `due < today` (local date) and its status isn't Done.

**Avatars.**
- Initials: the first letter of up to two words, uppercased.
- Color: `AV[sum(charCodes(name)) % 6]` (§9.1).
- Text: white, 600 weight. 24px avatars use 10px text; 20px avatars use 9px.
- Unassigned: a transparent avatar with a `1.5px dashed #C4C4CC` border.

### 6.3 Storage

Load once on start and save after every change.
- The prototype stores `{ projects, tickets }` as JSON under the localStorage key `pm-tracker-v2`.
- The real app can use any store (§1), but keep it behind one module.
- The prototype's localStorage won't carry over, because it lives on a different origin.

---

## 7. Ticket list behavior

### 7.1 Filter and search

| Filter | Groups shown, in order |
|---|---|
| **All** | In progress, To do, Done |
| **Active** | In progress, To do |
| **Done** | Done |

**Search.**
- A case-insensitive substring match against the title or the key (so `mob-3` matches).
- It combines with the filter.
- Changing the filter replays the list's rise-in animation.

### 7.2 Groups

Each group lists its tickets in rank order (§6.2). The header count is the number of tickets in the group that match the current filter and search.

### 7.3 Collapse long groups

**Rule.** `LIMIT = 5`. If a group has **more than 6** tickets, show the first 5 and a footer button, "Show N more", where N is the total minus 5. Groups with exactly 6 tickets show all 6, so the button never says "Show 1 more".

**Footer button.**
- Full width and centered: 40px tall (48px on phones), 13/500 Muted text, 1px top border.
- It contains the label and a 16px chevron-down.
- Hover: Ink text.
- It carries `aria-expanded`.

**Expanded.** The group shows every ticket, the label becomes "Show less", and the chevron rotates 180° over 200ms (ease-out). The revealed rows rise in, staggered 18ms.

**While searching.** Every match is shown and there is no footer.

**State.** Remember the expanded state per project and status. Keeping it in memory for the session is fine.

### 7.4 Drag and drop

Use any implementation (dnd-kit works well) as long as this behavior holds. The prototype implements it with Pointer Events; see `dragDown`, `startDrag`, `computeDropTarget`, `dropTicket` and `handleKey` in `Main.dc.html`. The Components board has a standalone demo.

**Handle.**
- A `grip-vertical` icon (16px) in a button at the row's left edge.
  - Desktop: 24px wide, 6px from the edge.
  - Phones: 34px wide, 2px from the edge.
- It spans the full row height, has radius 6, color `#B4B4BC`, and uses `cursor: grab` and `touch-action: none`.
- On desktop it shows when you hover the row or focus the handle. On phones and on `(hover: none)` devices it is always visible.
- Hover: `#6B6B76` on `#EFEFF1`.
- aria-label: "Move MOB-3. Drag, or use the arrow keys."

**Starting a drag.**
- **Mouse:** press on the row or the handle. The drag starts after 6px of movement (`|dx| + |dy|`). Less than that counts as a click and opens the ticket.
- **Touch and pen:** only the handle drags. It starts immediately and vibrates for 8ms where supported. Rows still scroll and tap normally.
- Capture the pointer on the pressed element and clear any text selection.

**While dragging.**
- **Ghost.** A fixed-position copy of the row, at the row's width, that keeps the original grab offset. It contains the grip icon, priority bars, key, status glyph, title (500 weight) and avatar.
  - White background, 1px Line border, radius 10, 44px tall.
  - It "lifts" over 160ms: scale 1 → 1.02 and the Lifted shadow.
  - It doesn't receive pointer events.
- **Original row.** Its content dims to 35% opacity.
- **Cursor and selection.** The cursor is `grabbing` everywhere and text selection is disabled. Close any open dropdown or menu.
- **Drop target.**
  - The target group is the one under the pointer's y position. If the pointer is above, below or between groups (in the 16px gap), use the nearest group.
  - The insertion index is decided by row midpoints, ignoring the dragged row.
- **Drop line.**
  - A 2px Accent line, inset 12px on each side, with a dot at its left end. The dot is 8px: a 4px box plus a 2px Accent border, with a white center.
  - It is drawn above the target row, or below the last row.
- **Empty groups.** During a drag, a group that has no tickets but is visible under the current filter still shows. It contains a dashed drop zone (padding 10px 12px) reading "Drop here to move to {Status}":
  - Size: 44px tall, a `1.5px dashed #C4C4CC` border, radius 10.
  - When targeted: Accent border, `#F7F7FE` background, `#4A4AC4` text.
- **Header tint.** The target group's header turns `#EEEEFC` when the drop would change the ticket's status.
- **Auto-scroll.**
  - Desktop: within 72px of the top, or 40px of the bottom.
  - Phones: within 72px of the top, or 96px of the bottom.
  - Scroll by `ceil(distance into the zone / 5)` px every 16ms.
- **Updates.** Throttle to one update per animation frame.

**Release.**
- If the order didn't change, do nothing.
- Otherwise, move the ticket into the target group at the index and renumber that group's ranks.
- If the status changed, log "changed status to X" and show the toast "MOB-3 moved to Done".
- Highlight the moved row.
- Announce the move through a polite live region: "MOB-3 moved" or "MOB-3 moved to Done".
- Ignore the click that follows a drag, for 400ms.

**Collapsed groups.** Dropping below the last visible row inserts right after that row, not at the end of the hidden list.

**Cancel.** On `pointercancel`, drop nothing.

### 7.5 Keyboard moves

When the drag handle has focus:
- **↑ / ↓** move the ticket one slot within its group.
- At the edge of a group, the ticket moves to the next status in the current filter's order (In progress ↔ To do ↔ Done). This happens even when that group is empty, and the group then appears. Moving up places it at the end of that group; moving down places it at the start.
- The destination group expands.
- Focus stays on that ticket's handle.
- Status-change rules (event, toast, live message) are the same as for a drag.

---

## 8. The Claude Code loop

### 8.1 Prompts

**Ticket prompt.** Opened from "Send to Claude Code" on a ticket. Example:

````
Please work on ticket MOB-3 from my "Mobile app" project.
Repository / folder: ~/code/mobile-app

## MOB-3: Crash when rotating the profile screen
Priority: High · Status: To do · Due: Oct 9 · Assignee: Dara

Steps: open Profile, rotate the device twice.

Notes:
- First note, with line breaks collapsed to spaces

Your last report on this ticket:
TICKET: MOB-3
STATUS: in progress
…

## When you finish
End your reply with this block, filled in, so I can paste it back into my tracker:

```
TICKET: MOB-3
STATUS: done | in progress | blocked
SUMMARY: what you changed, in 1-3 sentences
FILES: files you created or edited
NEXT: anything I still need to do, or "none"
```
````

**Rules for the ticket prompt:**
- The `Repository / folder` line appears only if the project has one.
- In the meta line, `Due` and `Assignee` appear only when set.
- If the description is empty, write `(No description.)`. If the title is empty, write `Untitled`.
- `Notes:` lists every comment.
- `Your last report on this ticket:` shows only the most recent report.

**Project prompt.** Opened from "Send open tickets". Example:

````
Here are the open tickets for my "Mobile app" project. Work through them in order, highest priority first, and check with me before large or risky changes.
Repository / folder: ~/code/mobile-app

---

### MOB-2: Show an error when the password is wrong
Priority: High · Status: In progress · Due: Oct 9 · Assignee: Sophea

Inline error under the password field. Keep the email filled in.

Notes:
- Design is approved. Starting on this today.

---

### MOB-3: …

---

## When you finish
For each ticket you worked on, end your reply with one block like this, filled in, so I can paste it back into my tracker:

```
TICKET: MOB-<number>
STATUS: done | in progress | blocked
SUMMARY: what you changed, in 1-3 sentences
FILES: files you created or edited
NEXT: anything I still need to do, or "none"
```
````

**Rules for the project prompt.**
- "Open" means not Done.
- Order: In progress first, then priority (High → Low), then ticket number ascending.
- Each ticket block uses the same layout as the ticket prompt, with `###` headings.

### 8.2 "Send to Claude Code" sheet

**Header.** "Close" | "Send to Claude Code", with a subtitle | an optional Share button.
- Subtitle: "MOB-3 · Mobile app" for a ticket; "4 open tickets · Mobile app" for a project ("1 open ticket" when singular).
- Share: a 40×40 icon button with the share icon (aria-label "Share prompt"). It appears only when `navigator.share` exists.

**Help text** (13px Muted):
- Normally: "Paste this into Claude Code. It asks Claude to end with a short report you can bring back here with Paste report. You can edit the text first."
- With no open tickets: "There are no open tickets in this project." In that case there is no text box and no Copy button.

**Prompt box.** An editable textarea: mono 12px, line-height 1.6, 12 rows, Fill background, 1px Line border, radius 12. On focus the border turns Accent with a 1px ring.

**Switch row.** "Move MOB-3 to In progress", followed by a switch.
- The switch: `role="switch"`, aria-label "Move to In progress when sent".
- Track: 44×26, radius 13. Accent when on, `#DEDEE3` when off (160ms transition).
- Knob: 20px white circle with shadow `0 1px 3px rgba(20,20,26,.25)`. It moves 18px with a 240ms spring.
- The row shows only for a single ticket that is in To do and hasn't been sent yet in this opening. It is on by default.

**Copy prompt.**
- A primary button in the footer (top border). On desktop it is 36px tall. On phones it is full width, 48px tall, radius 12, 15px text.
- Shows the copy icon and "Copy prompt". After copying it shows a check and "Copied" for 2s.
- Copying method:
  1. Try `navigator.clipboard.writeText`.
  2. If that fails, select the textarea and run `document.execCommand('copy')`.
  3. If that fails too, show: "Copying was blocked here. Select the text above and copy it yourself."
- When copying works: show the toast "Prompt copied" and mark the ticket as sent (below).

**Share.** Calls `navigator.share({ title: 'Prompt for Claude Code', text })`. If that works, mark the ticket as sent. No toast.

**Marking as sent.** This applies to ticket prompts only, once each time the sheet is opened:
- If the switch is on and the ticket is in To do: set the status to In progress (the ticket moves to the top of that group) and log "sent the ticket to Claude Code and moved it to In progress".
- Otherwise: log "sent the ticket to Claude Code".

### 8.3 Report format and parsing

Claude Code ends its reply with one or more blocks like this:

```
TICKET: MOB-3
STATUS: done
SUMMARY: …
FILES: …
NEXT: none
```

**Parsing rules.** Keep these exactly as they are; see `parseReport` in `Main.dc.html`.

1. Remove `\r` and drop every line whose first non-space characters are ```` ``` ```` (code fences).
2. A block starts at a line matching ``/^[\s>*_`#-]*TICKET[\s*_`]*[:：]\s*[*_`]*\s*([A-Za-z0-9]+-\d+)/i``.
   - This tolerates Markdown bold and italics, quotes, bullets, headings and a full-width colon.
   - Uppercase the key.
   - Store the TICKET line with `*`, `_` and `` ` `` removed.
3. Lines before the first TICKET line form a block without a key.
4. If any blocks have a key, use only those. Otherwise use the non-empty keyless block.
5. **Status.** Read the first match of ``/STATUS[\s*_`]*[:：]\s*(.+)/i`` in the block and normalize the lowercased value, checking in this order:
   1. contains the word (`\b…\b`) `done`, `complete`, `completed`, `fixed`, `finished` or `resolved` → **Done**
   2. contains `not started` → **To do**
   3. contains `progress`, `partial`, `blocked`, `wip`, `started` or `ongoing` → **In progress**. There is no Blocked status.
   4. contains `to do` or `todo` → **To do**
   5. anything else → no status change
6. **Finding the ticket.**
   - A block with a key: find the project whose key matches (case-insensitive) in any project, then the ticket with that number.
   - A keyless block: it applies to the current ticket, but only when the sheet was opened from a ticket.
7. **Saved text.** The block's text (its lines joined and trimmed) is what gets saved as the report.

**Applying.** For each matched block, in order:
1. Add a `report` activity item with the block text.
2. If the status differs, set it, log "changed status to X from a Claude Code report", and move the ticket to the top of its new group.
3. Update `updatedAt`.

Then close the sheet, highlight the updated rows, and show the toast "Report applied to N ticket(s)".

### 8.4 "Paste report" sheet

**Header.** "Cancel" | "Paste report", with a subtitle | "Apply".
- Subtitle: the ticket key, or the project name.
- Apply is disabled until at least one block matches a ticket.

**Scope.**
- Opened from a project, or from the phone bar on a project: project scope. Blocks need TICKET lines.
- Opened from a ticket: ticket scope. Text without a TICKET line goes to this ticket.

**Help text.**
- Ticket scope: "Paste Claude Code’s reply. Its TICKET / STATUS block updates the ticket, and the report is saved to the activity. With no TICKET line, it’s added to MOB-3."
- Project scope: "Paste Claude Code’s reply. Each block that starts with “TICKET: KEY-123” updates that ticket’s status and is saved to its activity."

**"Paste from clipboard" button.** A secondary button with the clipboard-check icon. It uses `navigator.clipboard.readText()`. Errors:

| Situation | Message |
|---|---|
| Clipboard is empty | "The clipboard is empty." |
| Access was refused | "Clipboard access was blocked. Paste into the box instead." |
| The API isn't available | "Clipboard access isn’t available here. Paste into the box instead." |

**Report box.** A textarea: mono 12.5px, 8 rows, 1px Control line border, radius 12. Its placeholder is the five-line template (`TICKET: MOB-3`, `STATUS: done`, `SUMMARY: …`, `FILES: …`, `NEXT: none`).

**Changes preview.** It updates live under the label "Changes": a bordered list with one row per block, at least 44px tall, containing:
- the key (mono 12 `#55555F`)
- the ticket title (ellipsized)
- the outcome (500 weight):
  - `To do → Done` when the status changes
  - `Add report` otherwise
  - `Skipped`, in Danger, when nothing matches. The title then reads "No ticket with this ID" or "No TICKET line found".

**Applying with no match** shows "No matching ticket found. The report needs a line like “TICKET: MOB-1”." It uses the current project's key.

---

## 9. Design tokens

### 9.1 Color

Neutrals and semantic colors, as CSS variables (suggested names):

```css
:root {
  /* neutrals */
  --ink: #1B1B1F;          /* primary text, primary buttons, toasts */
  --ink-2: #2A2A30;        /* long text: descriptions, comments */
  --muted: #6B6B76;        /* secondary text, labels, values */
  --subtle: #8E8E99;       /* counts, the To do ring */
  --placeholder: #9A9AA3;  /* placeholders, timestamps */
  --faint: #B4B4BC;        /* chevrons, breadcrumb separators, idle drag handle */
  --control-line: #DEDEE3; /* inputs, secondary buttons, grabber */
  --line: #EBEBEE;         /* dividers, cards, list borders */
  --fill-2: #EFEFF1;       /* segmented track, phone search, hover */
  --fill: #F7F7F8;         /* sidebar, group headers, code blocks, hover */
  --panel: #FBFBFC;        /* ticket details panel */
  --surface: #FFFFFF;      /* page, cards, sheets */

  /* semantic */
  --accent: #5B5BD6;       /* Done glyph, progress, switch, focus ring, drop line */
  --doing: #C26A06;        /* In progress glyph */
  --danger: #B42318;       /* delete, errors, overdue */
  --danger-line: #F4CFCA;  /* delete confirmation border */
  --report-bg: #F7F7FE;    /* Claude Code report card, targeted drop zone */
  --report-line: #E3E3F8;
  --flash: #E4E4FA;        /* fading highlight on new/updated rows */
  --drop-tint: #EEEEFC;    /* header of a group a ticket is being moved into */
}
```

**Other values used.**
- Primary button hover: `#33333A`
- Links: `#4A4AC4`, hover `#3A3AA8`. Targeted drop-zone text: `#4A4AC4`
- Property row hover: `#FAFAFB`
- Priority bars: on `#55555F`, off `#D9D9DE`
- Dashed lines (unassigned avatar, empty drop zone) and the event dot: `#C4C4CC`
- Scrim: `rgba(20,20,26,0.36)`

**Project palette.** Assigned in rotation: `#5B5BD6`, `#D97706`, `#12A594`, `#E5484D`, `#8E4EC6`, `#0091FF`.

**Avatar palette.** Picked by a hash of the name: `#5B5BD6`, `#B4540A`, `#18794E`, `#C2298A`, `#0B68CB`, `#6E56CF`.

### 9.2 Type

**Fonts.** **Geist** at 400/500/600/700 and **Geist Mono** at 400/500, from Google Fonts.
- Fallbacks: `'Helvetica Neue', system-ui, sans-serif` and `ui-monospace, monospace`.
- Base text: 14px, line-height 1.5, antialiased.

| Style | Spec | Used for |
|---|---|---|
| Large title | 30 / 34 · 700 · −0.02em | Phone page titles |
| Title | 22 / 29 · 600 · −0.015em | Ticket title |
| Heading | 20 / 26 · 600 · −0.015em | Desktop page titles, name fields in sheets (−0.01em) |
| Headline | 15 / 19 · 600 | Nav bar and sheet titles |
| Body | 14 / 21 · 400 (16px in phone inputs) | Rows, fields, comments |
| Secondary | 13 / 19 · 400 | Meta, desktop buttons, help text |
| Caption | 12 / 16 · 500 | Section labels, counts |
| Mono | Geist Mono 12 · 400 | Ticket IDs, prompts, reports (12.5 in report text) |

Use tabular numbers (`font-variant-numeric: tabular-nums`) for counts and percentages.

### 9.3 Spacing, radii, elevation, sizes

**Spacing.**

| Size | Used for |
|---|---|
| 4 | Tight pairs |
| 8 | Toolbar gaps, icon to label |
| 12 | Row content gap, card gaps |
| 16 | Phone side margins |
| 20 | Panel and sheet padding |
| 24 | Between groups of controls |
| 32 | Desktop side margins (40 on the ticket screen) |

**Radii.**

| Radius | Name | Used for |
|---|---|---|
| 8 | Control | Buttons, inputs, menu items |
| 10 | Container | Lists, menus, segmented track |
| 12 | Group | Grouped rows, cards, phone buttons |
| 14 | Sheet | Dialogs, sheets, action sheets |
| 999 | Full | Avatars, pills, switch |
| 6 | Small tiles | Logo, report icon |
| 3 | Color squares | Project color squares |

**Elevation.**

| Name | Shadow | Used for |
|---|---|---|
| Raised | `0 1px 2px rgba(20,20,26,.12), 0 0 0 .5px rgba(20,20,26,.06)` | Segmented thumb, switch knob |
| Floating | `0 8px 24px rgba(20,20,26,.12)` | Menus, dropdowns |
| Lifted | `0 12px 32px rgba(20,20,26,.18)` | A ticket being dragged |
| Overlay | `0 24px 64px rgba(20,20,26,.2)` | Dialogs and sheets, over the 36% scrim |

**Sizes** (desktop · phone):

| Element | Size |
|---|---|
| Control height | 32 · 44 |
| Primary in the phone bar | 48 |
| List row | 44 · 52 |
| Property row | 44 · 50 |
| Nav bar | 52 |
| Icon button | 32 · 44 |
| Avatar | 24 in lists · 20 in property rows |
| Dropdown item and width | 36 and 220 · 44 and 240 |
| Drag handle | 24 wide · 34 wide |
| Sidebar · ticket panel | 240 · 300 |

### 9.4 Icons and glyphs

**Icons.** Use [Lucide](https://lucide.dev) at stroke width **1.75** with round caps and joins.
- Sizes: 14 (inline meta), 16 (default), 20 (phone nav and bars, empty states).
- Icons used:
  - Navigation and actions: `layout-grid`, `plus`, `chevron-left`, `chevron-right`, `chevron-down`, `ellipsis`, `search`, `x`, `check`
  - Project and ticket fields: `folder`, `pen-line`, `trash-2`, `calendar`, `hash`
  - Claude Code loop and feedback: `terminal`, `clipboard-check`, `copy`, `share`, `circle-check`
  - Drag and drop: `grip-vertical`
- The logo is a custom glyph: a 2×2 grid of rounded squares, two of them at 55% opacity.

**Glyphs.** These are custom SVGs with a 16×16 viewBox. Copy them exactly.

```html
<!-- To do -->
<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.25" fill="none" stroke="#8E8E99" stroke-width="1.5"/></svg>
<!-- In progress -->
<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.25" fill="none" stroke="#C26A06" stroke-width="1.5"/><path d="M8 4.5a3.5 3.5 0 0 1 0 7z" fill="#C26A06"/></svg>
<!-- Done (circle pops in with a 260ms spring; the check draws over 260ms after 90ms) -->
<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="#5B5BD6"/><path d="m5 8.25 2 2 4-4.25" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
<!-- Priority bars: Low = first bar on, Medium = two, High = three. On #55555F, off #D9D9DE -->
<svg width="16" height="16" viewBox="0 0 16 16"><rect x="2" y="9" width="3" height="5" rx="1"/><rect x="6.5" y="6" width="3" height="8" rx="1"/><rect x="11" y="3" width="3" height="11" rx="1"/></svg>
```

---

## 10. Motion

**Tokens.**

| Token | Value | Used for |
|---|---|---|
| Press | 100ms | Buttons scale to 0.97 while held |
| Fast | 160ms | Exits, menus, hover and color changes |
| Base | 240ms | Screen push and pop, dialogs, toasts |
| Sheet | 340ms in · 220ms out | Phone sheets and the bottom bar |
| Ease out | `cubic-bezier(0.22, 1, 0.36, 1)` | Everything that enters |
| Ease in | `cubic-bezier(0.4, 0, 1, 1)` | Everything that leaves |
| Spring | `cubic-bezier(0.34, 1.36, 0.64, 1)` | Selections: filter thumb, switch, done check |

**Patterns.**

| Pattern | When | Spec |
|---|---|---|
| Screen push / pop | Opening a project or ticket / going back | 240ms ease-out, x +28px / −28px, fade |
| First load | App start | 240ms ease-out, y +6px, fade |
| Nav title | Screen change on phone | 260ms ease-out, y +4px, fade |
| Back button | It appears on phone | 240ms ease-out, x +8px, fade |
| Fade in | Empty states, confirm cards, form errors, drop zones, the Changes preview, the "Copied" check | 200ms ease-out, y +6px, fade |
| Sheet (phone) | New ticket, project, prompt, report, action sheet | y 100% → 0 in 340ms ease-out; out 220ms ease-in |
| Dialog (desktop) | The same sheets | in 240ms from scale .97 and y +10px; out 160ms to scale .98 and y +6px |
| Scrim | Behind every sheet | fade in 240ms, out 160ms |
| Menu and dropdown | ••• menu, status, priority | 160ms ease-out, from scale .96 and y ∓4px, anchored at the corner nearest the trigger |
| Segmented thumb | Filter change | 260ms spring |
| Switch | Prompt sheet | knob 240ms spring; track color 160ms |
| List rise | A list appears or the filter changes | 300ms ease-out, y +6px. Stagger: groups 40ms, project rows 24ms, revealed rows 18ms, activity 16ms (capped at 12 items, or 10 for activity) |
| Progress bar | Projects list | grows from 0 over 700ms ease-out |
| New row | Created, moved, or updated by a report | `#E4E4FA` fades to clear over 1400ms |
| Done check | A ticket turns Done | circle pops from scale .55 with a 260ms spring; check draws over 260ms after 90ms |
| Drag handle | Row hover or focus | opacity and color change over 120ms |
| Toast | Feedback | in 240ms (y +14px, scale .96), stays 2.2s, out 160ms |
| Show more | Expanding a long group | new rows rise with an 18ms stagger; chevron turns 180° in 200ms |
| Lift | A drag starts | 160ms ease-out, scale 1.02, Lifted shadow |
| Drop line | While dragging | follows the pointer every frame; header tint fades over 160ms |
| Press | Every button | scale 0.97 over 100ms |

**Reduced motion.** Under `prefers-reduced-motion: reduce`, every animation and transition becomes about 1ms with no delays.

---

## 11. Focus and accessibility

**Focus rings are never clipped.** Many rows sit inside rounded containers with `overflow: hidden`, so:

- **Rows and items inside lists, groups and menus** draw their ring *inside* themselves. This covers list rows, menu items, dropdown options, "Show more", action-sheet buttons and property rows.
  - The ring is a `::after` element with `inset: 3px`, radius 8, and `box-shadow: 0 0 0 2px var(--accent)`, shown on `:focus-visible`.
  - Property rows also show it when any child has focus (`:has(:focus-visible)`).
- **Bordered fields** (search, comment composer, prompt and report boxes) don't use an outline. On focus their border turns Accent and they get a 1px Accent ring.
- **Standalone buttons and inputs** use a 2px Accent outline with a 2px offset.
- **Sidebar items, segmented buttons and the drag handle** use an outline offset of −2px, so it stays inside them.
- **Scrims and click-catchers** use `tabindex="-1"` and never show focus.

**Roles and labels.**
- Dialogs use `role="dialog"`, `aria-modal="true"` and an aria-label.
- The dropdown uses `listbox` and `option` with `aria-selected`. Its triggers use `aria-haspopup` and `aria-expanded`.
- Segmented buttons use `aria-pressed`. "Show more" uses `aria-expanded`. The switch uses `role="switch"` and `aria-checked`.
- Toasts use `role="status"`. Form errors use `role="alert"`.
- A visually hidden `aria-live="polite"` region announces drag and keyboard moves.
- Icons are `aria-hidden`. Every icon-only button has an aria-label.

**Keyboard.**
- Escape closes dropdowns and sheets.
- The dropdown supports arrow keys, Home and End.
- Arrow keys on a drag handle move the ticket.
- Enter submits forms.

**Touch.**
- Targets are at least 44px on phones.
- Inputs use 16px text on phones, which stops iOS from zooming.
- Use `env(safe-area-inset-bottom)` on the bottom bar, sheets, action sheet and toast.

---

## 12. Phone rules (max-width: 767px)

**Layout.**
- Hide the sidebar and the desktop header. Show the nav bar, and the bottom bar on the Project and Ticket screens.
- Side padding is 16px. The large title "Projects" is 30/700.
- The ticket grid stacks: main, details panel, activity. Activity gets 120px of bottom padding.

**Sizes.**
- Rows: at least 52px. Buttons: 44px, including the sheet Cancel/Close buttons and the Comment button. Icon buttons: 44×44. Property rows: 50px with 16px text. Inputs and textareas: 16px text.
- Small controls keep their look but get a 44×44 hit area, for example the 24px due-date clear button.
- Show more: 48px.
- Dropdown items: 44px with 16px text; the menu is 240px wide.
- Sheet header buttons: 34px with 15px text. Sheet footer buttons: full width, 48px tall, radius 12, 15px text.

**Ticket rows.**
- Titles wrap. The due date is hidden.
- The drag handle is always visible: 34px wide, 2px from the left. Row content starts 40px from the left.

**Filter row.** The search and the segmented control each take a full row. Search is filled `#EFEFF1` with no border, 40px tall. Segmented buttons are 34px with 14px text.

**Projects list.** Hide the Progress and Updated columns and show a chevron.

**Overlays.**
- Sheets become bottom sheets. The project options menu becomes an action sheet.
- The toast sits above the bottom bar.

---

## 13. Acceptance checks

Run these at **375×812** and **1280×800**. Automate the logic with unit tests and the flows with Playwright.

**Projects and tickets**
- [ ] With no data, the "No projects yet" state appears. Create "Mobile app": its prefix is `MA` (derived) unless typed. Typing `mob` gives `MOB`. Creating a second project with `MOB` gives `MOB2`.
- [ ] The new project opens with a push transition and the toast "“Mobile app” created". It appears in the sidebar (desktop) and the Projects list.
- [ ] Create a ticket from a group's "+" in To do: it becomes `MOB-1` at the **top** of To do, the toast reads "MOB-1 created" and the row highlights. Delete it and create another: the new one is `MOB-2`, because numbers are never reused.
- [ ] With the Done filter on, creating a To do ticket switches the filter back to All.
- [ ] Editing a ticket's title, description, status, priority, assignee and due date updates the row, and each logs the right activity text (§6.2). Title and description edits log nothing.
- [ ] A past due date shows red on a To do ticket and normal once the ticket is Done. Clear (×) removes it and logs "removed the due date".
- [ ] Deleting a ticket and deleting a project both need a confirmation, then navigate back and show the toast.
- [ ] Reloading keeps all data. Browser back and forward work, and `/p/MOB/3` opens straight to that ticket.

**List**
- [ ] The filter counts are right and don't change while searching. Searching `mob-3` finds MOB-3.
- [ ] A group with 7 tickets shows 5 and "Show 2 more". Expanding shows all 7 and "Show less" with the chevron flipped. A group of 6 shows all 6 with no button. Search shows every match with no button.

**Drag and drop**
- [ ] Desktop: dragging a row from To do onto Done moves it, logs "changed status to Done", shows "MOB-3 moved to Done" and highlights the row. Clicking without dragging opens the ticket.
- [ ] Phone: dragging by the handle reorders. Swiping on the row scrolls the page instead of dragging.
- [ ] Dragging into an empty status group (with the All filter) shows "Drop here to move to Done", and the drop works.
- [ ] Dragging near the bottom of the screen auto-scrolls. Releasing in the gap between two groups drops into the nearer group.
- [ ] A focused handle with ↑/↓ moves the ticket and crosses into the next group at the edge, and focus stays on the handle.

**Dropdown**
- [ ] Opening the Status dropdown focuses the current value, and ↑/↓/Enter/Escape work. On the last property row near the bottom of the screen, the menu opens upward.

**Claude Code loop**
- [ ] On a To do ticket, "Send to Claude Code" → "Copy prompt" puts the exact text from §8.1 on the clipboard. The ticket moves to In progress and logs "sent the ticket to Claude Code and moved it to In progress". Turning the switch off logs only "sent the ticket to Claude Code".
- [ ] "Send open tickets" lists In progress first, then by priority, then by number. A project with no open tickets says so and shows no Copy button.
- [ ] Paste a reply with two blocks: one for an In progress ticket, MOB-2 (`STATUS: done`), and one for MOB-9, which doesn't exist. The preview shows "In progress → Done" and "Skipped". Apply updates MOB-2, adds the report card and the event, and shows "Report applied to 1 ticket".
- [ ] `**TICKET:** MOB-2` in Markdown bold, inside a ```` ``` ```` fence, still parses. On a ticket's Paste report, plain text with no TICKET line is added to that ticket.
- [ ] `STATUS: not started` sets To do. `STATUS: blocked` and `STATUS: wip` set In progress. `STATUS: Fixed ✅` sets Done.

**Quality**
- [ ] Tabbing through every screen shows a focus ring that is never cut off, including on the last row of a group, the Due date row, and the Show more button.
- [ ] With reduced motion on, nothing animates.
- [ ] No horizontal scrolling at 375px. Every phone touch target is at least 44px. Inputs don't zoom on iOS.

---

## 14. Suggested build order

Commit after each step. Check every screen at 375px and 1280px before moving on.

1. **Scaffold.** Set up the project, fonts, the token file (§9), icons, and the base components as shown on the Components board:
   - Button, IconButton, Segmented, SearchField, Switch
   - PropertyRow and the grouped card, List and Row
   - Sheet/Dialog, ActionSheet, Dropdown, Toast
   - Avatar, StatusGlyph, PriorityBars
2. **Data layer.**
   - Types (§6.1), the store, the storage module, prefix derivation, ranks and the drop logic.
   - Prompt builders (§8.1) and the report parser (§8.3).
   - Unit tests for all of them.
3. **App shell.**
   - Routes (§3) and the responsive shell: sidebar and header on desktop, nav bar and bottom bar on phones.
   - Screen transitions.
4. **Projects screen and the project sheet.**
5. **Project screen.** Toolbar, filter, search, groups, rows, collapse, empty states, and the New ticket sheet.
6. **Ticket screen.** Editable fields, dropdowns, assignee, due date, info, delete, activity and comments.
7. **The Claude Code loop.** The prompt sheet (copy, share, switch) and the report sheet (paste, preview, apply).
8. **Drag and drop.** Mouse, touch handle and keyboard, plus auto-scroll and announcements.
9. **Polish.** Motion, reduced motion, a focus-ring audit (§11), and the acceptance checks (§13).
10. **Ship.** Add the PWA manifest, icons and offline support (if chosen in §1), then deploy.

---

## 15. Not in the design: ask before adding

- Sync across devices, sign-in, multiple users
- Dark mode
- Export or import of data
- Notifications or reminders
- Attachments, labels or tags, sub-tasks, links between tickets
- A Blocked status (reports that say "blocked" map to In progress today)
- Editing a project's prefix after it's created
