import type { Status } from '@tracker/shared';
import { useState } from 'react';
import { errorMessage, useDeleteStatus } from '../../api';
import { ConfirmCard, GroupedCard, SelectRow } from '../../components';
import styles from './StatusEditor.module.css';
import { deleteMessage, moveTargets } from './statusForm';
import { statusOptions } from './statusOptions';

export interface DeleteStatusProps {
  projectKey: string;
  status: Status;
  statuses: readonly Status[];
  count: number;
  onCancel: () => void;
  onDeleted: () => void;
}

export function DeleteStatus(props: DeleteStatusProps) {
  const { projectKey, status, statuses, count, onCancel, onDeleted } = props;
  const targets = moveTargets(statuses, status.id);
  const [moveTo, setMoveTo] = useState(targets[0]?.id ?? '');
  const remove = useDeleteStatus();
  const target = targets.find((candidate) => candidate.id === moveTo);
  const confirm = () =>
    remove.mutate(
      { projectKey, statusId: status.id, moveTo: count > 0 ? moveTo : undefined },
      { onSuccess: onDeleted },
    );
  return (
    <div className={styles.confirm}>
      {count > 0 && (
        <GroupedCard>
          <SelectRow
            label="Move tickets to"
            options={statusOptions(targets)}
            value={moveTo}
            onChange={setMoveTo}
          />
        </GroupedCard>
      )}
      <ConfirmCard
        message={deleteMessage(status.name, count, target)}
        pending={remove.isPending}
        onConfirm={confirm}
        onCancel={onCancel}
      />
      {remove.error && (
        <p role="alert" className={styles.problem}>
          {errorMessage(remove.error)}
        </p>
      )}
    </div>
  );
}
