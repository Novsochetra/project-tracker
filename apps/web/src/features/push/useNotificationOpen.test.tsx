import { act, render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, expect, it } from 'vitest';
import { NavigationProvider } from '../../navigation';
import { OPEN_MESSAGE } from '../../pwa/push/openMessage';
import { stubPush, unstubPush } from './test/fakePush';
import { useNotificationOpen } from './useNotificationOpen';

function Probe() {
  useNotificationOpen();
  return <p>{useLocation().pathname}</p>;
}

afterEach(() => {
  unstubPush();
});

it('shows the page a tapped notification names, and nothing outside the app', () => {
  const { worker } = stubPush();
  const view = render(
    <MemoryRouter initialEntries={['/']}>
      <NavigationProvider>
        <Probe />
      </NavigationProvider>
    </MemoryRouter>,
  );
  const send = (data: unknown) =>
    act(() => {
      worker.dispatchEvent(new MessageEvent('message', { data }));
    });
  send({ type: OPEN_MESSAGE, path: '//evil.example/' });
  expect(view.container).toHaveTextContent(/^\/$/);
  send({ type: OPEN_MESSAGE, path: '/p/MOB/3' });
  expect(view.container).toHaveTextContent('/p/MOB/3');
});
