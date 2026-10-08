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
  /** The project list has loaded, so an empty one really means there are no projects. */
  loaded: boolean;
  choose: (projectKey: string) => void;
}

export function useCaptureProject(): CaptureProject {
  const projects = useProjects().data;
  const [remembered] = useState(readLastProject);
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const choices = useMemo(() => projectChoices(projects, remembered), [projects, remembered]);
  const current = resolveProject(choices, chosenKey, defaultProjectKey(projects, remembered));
  return { choices, current, loaded: projects !== undefined, choose: setChosenKey };
}
