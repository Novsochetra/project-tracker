import type { ProjectUsage } from '@tracker/shared';
import { projectUsageParts } from '../claude/usageFormat';
import { UsageParts } from '../claude/UsageParts';

export function ProjectUsageNote({ usage }: { usage: ProjectUsage }) {
  return (
    <>
      Claude Code, last {usage.days} days: <UsageParts parts={projectUsageParts(usage)} />
    </>
  );
}
