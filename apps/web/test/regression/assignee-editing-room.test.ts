import { expect, it } from 'vitest';
import { phoneRule } from './phoneCss';

// PT-84, from PT-73's review (iOS Safari, iPhone 17 Pro, iOS 26.3): while a long assignee name was
// edited, the field cut it about 46px before its end. That room is the suggestions list's button:
// WebKit gives it `display: block !important` in its inline style while the field has a list, so
// the chip's `display: none !important` lost, and iOS draws nothing there. Taken out of the flow
// with no width it keeps no room (checked in the Simulator: the text ran to the field's end with a
// list as without one). jsdom lays out nothing, so this checks the rule. Since PT-110 the rule is
// in base.css for every field with a list, the New ticket sheet's Assignee row too.

it('takes the suggestions button out of the assignee field’s line', () => {
  const button = phoneRule('design/base.css', 'input[list]::-webkit-list-button');
  expect(button.get('position')).toBe('absolute !important');
  expect(button.get('width')).toBe('0 !important');
});
