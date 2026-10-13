import { DEFAULT_STATUSES, type StatusTemplate } from './status';

export const PROJECT_TEMPLATE_NAMES = [
  'software',
  'writing',
  'research',
  'operations',
  'personal',
] as const;

export type ProjectTemplateName = (typeof PROJECT_TEMPLATE_NAMES)[number];

export interface ProjectTemplate {
  name: ProjectTemplateName;
  label: string;
  statuses: readonly StatusTemplate[];
  instructions: string;
}

// Each template renames the five defaults in order, so every status keeps its category and color,
// and claim, submit, review and "only a person moves to Done" work as in a software project.
const renamed = (names: readonly string[]): StatusTemplate[] =>
  DEFAULT_STATUSES.map((status, index) => ({ ...status, name: names[index] ?? status.name }));

const WRITING = `This project is writing, not code. There are no tests or builds.
- Done: the piece is written in full, in the voice and length the ticket asks for.
- Verified: you read it through once more: facts and links checked, names and numbers right, no typos.
- Results: attach the draft with attach_file, or link to where it lives, and list it under OUTPUT in your report.`;

const RESEARCH = `This project is research, not code. There are no tests or builds.
- Done: the question has a short answer: what is known, what is not, and how sure you are.
- Verified: every claim has a source you opened yourself, linked next to it.
- Results: attach notes, tables or data with attach_file, link the sources, and list them under OUTPUT in your report.`;

const OPERATIONS = `This project is operations work, not code changes. There are no tests or builds unless a ticket asks for them.
- Done: the task is carried out, or its steps are written down when only I can do them.
- Verified: you checked the result where it lives (the setting, the account, the system) and say how.
- Results: attach checklists, exports or screenshots with attach_file, link what you changed, and list them under OUTPUT in your report.
- Ask me before anything that costs money or can't be undone.`;

const PERSONAL = `This project is personal tasks, not code. There are no tests or builds.
- Done: the task is finished, or there is a clear plan or answer I can act on.
- Verified: you checked the details that matter: dates, times, prices, addresses and links.
- Results: attach lists, plans or files with attach_file, add links, and list them under OUTPUT in your report.
- Never buy, book or send anything for me: say what to do and I'll do it.`;

export const PROJECT_TEMPLATES: Readonly<Record<ProjectTemplateName, ProjectTemplate>> = {
  software: { name: 'software', label: 'Software', statuses: DEFAULT_STATUSES, instructions: '' },
  writing: {
    name: 'writing',
    label: 'Writing',
    statuses: renamed(['Ideas', 'Drafting', 'Needs edit', 'Edited', 'Published']),
    instructions: WRITING,
  },
  research: {
    name: 'research',
    label: 'Research',
    statuses: renamed(['Questions', 'Researching', 'Needs check', 'Checked', 'Answered']),
    instructions: RESEARCH,
  },
  operations: {
    name: 'operations',
    label: 'Operations',
    statuses: renamed(['To do', 'Doing', 'Needs check', 'Checked', 'Done']),
    instructions: OPERATIONS,
  },
  personal: {
    name: 'personal',
    label: 'Personal',
    statuses: renamed(['To do', 'Doing', 'Check', 'Ready', 'Done']),
    instructions: PERSONAL,
  },
};

export const DEFAULT_PROJECT_TEMPLATE: ProjectTemplateName = 'software';
