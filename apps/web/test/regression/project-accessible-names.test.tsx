import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sidebar } from '../../src/app/Sidebar';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { ProjectRow } from '../../src/features/projects/ProjectRow';

// The name, key and counts are separate spans; without spaces between them screen readers
// heard "Mobile app3open" and "Mobile appMOB".
describe('project names read with spaces between their parts', () => {
  const project = projectSummary({ openCount: 3, description: 'Phone app' });

  it('in the sidebar', () => {
    renderWithApp(<Sidebar />, { projects: [project] });
    expect(screen.getByRole('button', { name: 'Mobile app 3 open' })).toBeInTheDocument();
  });

  it('in the Projects list', () => {
    renderWithApp(
      <ProjectRow project={project} index={0} now={project.lastActivityAt} onOpen={() => {}} />,
    );
    expect(
      screen.getByRole('button', { name: 'Mobile app MOB Phone app 25% 3 open Updated just now' }),
    ).toBeInTheDocument();
  });
});
