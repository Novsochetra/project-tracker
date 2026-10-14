import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formValuesOf, type ProjectFormValues } from './projectForm';
import { useProjectForm } from './useProjectForm';

const website = formValuesOf({
  name: 'Website',
  description: 'Docs',
  repo: '~/code/web',
  maxParallelRuns: 5,
});

function renderForm(initial: ProjectFormValues | undefined) {
  return renderHook(
    (props: { initial: ProjectFormValues | undefined }) => useProjectForm(props.initial),
    { initialProps: { initial } },
  );
}

describe('useProjectForm', () => {
  it('counts text typed into a new project as a change until it is blank again', () => {
    const { result } = renderForm(undefined);
    expect(result.current.changed).toBe(false);
    act(() => result.current.setField('name', 'Garden planner'));
    expect(result.current.changed).toBe(true);
    act(() => result.current.setField('name', '  '));
    expect(result.current.changed).toBe(false);
  });

  it('starts an edit from a project that loads late without counting it as a change', () => {
    const { result, rerender } = renderForm(undefined);
    rerender({ initial: website });
    expect(result.current.values).toEqual(website);
    expect(result.current.changed).toBe(false);
    act(() => result.current.setField('name', 'Marketing site'));
    expect(result.current.changed).toBe(true);
  });

  it('keeps comparing with the project it started from when it changes elsewhere', () => {
    const { result, rerender } = renderForm(website);
    rerender({ initial: { ...website, name: 'Renamed by an agent' } });
    expect(result.current.values.name).toBe('Website');
    expect(result.current.changed).toBe(false);
  });
});
