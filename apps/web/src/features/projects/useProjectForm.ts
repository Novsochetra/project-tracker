import { useState } from 'react';
import { EMPTY_PROJECT_FORM, type ProjectFormValues } from './projectForm';

export interface ProjectForm {
  values: ProjectFormValues;
  error: string | null;
  setField: (field: keyof ProjectFormValues, value: string) => void;
  setError: (error: string | null) => void;
}

/** Starts from `initial`, or from it once it arrives when the sheet opened before the data. */
export function useProjectForm(initial: ProjectFormValues | undefined): ProjectForm {
  const [values, setValues] = useState(initial ?? EMPTY_PROJECT_FORM);
  const [seeded, setSeeded] = useState(initial !== undefined);
  const [error, setError] = useState<string | null>(null);
  if (!seeded && initial) {
    setSeeded(true);
    setValues(initial);
  }
  const setField = (field: keyof ProjectFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setError(null);
  };
  return { values, error, setField, setError };
}
