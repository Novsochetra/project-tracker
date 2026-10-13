import { describe, expect, it } from 'vitest';
import { formatProjects } from '../../src/format/projects';
import { projectSummary } from '../fixtures';

// A tracker from before PT-181 sends no reviewedCount, and the project list printed
// "NaN open, undefined reviewed" until it was redeployed.
describe('regression: the project list from a tracker without reviewed counts', () => {
  it('counts no reviewed tickets', () => {
    const { reviewedCount: _gone, ...older } = projectSummary({ openCount: 180, totalCount: 180 });
    expect(formatProjects([older])).toBe('MOB · Mobile app · 180 open, 0 reviewed, 180 total');
  });
});
