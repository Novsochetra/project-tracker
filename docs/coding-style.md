# Coding style

Rules for writing code that hold in any project. They name no file, folder or tool of one project,
so this file can be copied as it is; a project's `CLAUDE.md` imports it and adds its own rules.

## Coding

- Simplest solution that works. Small files and functions with one job each; split code instead of
  raising size or complexity limits.
- Put code where it belongs. No god objects, god functions or god files.
- No comments that say what code does. Only write a comment to explain **why** something non-obvious
  is done (workarounds, platform quirks, security reasons). If deleting the comment loses nothing a
  reader can't get from the names and the code, delete it: `// the URL must be https` over
  `isSecureUrl` goes; `// Safari plays no video unless its bytes=0-1 gets a 206` stays.
- Write a why as a short `//` comment, never a `/** */` or `/* */` block or a section banner.
- No `TODO` / `FIXME` comments. Put follow-up work in the tracker as a ticket.
- Put logic in plain functions with unit tests. Components and route handlers stay thin.

## Code style

- Write self-explaining code: descriptive names, no single-letter names except `x`, `y`, `i`, `j`.
- Keep comments minimal: no comments that restate the code, no section-banner comments, no long
  JSDoc on obvious functions.
- A formatter never adds a blank line, so space code into steps yourself (see "Function layout").
  Put a blank line:
  - between the blocks of a function,
  - after a block (`if`, `for`, `try`, `switch`) that closes with `}` when more code follows,
  - after an early return (`if (!pad) { ...; return; }`),
  - before the final `return`, unless it is the only line of the function,
  - between the methods of an object.

  Never put one right after `{` or right before `}`.

  ```js
  function rumblePad(navigator, rumbles) {
    const pads = navigator.getGamepads?.();
    const actuator = pads && firstStandardPad(pads)?.vibrationActuator;

    if (actuator?.playEffect) {
      rumble(actuator, rumbles);
    }
  }
  ```

## Function layout

- Group function bodies into blocks separated by one blank line; each block does one thing.
- Declare variables in the block where they are first used, not at the top of the function.
- Process-wide setup belongs in the entry file, not in the functions that do the work: a server's
  signal and stream handlers and `process.exit`; page-wide listeners on `window` or `document`
  installed once from the page's entry or a module it calls for that, or by a hook that removes them
  again.
- No comments that describe what code does; only comments explaining a non-obvious _why_.

Reordering and grouping alone, with nothing else changed, makes a function read as its steps.
Before, every `const` sits at the top, and `delimiter` and `totals` ride in a block that connects
to the bucket:

```js
export async function listCommand(context) {
  const { args, connect } = context;
  const target = await pickTarget(context);
  const { bucket } = await connect(target.name);
  const delimiter = args.recursive ? null : '/';
  const totals = { files: 0, folders: 0 };
  console.log(`s3://${bucket.name}/`);
  for await (const page of bucket.pages({ delimiter })) {
    countPage(page, totals);
  }
  return totals;
}
```

After, each block is one step, with what it needs declared in it:

```js
export async function listCommand(context) {
  const { args, connect } = context;

  const target = await pickTarget(context);
  const { bucket } = await connect(target.name);

  const delimiter = args.recursive ? null : '/';
  const totals = { files: 0, folders: 0 };

  console.log(`s3://${bucket.name}/`);
  for await (const page of bucket.pages({ delimiter })) {
    countPage(page, totals);
  }

  return totals;
}
```
