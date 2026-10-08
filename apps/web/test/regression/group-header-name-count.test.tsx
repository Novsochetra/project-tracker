import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { statuses } from '../../src/api/test/fixtures';
import { GroupHeader } from '../../src/features/project/GroupParts';

// The status name and its count are separate spans; without a space between them screen
// readers heard "To do3" in list group and board column headers.
describe('group and column headers read the status name apart from its count', () => {
  it('puts a space between the name and the count', () => {
    const status = statuses[0]!;
    render(<GroupHeader status={status} count={3} tint={false} onAdd={() => {}} />);
    expect(screen.getByText('To do').parentElement).toHaveTextContent(/^To do 3$/);
  });
});
