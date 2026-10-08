import { useMemo, useState } from 'react';
import { useProjects } from '../../api';
import {
  defaultProjectKey,
  projectChoices,
  readLastProject,
  resolveProject,
  type ProjectChoice,
} from './captureProjects';

export interface CaptureProject {
  choices: ProjectChoice[];
  current: ProjectChoice | undefined;
  chosenKey: string | null;
  loaded: boolean;
  choose: (projectKey: string) => void;
}

export function useCaptureProject(keptKey: string | null = null): CaptureProject {
  const projects = useProjects().data;
  const [remembered] = useState(readLastProject);
  const [chosenKey, setChosenKey] = useState(keptKey);
  const choices = useMemo(() => projectChoices(projects, remembered), [projects, remembered]);
  const current = resolveProject(choices, chosenKey, defaultProjectKey(projects, remembered));
  return { choices, current, chosenKey, loaded: projects !== undefined, choose: setChosenKey };
}
