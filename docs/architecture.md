# Architecture

This document records the product changes from `init-design/SPEC.md` and the technical design. When it disagrees with the SPEC, this document wins. Everything the SPEC says that is not changed here still applies.

## 1. Product changes from the SPEC

### 1.1 Statuses are data, per project

- Each project owns its statuses. New projects get five defaults (`DEFAULT_STATUSES` in `packages/shared/src/domain/status.ts`):

  | Name        | Category      | Color     | Glyph                                            |
  | ----------- | ------------- | --------- | ------------------------------------------------ |
  | To do       | `todo`        | `#8E8E99` | empty ring                                       |
  | In progress | `in_progress` | `#C26A06` | ring + half pie                                  |
  | Need review | `in_review`   | `#0B68CB` | ring + three-quarter pie                         |
  | Reviewed    | `reviewed`    | `#18794E` | ring + full pie                                  |
  | Done        | `done`        | `#5B5BD6` | filled circle + check (SPEC glyph and animation) |

- The **category** gives a status its meaning and glyph shape; the **color** is the glyph color. Users can create, rename, recolor, recategorize, reorder and delete statuses. Names are unique per project (case-insensitive). A project keeps at least one status. Deleting a status that has tickets requires a target status; those tickets move to the end of the target group.
- Glyph shapes stay distinguishable without color: 0, 1/2, 3/4, full pie, check.
- `resolveStatus(statuses, category)` (shared) finds the status to use for a workflow step, with fallbacks when a category is missing.
- **Done** means category `done`. Progress %, open counts, the Active/Done filters and overdue all use the category.
- Groups on the Project screen follow status order (position). Keyboard and drag moves cross groups in that order.
- Filter tabs stay **All · Active · Done** (Active = not `done`).

### 1.2 The agent workflow

```
To do ──claim──▶ In progress ──submit──▶ Need review ──review: approved──▶ Reviewed ──person──▶ Done
   ▲                                          │
   └────────────── review: changes requested ─┘
```

- **Worker agent:** finds work with `claim_next_ticket` (category `todo`, ordered High → Low priority, then manual order, then number), works, comments as it goes, then `submit_for_review` with a summary, files and next steps. Submitting stores a report card and moves the ticket to the `in_review` status.
- **Reviewer agent:** lists `in_review` tickets, checks the work against the title, description and comments, then `review_ticket` with a verdict (`approved` / `changes_requested`), a 1–5 rating and a summary. Approved moves the ticket to `reviewed`; changes requested moves it to the top of `todo` so a worker picks it up next.
- **Agents can never move a ticket to a `done` status** (API returns 403). Only a person does that.
- Activity has an **actor**: `{ kind: 'human' | 'agent', name }`. People show as "You"; agents show by name with the terminal tile. Requests set the actor with `x-actor-kind` / `x-actor-name` headers (name URI-encoded). No header means the person.
- New activity type **review** renders as a card with the verdict, star rating and summary.
- Comments can be edited (sets `editedAt`, shows "edited") and deleted. Reports and reviews can be deleted. Events cannot be edited or deleted.

### 1.3 The copy/paste loop still exists

"Send to Claude Code" and "Paste report" work as in the SPEC, for agents without the MCP tools:

- Prompts are built on the server (`GET /api/tickets/:key/prompt`, `GET /api/projects/:key/prompt`) with the shared builders. Status labels use the status names. The ticket block also shows the last review (`Last review: Changes requested · 2/5` + summary).
- "Open tickets" for the project prompt means categories `todo` and `in_progress`, ordered in-progress first, then priority, then number.
- The switch reads "Move MOB-3 to {in_progress status name}" and shows for tickets in a `todo` status.
- Report STATUS words map to categories (`normalizeReportStatus`): reviewed/approved/verified → `reviewed`; done/complete/fixed/finished/resolved and review words → `in_review`; not started → `todo`; progress/partial/blocked/wip/started/ongoing → `in_progress`; to do → `todo`. A report never sets Done.

### 1.4 Images

- Tickets and comments can have image attachments (png, jpeg, gif, webp, heic/heif, up to 15 MB). The text fields stay plain text.
- Add images by a photo button (opens camera roll/camera on phones), paste, or drag and drop. The web app downscales photos larger than 2048px before upload.
- Upload first (`POST /api/attachments`, multipart `file` + optional `ticketKey`); without `ticketKey` the attachment is pending until a ticket or comment is created with its id in `attachmentIds`. Pending attachments older than 24 hours are deleted on startup.
- Thumbnails show under the description and inside comment cards. Tapping opens a full-screen viewer: pinch and double-tap zoom, pan, swipe between images, swipe down to close.
- `get_ticket` in the MCP server returns images as image content so agents can see screenshots.

### 1.5 Phone gestures and motion (Apple-like)

On phones (`max-width: 767px`) the app behaves like a native iOS app:

- **Navigation stack:** Projects → Project → Ticket screens stack. Push slides the new screen in from the right edge while the old one moves 30% left and dims; pop reverses. Desktop keeps the SPEC's 28px fade.
- **Edge swipe back:** dragging from the left edge pops interactively with a parallax underlay, and completes or cancels by distance and velocity with a spring. Disabled in iOS Safari browser mode, where Safari owns that gesture (enabled when installed to the home screen).
- **Sheets:** drag the grabber or sheet down to dismiss (follows the finger, rubber-bands upward, velocity-aware). Content scrolls inside; dragging down from the top of the content dismisses.
- **Row swipe actions:** swipe a ticket row right to move it to the next status; swipe left to reveal "Status" and "Delete". A full swipe triggers the first action. Haptic tick at the threshold where supported.
- **Pull to refresh** on Projects and Project lists.
- **Large title** on Projects collapses into the nav bar title while scrolling.
- Press feedback (scale .97), spring selections, `prefers-reduced-motion` honored everywhere.

### 1.6 Other additions

- Live updates: the server pushes change events over SSE; open screens refresh when an agent changes something.
- Project options menu adds **Manage statuses** and **Connect Claude Code** (MCP setup instructions with copy buttons).
- Optional access token: when `TRACKER_TOKEN` is set, the API needs `Authorization: Bearer <token>` or the session cookie from `POST /api/session`. The web app shows a token screen once.
- Installable PWA (manifest, icons, offline app shell).
- App updates never lose typed text. While the app stays open it looks for a new build when the page becomes visible and every 30 minutes (skipped while offline). A new service worker takes over at once, but the page reloads into the new build only when no text field is focused, no dialog is open, no draft is marked and no write is in flight, whether the page is visible or hidden. It checks again every second and on `visibilitychange` (`apps/web/src/pwa`). Writes in flight come from the QueryClient's mutation cache.
- **Draft contract** (`apps/web/src/lib/drafts.ts`): a feature that holds unsent text a reload would lose, such as the comment composer after the keyboard is dismissed, calls `markDraft(id)` while the text differs from what is saved, and `clearDraft(id)` once it is sent, saved or emptied and when the component unmounts. Use one id per draft, such as `comment:MOB-3`. Marking an id again changes nothing, and one `clearDraft` removes it. A draft that is never cleared keeps the page on the old build until the next launch.
- Failed saves keep the typed text: title, description, assignee and comment edits show "isn't saved yet" with Retry, stay marked as drafts and save again when the device is back online.

### 1.7 Small deviations from the design

- Going back from a ticket keeps the Project screen's filter and search, because screens stay mounted in the navigation stack. Opening a project from Projects (or the sidebar) still resets them to All and an empty search.
- When the projects list is narrower than 640px (a desktop window around 768px wide), the Progress column hides so names stay readable.
- Delete confirmations count tickets correctly ("its 1 ticket", "its 3 tickets").
- A status move is announced once, by the toast; the hidden live region announces reorders ("MOB-3 moved"), and every announcement is read again even when the text repeats.

## 2. Data model

TypeScript types live in `packages/shared/src/domain`. Database tables (snake_case, mapped to camelCase with Kysely's `CamelCasePlugin`):

| Table         | Columns                                                                                                                                                                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `projects`    | `id` text pk, `name`, `key` (unique), `description`, `repo`, `color`, `next_num` int, `created_at` bigint, `updated_at` bigint                                                                                                                  |
| `statuses`    | `id` pk, `project_id` → projects (cascade), `name`, `category`, `color`, `position` int, `created_at` bigint                                                                                                                                    |
| `tickets`     | `id` pk, `project_id` → projects (cascade), `num` int, `status_id` → statuses (restrict), `rank` int, `title`, `description`, `priority`, `assignee`, `due` text (`YYYY-MM-DD` or ''), `created_at`, `updated_at`; unique (`project_id`, `num`) |
| `activities`  | `id` pk, `ticket_id` → tickets (cascade), `type`, `actor_kind`, `actor_name`, `text`, `review_verdict` null, `review_rating` int null, `created_at`, `edited_at` null                                                                           |
| `attachments` | `id` pk, `ticket_id` null → tickets (cascade), `activity_id` null → activities (cascade), `file_name`, `mime_type`, `size` int, `width` int null, `height` int null, `storage_key`, `created_at`                                                |

Portability rules (SQLite now, Postgres later): app-generated text ids (`crypto.randomUUID()`), epoch-ms timestamps as `bigint` (parsed to numbers), no booleans, no JSON columns, case-insensitive search with `lower()`, schema built only with Kysely's schema builder. Integration tests run on SQLite and on PGlite (real Postgres in WASM). `DATABASE_URL` picks the dialect: a file path or `:memory:` for SQLite, `postgres://…` for Postgres.

## 3. HTTP API

All routes are under `/api`, JSON in and out. Errors: `{ "error": { "code", "message" } }` with codes `invalid_input` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404), `conflict` (409), `no_match` (422). `packages/client/src/client.ts` is the reference for every route and its types.

| Method & path                                                               | Does                                                                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /projects`                                                             | Project summaries in creation order (counts, `lastActivityAt`)                                                           |
| `POST /projects`                                                            | Create (prefix: `resolvePrefix` + `uniquePrefix`; color `PROJECT_COLORS[count % 6]`; default statuses) → `ProjectDetail` |
| `GET/PATCH/DELETE /projects/:key`                                           | Read / edit name, description, repo / delete with everything in it                                                       |
| `GET /projects/:key/board`                                                  | Project, statuses, ticket list items                                                                                     |
| `GET /projects/:key/prompt`                                                 | Project prompt and open ticket count                                                                                     |
| `GET /projects/:key/tickets?status=&category=&q=`                           | Filtered tickets (status by name, case-insensitive)                                                                      |
| `POST /projects/:key/tickets`                                               | Create ticket (top of its group, "created the ticket")                                                                   |
| `POST /projects/:key/statuses`, `PUT /projects/:key/statuses/order`         | Create status / reorder                                                                                                  |
| `PATCH /statuses/:id`, `DELETE /statuses/:id?moveTo=`                       | Edit / delete status                                                                                                     |
| `GET/PATCH/DELETE /tickets/:key`                                            | Ticket detail / edit fields (events per SPEC §6.2) / delete                                                              |
| `POST /tickets/:key/move`                                                   | Drag or keyboard move (`planMove`)                                                                                       |
| `GET /tickets/:key/prompt`, `POST /tickets/:key/sent`                       | Ticket prompt / mark as sent                                                                                             |
| `POST /tickets/:key/comments`                                               | Add comment (text and/or `attachmentIds`)                                                                                |
| `PATCH /activity/:id`, `DELETE /activity/:id`                               | Edit comment / delete comment, report or review                                                                          |
| `POST /attachments`, `GET /attachments/:id/file`, `DELETE /attachments/:id` | Upload / serve / delete images                                                                                           |
| `POST /reports/preview`, `POST /reports/apply`                              | Paste-report preview and apply                                                                                           |
| `POST /projects/:key/claim`                                                 | Claim the next `todo` ticket (204 when none)                                                                             |
| `POST /tickets/:key/claim`                                                  | Claim a specific ticket                                                                                                  |
| `POST /tickets/:key/submit`                                                 | Agent submits work for review                                                                                            |
| `POST /tickets/:key/review`                                                 | Agent reviews a ticket in `in_review`                                                                                    |
| `GET /people`                                                               | Assignee suggestions                                                                                                     |
| `GET /meta`                                                                 | Server info for Connect Claude Code: `serverUrl` (`PUBLIC_URL`, else the URL the request reached), entry paths           |
| `GET /events`                                                               | SSE stream of `ChangeEvent` (`{ type: 'changed', projectId, ticketId }`), heartbeat every 25 s                           |
| `GET/POST /session`                                                         | Auth state / exchange token for an HttpOnly cookie                                                                       |

Status changes made by the dropdown, a report, sending, claiming, submitting or reviewing put the ticket at the **top** of its new group (`topRank`). Drags and keyboard moves renumber the destination group (`planMove`).

## 4. Agent integration (`apps/agent`)

- **MCP server** (`tracker-mcp`, stdio): tools `list_projects`, `list_statuses`, `list_tickets`, `get_ticket`, `create_ticket`, `update_ticket`, `move_ticket`, `add_comment`, `claim_next_ticket`, `claim_ticket`, `submit_for_review`, `review_ticket`; prompts `work` and `review` that appear as slash commands in Claude Code. Config by env: `TRACKER_URL`, `TRACKER_TOKEN`, `TRACKER_AGENT_NAME`.
- **CLI** (`tracker`): the same operations for shells and agents without MCP.
- Register with Claude Code for every project: `claude mcp add tracker -s user --env TRACKER_URL=http://localhost:4100 --env TRACKER_AGENT_NAME=Claude -- node <repo>/apps/agent/dist/mcp.js`.
- `move_ticket` uses `PATCH /tickets/:key { statusId }` (top of the new group). In agent-facing text the person is called "User".

## 5. Web app structure (`apps/web/src`)

| Folder        | What                                                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `design/`     | `tokens.css` (all design tokens), `base.css`, `motion.css`                                                                    |
| `components/` | Base components from the Components board, one folder each with a CSS module and tests                                        |
| `navigation/` | Route parsing, stack navigator, transitions, edge swipe back                                                                  |
| `gestures/`   | Swipe actions, pull to refresh, axis drags, haptics, keyboard inset                                                           |
| `overlays/`   | Sheet (dialog / bottom sheet with drag to dismiss), action sheet, image viewer                                                |
| `api/`        | Client instance, query keys, TanStack Query hooks, live events                                                                |
| `features/`   | Screens and sheets: `projects`, `project`, `ticket`, `attachments`, `claude`, `statuses`, `connect`, `capture`                |
| `lib/`        | Small helpers: clipboard, share, platform and media queries, image downscaling, drafts registry, pending writes, `isEditable` |
| `app/`        | Providers, shell (sidebar, header, token screen, offline banner), sheet host, flash and announcements, reachability           |
| `pwa/`        | Service worker registration, update checks, safe reload policy                                                                |

Routes: `/` Projects, `/p/:key` Project, `/p/:key/:num` Ticket. Unknown ticket → its project; unknown project → Projects.
