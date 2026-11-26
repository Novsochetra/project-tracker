# Testing

Rules for testing that hold in any project. They name no file, folder or command of one project, so
this file can be copied as it is; a project's `CLAUDE.md` imports it and says where its tests live
and how to run them.

- Unit tests are not enough. Each change needs the right mix of:
  - **unit** tests for plain functions,
  - **integration** tests for modules working together: a server answering over HTTP, a page
    rendered against its real data, a simulation running many systems at once,
  - **regression** tests that lock in fixed bugs and the program's recorded behavior.
- Fixing a bug: first write a test that reproduces it and fails, then fix it, then keep the test.
- Verify your work: run the project's full check (lint, format, types, every test, the build)
  before calling it done, and look at UI changes in a browser.
- Changing behavior on purpose changes the recorded runs and snapshots: update them, review the
  diff, and keep only the changes you meant.
