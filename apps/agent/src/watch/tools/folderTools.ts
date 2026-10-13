import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const entriesOf = (path: string) => readdir(path, { withFileTypes: true }).catch(() => []);

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );

const byName = (names: string[]) => names.sort((a, b) => a.localeCompare(b));

export async function commandNames(folder: string): Promise<string[]> {
  const entries = await entriesOf(join(folder, '.claude', 'commands'));
  return byName(
    entries
      .filter((entry) => !entry.isDirectory() && entry.name.endsWith('.md'))
      .map((entry) => entry.name.slice(0, -'.md'.length)),
  );
}

export async function skillNames(folder: string): Promise<string[]> {
  const skills = join(folder, '.claude', 'skills');
  const names = (await entriesOf(skills)).map((entry) => entry.name);
  const found = await Promise.all(names.map((name) => exists(join(skills, name, 'SKILL.md'))));
  return byName(names.filter((_, index) => found[index]));
}
