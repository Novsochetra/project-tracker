# UI guidelines

The tracker looks, moves and sounds like an Apple app. These rules follow Apple's
[Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/); every
UI change keeps them. Values live in `apps/web/src/design/tokens.css`: use a token, never a raw value.

## Principles

- **Clarity:** text is legible at every size, icons are plain, nothing decorates for its own sake.
- **Deference:** content leads; bars, sheets and controls stay quiet around it.
- **Depth:** layers explain where you are: screens push in from the side, sheets rise from below,
  bars are glass over what scrolls under them.

## Look

- Type is San Francisco (`--font-sans`, the system font). Phone sizes follow iOS: 34px bold large
  title, 17px semibold bar titles, 16px+ in fields so iOS never zooms.
- Colors are Apple's system grays and indigo tint. Text keeps WCAG AA (4.5:1), icons and lines that
  carry meaning keep 3:1; `test/regression/*contrast*` checks every pair.
- Shapes are round and concentric: pill buttons (`--radius-full`), 10–14px cards and controls,
  28px phone sheets with a grabber. An inner radius is the outer one minus the padding.
- Glass (`--bar-bg`, `--glass-filter`) only for bars that float over content.
- Shadows are soft and large, never a hard dark edge.
- Light and dark: the app follows the system's appearance, and Account → Appearance (System /
  Light / Dark) overrides it. Every color token has a dark value (`:root[data-appearance='dark']`),
  so use a token and never a color that only works on white. Dark is Apple's: a black page with
  everything on it raised a step (#1C1C1E cards, #2C2C2E fills); a gray area holding white cards
  (a phone sheet, a board column) raises its cards with the `--grouped-*` tokens. White on a
  color is `--text-on-tint`, tinted text `--accent-text`, focus rings `--focus-ring`. Status and
  label colors are data: draw them through `markColor` / `chipTextColor`, which keep them
  readable on dark. Shadows vanish on black, so raised things there also take a hairline.

## Layout and touch

- Every tap target is at least 44×44px (`--touch-target`). On phones every control (tabs,
  segmented, search, buttons, switch rows) is drawn at one height, `--control-drawn`, inside it; a
  `::before` takes the rest. Never give one control its own height.
- Phone first at 375px, then check 1280px. Respect the safe areas (`--safe-*`).
- One primary action per screen, within thumb reach on phones: a screen's New ticket is a round
  floating button at the bottom right (`BottomBar floating`).
- Phone sheets float 8px clear of the screen's edges, gray with white borderless cards, tinted
  Close/Cancel, and a bar line only once content scrolls under it; put typed fields in a white card.
- Use the system patterns already in the app: navigation stack with large titles, inset grouped
  lists, segmented controls, sheets, action sheets for choices, swipe actions on rows.

## Motion

- Motion explains a change; it never just decorates. Springs, not linear easing (`--ease-*`).
- A press answers at once: scale to about 0.96 and dim (`--dim-pressed`).
- Everything a finger drags follows the finger, then settles with its velocity.
- `prefers-reduced-motion` swaps slides and springs for fades.
- A change of appearance cross-fades the whole screen; with reduced motion it changes at once.

## Sound and haptics

- Sound marks a change of state, never every tap: a segment or switch flips, a row lifts, a sheet
  opens or closes, a ticket moves, is sent or is finished (`apps/web/src/sound`).
- One action, one sound: when a choice closes a sheet, only the choice sounds.
- Cues are synthesized, under half a second and quiet. Account → Sounds turns them off, and the
  phone's silent switch mutes them.
- A haptic goes with the same moments where the device has one.

## Words

- Short, plain, sentence case. Buttons say what they do ("Create", "Move to Done").
- Destructive actions are red and ask first, or offer Undo.
