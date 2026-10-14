import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { makeTicketDetail, project } from '../../../api/test/fixtures';
import { InfoLine } from './InfoLine';

const lineText = () => screen.getByText(/Created/).closest('p')?.textContent ?? '';

describe('InfoLine', () => {
  it('says which project the ticket is in', () => {
    render(<InfoLine detail={makeTicketDetail()} now={Date.now()} />);
    expect(lineText()).toMatch(/^Project Mobile app /);
  });

  it('names a project that hides its name once, by its key', () => {
    const detail = { ...makeTicketDetail(), project: { ...project, hideName: true } };
    render(<InfoLine detail={detail} now={Date.now()} />);
    expect(lineText()).toMatch(/^Project MOB /);
    expect(lineText()).not.toContain('Mobile app');
  });
});
