import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Sidebar } from '../../src/app/Sidebar';
import { projectSummary, renderWithApp } from '../../src/app/test/harness';
import { ProjectCard } from '../../src/features/projects/ProjectCard';
import { ProjectRow } from '../../src/features/projects/ProjectRow';

// The name, key and counts are separate spans; without spaces between them screen readers
// heard "Mobile app3open" and "Mobile appMOB".
describe('project names read with spaces between their parts', () => {
  const project = projectSummary({ openCount: 3, description: 'Phone app' });

  it('in the sidebar', () => {
    renderWithApp(<Sidebar />, { projects: [project] });
    expect(screen.getByRole('button', { name: 'Mobile app 3 open' })).toBeInTheDocument();
  });

  it('in the phone Projects list', () => {
    renderWithApp(<ProjectRow project={project} readyCount={0} index={0} onOpen={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'Mobile app MOB Phone app 3 open' }),
    ).toBeInTheDocument();
  });

  it('in the phone Projects list, with tickets ready for you', () => {
    renderWithApp(<ProjectRow project={project} readyCount={2} index={0} onOpen={() => {}} />);
    expect(
      screen.getByRole('button', { name: 'Mobile app MOB Phone app 1 open 2 ready' }),
    ).toBeInTheDocument();
  });

  it('in the desktop Projects grid, with tickets ready for you', () => {
    renderWithApp(
      <ProjectCard
        project={project}
        readyCount={2}
        index={0}
        now={project.lastActivityAt}
        onOpen={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', {
        name: 'Mobile app MOB Updated just now Phone app 75% 1 done 2 ready 1 open',
      }),
    ).toBeInTheDocument();
  });
});
