import { useState } from 'react';
import { EMPTY_PROJECT_FORM, projectFormChanged, type ProjectFormValues } from './projectForm';

export interface ProjectForm {
  values: ProjectFormValues;
  changed: boolean;
  error: string | null;
  setField: <K extends keyof ProjectFormValues>(field: K, value: ProjectFormValues[K]) => void;
  setError: (error: string | null) => void;
}

// The sheet can open before the project has loaded: the form then starts from the project once
// it arrives, and that start, not a blank form, is what typed changes are measured against.
export function useProjectForm(initial: ProjectFormValues | undefined): ProjectForm {
  const [start, setStart] = useState(initial);
  const [values, setValues] = useState(initial ?? EMPTY_PROJECT_FORM);
  const [error, setError] = useState<string | null>(null);
  if (!start && initial) {
    setStart(initial);
    setValues(initial);
  }
  const setField = <K extends keyof ProjectFormValues>(field: K, value: ProjectFormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
  };
  const changed = projectFormChanged(values, start ?? EMPTY_PROJECT_FORM);
  return { values, changed, error, setField, setError };
}
