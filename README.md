# Tracker

A phone-first project tracker built for working with Claude Code.

- Capture an idea on your phone in a few taps.
- Claude Code agents pick up tickets, work on them, and move them to **Need review**.
- Reviewer agents check the work against the ticket, rate it 1–5, and move it to **Reviewed** — or send it back with feedback.
- You move it to **Done**.

```
To do ──claim──▶ In progress ──submit──▶ Need review ──approve──▶ Reviewed ──you──▶ Done
   ▲                                          │
   └──────────────── request changes ─────────┘
```

## Quick start

```bash
npm install
npm run dev
```

- Web app: http://localhost:5173
- API: http://localhost:4100
- Sample data (optional, while `npm run dev` runs): `npm run seed`

Production-style single process (serves the built web app and the API on one port):

```bash
npm run build
npm start
```

Data lives in `data/` (SQLite database and uploaded images).

## Use it on your phone

The server listens on `127.0.0.1` by default. To reach it from your phone:

1. Start it on all interfaces with a token:

   ```bash
   HOST=0.0.0.0 TRACKER_TOKEN=pick-a-long-secret npm start
   ```

2. Open `http://<your-computer's-LAN-IP>:4100` on the phone and enter the token once.
3. Add it to the home screen (Safari: Share → Add to Home Screen). It opens full screen like an app.

For HTTPS (needed for offline support and the clipboard API), the easiest route is [Tailscale](https://tailscale.com): `tailscale serve --bg 4100`, then open the `https://…ts.net` address on your phone. Start the server with `PUBLIC_URL=https://<your-machine>.ts.net` so Connect Claude Code shows that address.

## Connect Claude Code

Build the agent tools once, then register the MCP server (user scope makes it available in every project):

```bash
npm run build -w @tracker/agent
claude mcp add tracker -s user --env TRACKER_URL=http://localhost:4100 --env TRACKER_AGENT_NAME=Claude -- node "$(pwd)/apps/agent/dist/mcp.js"
```

In any repository, Claude Code then has tracker tools and two slash commands:

- `/mcp__tracker__work` — claim the next ticket in a project, do the work, submit it for review.
- `/mcp__tracker__review` — review tickets in **Need review**, rate them, approve or request changes.

Agents never move tickets to **Done**. See `apps/agent/README.md` for the tools and the `tracker` CLI.

The app also keeps the copy/paste loop: **Send to Claude Code** copies a ready-made prompt, and **Paste report** reads Claude's reply back into the ticket.

## Development

```bash
npm run verify     # format, lint, typecheck, unit + integration tests
npm run test:e2e   # Playwright: iPhone-sized WebKit and desktop Chromium
```

- Architecture and product decisions: `docs/architecture.md`
- Code rules: `CLAUDE.md`
- Original design hand-off: `init-design/`

Configuration (environment variables): `PORT` (4100), `HOST` (127.0.0.1), `DATABASE_URL` (SQLite file path, `:memory:`, or `postgres://…`), `UPLOADS_DIR`, `TRACKER_TOKEN`, `WEB_DIST`, `PUBLIC_URL` (the address agents should use, shown in Connect Claude Code; defaults to the address the request reached).
