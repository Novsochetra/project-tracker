import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { InputRow } from '../../src/components/PropertyRow/InputRow';
import { phoneRule } from './phoneCss';

// PT-110, from PT-84: the New ticket sheet's Assignee row kept about 40px free at its end while a
// long name was typed in iOS Safari (iPhone 17 Pro, iOS 26.3), so the name's start scrolled out
// early. It is the suggestions button PT-84 took out of the ticket's assignee chip: WebKit shows it
// with `display: block !important` in its own style whenever the field has a list. The rule now
// lives once in base.css for every field with a list. jsdom lays out nothing, so this checks that
// the rule reaches the row's field.

const LIST_BUTTON = 'input[list]::-webkit-list-button';

it('takes the suggestions button out of the line of a row with suggestions', () => {
  render(<InputRow icon={null} label="Assignee" suggestions={['Dara']} defaultValue="" />);
  const field = screen.getByRole('combobox', { name: 'Assignee' });
  expect(field.matches(LIST_BUTTON.split('::')[0]!)).toBe(true);
  const button = phoneRule('design/base.css', LIST_BUTTON);
  expect(button.get('position')).toBe('absolute !important');
  expect(button.get('width')).toBe('0 !important');
});
