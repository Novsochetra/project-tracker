# A project that isn't code

A project doesn't need code. Claude Code in a folder with MCP servers for Notion, Google Drive, Gmail or Calendar can draft a newsletter, sort an inbox or plan a week. The tracker treats that folder like any other: you capture tickets on your phone, a helper on your computer runs Claude Code there, and the result comes back on the ticket.

This guide goes from an empty folder to a finished run. The example is a weekly newsletter written from notes in Notion.

## 1. Make the folder

```bash
mkdir -p ~/work/newsletter
cd ~/work/newsletter
git init        # optional: lets you see and undo what Claude changed
```

## 2. Tell Claude what the folder is for

Claude Code reads `CLAUDE.md` in the folder at the start of every run. Write it like a note to a new colleague:

```markdown
# Newsletter

The weekly newsletter for our customers, written from the team's notes in Notion
("Newsletter notes" database).

- Drafts go in drafts/YYYY-MM-DD.md. Keep each one under 600 words.
- Plain, friendly English. No jargon.
- Never send an email. Drafts only.
```

## 3. Connect the tools

Each project folder can have its own MCP servers in `.mcp.json`. For Notion's hosted server:

```json
{
  "mcpServers": {
    "notion": { "type": "http", "url": "https://mcp.notion.com/mcp" }
  }
}
```

`claude mcp add --scope project <name> …` writes the same file for any other server. Connectors you added on claude.ai (Gmail, Google Calendar, Google Drive) come with your Claude login, in every folder.

Then open Claude Code in the folder once:

```bash
claude
```

It asks whether to use the servers in `.mcp.json`: say yes. Type `/mcp` to sign in to the ones that need it, then quit. Check that they work:

```bash
claude mcp list
```

Each server you want should say `✔ Connected`.

## 4. Add your own commands (optional)

A command is a prompt you use often, kept in `.claude/commands/<name>.md`; a skill is a folder with a `SKILL.md` in `.claude/skills/<name>/`. Claude Code starts both with a slash.

```bash
mkdir -p .claude/commands
cat > .claude/commands/weekly-draft.md <<'EOF'
Read this week's pages in the "Newsletter notes" database in Notion and write the draft
in drafts/, following CLAUDE.md.
EOF
```

A ticket can then say "Run /weekly-draft for this week".

## 5. Let runs use the tools without asking

Claude Code asks before it uses an MCP tool. A run on your phone can't answer that unless you start the helper with `--approvals`, so allow the tools you trust in `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["mcp__notion", "Write(drafts/**)", "Edit(drafts/**)"]
  }
}
```

`mcp__notion` allows every tool of the `notion` server. Leave out what should still ask, and start the helper with `--approvals` so those steps ask on your phone.

## 6. Make the project in the app

1. Add the tracker's own MCP server to Claude Code once, if you haven't: **Connect Claude Code** in the app has the `claude mcp add tracker` command.
2. **New project**: name it "Newsletter" and put the folder in **Repository**: `~/work/newsletter`. That is how `tracker watch` finds the project from the folder.
3. Under **Instructions for Claude**, add what every ticket in this project should know, for example "Attach the finished draft to the ticket with attach_file." Claude gets these with every ticket and question in the project.

## 7. Start the helper there

```bash
cd ~/work/newsletter
tracker login --url https://your-tracker.up.railway.app   # once per computer
tracker watch --name "Dara's MacBook"
```

`--install` starts it by itself at login (see `apps/agent/README.md`). In the app, **Connect Claude Code** now lists the computer with what it can use: "Notion, Gmail, /weekly-draft". The **Run on** row of the prompt sheet and of Ask Claude shows the same when you have more than one helper. The tracker's own server isn't listed, since every run has it. The helper reads the list again every 5 minutes, so a server you add shows up within that.

If a server you expect is missing, run `claude mcp list` in the folder: only servers that say `✔ Connected` are listed.

## 8. Run a ticket

1. Capture a ticket on your phone: "Draft this week's newsletter".
2. Open it, tap **Send to Claude**, then **Run in Claude Code**.
3. The ticket shows Claude's steps while it works ("Use notion: search", "Write drafts/2026-10-16.md"). A step outside your allow rules asks on the phone when the helper runs with `--approvals`.
4. When Claude is done it attaches the draft, says what it did in its report, and moves the ticket to **Need review**.
5. Read the draft on the ticket. Send it back with a comment, or move the ticket to **Done**.

**Ask Claude** works in the same folder. Ask and Plan questions are read-only and start Claude without any MCP server, so they answer from the folder's files only; an **Edit** question gets the same tools as a ticket run.
