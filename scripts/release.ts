import { fileURLToPath } from 'node:url';
import { todayYmd } from '../packages/shared/src/logic/format';
import { isReleasePart, RELEASE_PARTS } from './release/bump';
import { release } from './release/release';

const part = process.argv[2];
const root = fileURLToPath(new URL('..', import.meta.url));

if (!isReleasePart(part)) {
  console.error(`Usage: npm run release -- ${RELEASE_PARTS.join('|')}`);
  process.exitCode = 2;
} else {
  try {
    const { tag, subjects } = release({ cwd: root, part, day: todayYmd() });
    process.stdout.write(
      `Committed and tagged ${tag} with ${subjects.length} change(s) in CHANGELOG.md.\n` +
        `Check it, then push it: git push --follow-tags\n`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
