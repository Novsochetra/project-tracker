# Versioning

Rules for versioning that hold in any project. They name no file or command of one project, so this
file can be copied as it is; a project's `CLAUDE.md` imports it and says where its version lives,
how to raise it and what its users see.

- The version is SemVer: `major.minor.patch`.
- Raise it without being asked, in the change that ships something users see:
  - **patch** for fixes, tuning, and art, sound or copy redone,
  - **minor** for something new: a feature, a screen, a mode,
  - **major** only for a change that breaks what a user keeps (their saved data, an installed app,
    an API they call), and only once the user agrees.
- A change users never see (tests, docs, tooling, a refactor) keeps the version.
- A branch raises it once, by the most its change needs, over the version on the main branch as it
  merges; it does not add one raise per commit.
- Say in the reply which version it now is.
