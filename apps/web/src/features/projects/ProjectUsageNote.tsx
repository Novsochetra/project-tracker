import { useProjectUsage } from '../../api/hooks/projectUsage';
import { projectUsageParts } from '../claude/usageFormat';
import { UsageParts } from '../claude/UsageParts';

export interface ProjectUsageNoteProps {
  projectKey: string;
  className?: string | undefined;
}

export function ProjectUsageNote({ projectKey, className }: ProjectUsageNoteProps) {
  const usage = useProjectUsage(projectKey).data;
  if (!usage || usage.runs === 0) return null;
  return (
    <span className={className}>
      Claude Code, last {usage.days} days: <UsageParts parts={projectUsageParts(usage)} />
    </span>
  );
}
