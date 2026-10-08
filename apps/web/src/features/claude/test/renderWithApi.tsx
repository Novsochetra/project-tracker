import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { setupApi } from '../../../api/test/render';
import { ToastProvider } from '../../../components';
import { mockPhone, skipAnimations } from '../../../overlays/testing';

type ClientOverrides = Parameters<typeof setupApi>[0];

export function renderWithApi(ui: ReactElement, overrides: ClientOverrides = {}) {
  const api = setupApi(overrides);
  const Wrapper = api.wrapper;
  const view = render(
    <Wrapper>
      <ToastProvider>{ui}</ToastProvider>
    </Wrapper>,
  );
  return { ...api, ...view };
}

export function sheetTestSetup(isPhone = false): () => void {
  const undo = [skipAnimations(), mockPhone(isPhone)];
  return () => undo.forEach((restore) => restore());
}

export function setClipboard(value: Partial<Clipboard> | undefined): void {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

export function setShare(value: Navigator['share'] | undefined): void {
  Object.defineProperty(navigator, 'share', { value, configurable: true });
}
