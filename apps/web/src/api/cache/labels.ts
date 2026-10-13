import { sortLabels, type Label } from '@tracker/shared';

interface WithLabels {
  labels?: Label[];
}

export const withLabels = <T extends WithLabels>(
  data: T,
  update: (labels: Label[]) => Label[],
): T => ({ ...data, labels: update(data.labels ?? []) });

export function reorderLabelList(labels: readonly Label[], ids: readonly string[]): Label[] {
  const order = new Map(ids.map((id, index) => [id, index]));
  return sortLabels(
    labels.map((label) => ({
      ...label,
      position: order.get(label.id) ?? ids.length + label.position,
    })),
  );
}

export const upsertLabel = (labels: readonly Label[], label: Label): Label[] =>
  sortLabels([...labels.filter((item) => item.id !== label.id), label]);

export const removeLabel = (labels: readonly Label[], labelId: string): Label[] =>
  labels.filter((label) => label.id !== labelId);
