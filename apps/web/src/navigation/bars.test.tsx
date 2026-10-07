import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Plus } from 'lucide-react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockPhone } from '../overlays/testing';
import { BottomBar } from './BottomBar';
import { useBottomBarVisible } from './bottomBarStore';
import { LargeTitle } from './LargeTitle';
import { NavBar } from './NavBar';
import { NavBarButton } from './NavBarButton';
import { NavigationProvider } from './NavigationProvider';

let restore: () => void = () => undefined;

afterEach(() => {
  restore();
});

function LocationProbe() {
  return <output aria-label="Location">{useLocation().pathname}</output>;
}

function BarProbe() {
  return <output aria-label="Bar">{useBottomBarVisible() ? 'raised' : 'flat'}</output>;
}

describe('NavBar', () => {
  it('shows the back button, the title and the right buttons on phones', async () => {
    restore = mockPhone(true);
    const onBack = vi.fn();
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <NavBar
        title="MOB-3"
        mono
        backLabel="Mobile app"
        onBack={onBack}
        right={
          <NavBarButton aria-label="New ticket" onClick={onAdd}>
            <Plus size={20} strokeWidth={1.75} />
          </NavBarButton>
        }
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Back to Mobile app' }));
    await user.click(screen.getByRole('button', { name: 'New ticket' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(screen.getByText('MOB-3')).toHaveClass('mono');
  });

  it('goes back through navigation by default', async () => {
    restore = mockPhone(true);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/p/MOB']}>
        <NavigationProvider>
          <NavBar title="Mobile app" backLabel="Projects" />
          <LocationProbe />
        </NavigationProvider>
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Back to Projects' }));
    expect(screen.getByRole('status', { name: 'Location' })).toHaveTextContent(/^\/$/);
  });

  it('renders nothing on desktop', () => {
    restore = mockPhone(false);
    const { container } = render(<NavBar title="Projects" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('BottomBar', () => {
  it('raises toasts while it shows on phones', () => {
    restore = mockPhone(true);
    const { unmount } = render(
      <>
        <BottomBar>
          <button type="button">Paste report</button>
        </BottomBar>
        <BarProbe />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Paste report' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Bar' })).toHaveTextContent('raised');
    unmount();
    render(<BarProbe />);
    expect(screen.getByRole('status', { name: 'Bar' })).toHaveTextContent('flat');
  });

  it('is not rendered on desktop', () => {
    restore = mockPhone(false);
    render(
      <>
        <BottomBar>
          <button type="button">Paste report</button>
        </BottomBar>
        <BarProbe />
      </>,
    );
    expect(screen.queryByRole('button', { name: 'Paste report' })).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Bar' })).toHaveTextContent('flat');
  });
});

describe('LargeTitle', () => {
  it('renders the page heading with its count', () => {
    render(<LargeTitle aside="3">Projects</LargeTitle>);
    expect(screen.getByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
