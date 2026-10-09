import { act, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { NETWORK_ERROR_MESSAGE } from '../../src/api';
import { announce } from '../../src/app/announce';
import { OfflineBanner } from '../../src/app/OfflineBanner';
import { noteAnswer, SAVED_ANSWER_HEADER } from '../../src/pwa/savedAnswers';

// With the service worker on, the tracker's first answer when it comes back is noted as not saved
// a moment before its request reports success and the banner goes. For that moment the banner
// said "Can't reach the tracker", about 1 ms in production (PT-101 review).

const SAVED_DATA_MESSAGE = 'Offline — showing saved data';
const saved = () => new Response('[]', { headers: { [SAVED_ANSWER_HEADER]: '1' } });
const fromTracker = () => new Response('[]');
const banner = () => document.querySelector('.banner');

afterEach(() => {
  noteAnswer(fromTracker());
  announce('');
});

it('keeps saying it shows saved data while the answer that ends it is on its way', () => {
  noteAnswer(saved());
  render(<OfflineBanner />);
  expect(banner()).toHaveTextContent(SAVED_DATA_MESSAGE);

  act(() => noteAnswer(fromTracker()));

  expect(banner()).toHaveTextContent(SAVED_DATA_MESSAGE);
  expect(banner()).not.toHaveTextContent(NETWORK_ERROR_MESSAGE);
});

it("says the tracker can't be reached until a saved answer is shown", () => {
  render(<OfflineBanner />);
  expect(banner()).toHaveTextContent(NETWORK_ERROR_MESSAGE);

  act(() => noteAnswer(saved()));

  expect(banner()).toHaveTextContent(SAVED_DATA_MESSAGE);
});
