# A project that isn't code

A project doesn't need code. An agent in a folder with MCP servers for Notion, Google Drive, Gmail or Calendar can draft a newsletter, sort an inbox or plan a week. The tracker treats that folder like any other: you capture tickets on your phone, the agent works on them in the folder through the tracker's MCP server, and the result comes back on the ticket.

This guide goes from an empty folder to a finished ticket. The example is a weekly newsletter written from notes in Notion, with Claude Code as the agent; another agent works the same way, with its own instructions file, MCP settings and permissions.

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

## 5. Let Claude use the tools without asking

Claude Code asks before it uses an MCP tool. To skip that for the tools you trust, allow them in `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": ["mcp__notion", "Write(drafts/**)", "Edit(drafts/**)"]
  }
}
```

`mcp__notion` allows every tool of the `notion` server. Leave out what should still ask.

## 6. Make the project in the app

1. Add the tracker's own MCP server to Claude Code once, if you haven't: **Connect an agent** in the app has the `claude mcp add tracker` command.
2. **New project**: name it "Newsletter" and put the folder in **Repository**: `~/work/newsletter`. Its key is `NEW`. A tracker slash command run without a key finds the project from the folder it runs in.
3. Under **Instructions for agents**, add what every ticket in this project should know, for example "Attach the finished draft to the ticket with attach_file." The agent gets these with every ticket it reads in the project.

## 7. Work on a ticket

1. Capture a ticket on your phone: "Draft this week's newsletter".
2. In the folder, start Claude Code (`cd ~/work/newsletter`, then `claude`) and type the tracker's work command, `/mcp__tracker__work NEW`.

3. Claude claims the ticket, which moves it to **In progress**, reads it with the project's instructions and does the work with the folder's tools. When a decision only you can make blocks it, it asks you on the ticket (`ask_person`), and your phone shows the question, with a notification when they are on.
4. When it is done it attaches the draft, says what it did in its report, and moves the ticket to **Need review**.
5. Read the draft on the ticket. Send it back with a comment, let a reviewer agent check it (`/mcp__tracker__review NEW`), or move the ticket to **Done**.
