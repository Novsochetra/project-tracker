import { avatarColor } from '@tracker/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AgentAvatar, Avatar, YouAvatar } from './Avatar';

describe('Avatar', () => {
  it('shows up to two initials on the color picked from the name', () => {
    render(<Avatar name="Dara Kim Sok" />);
    const avatar = screen.getByRole('img', { name: 'Dara Kim Sok' });
    expect(avatar).toHaveTextContent('DK');
    expect(avatar).toHaveStyle({ backgroundColor: avatarColor('Dara Kim Sok') });
    expect(avatar).toHaveClass('medium');
  });

  it('is a dashed, empty circle when unassigned', () => {
    render(<Avatar name="   " size={20} />);
    const avatar = screen.getByRole('img', { name: 'Unassigned' });
    expect(avatar).toHaveClass('empty', 'small');
    expect(avatar).toBeEmptyDOMElement();
  });

  it('can be hidden from assistive tech when the name is shown nearby', () => {
    render(<Avatar name="Sophea" decorative />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('S')).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws the agent tile and the You badge', () => {
    const { container } = render(
      <>
        <AgentAvatar />
        <YouAvatar />
      </>,
    );
    expect(container.querySelector('.agent svg')).toBeInTheDocument();
    expect(screen.getByText('Y')).toHaveClass('you');
  });
});
