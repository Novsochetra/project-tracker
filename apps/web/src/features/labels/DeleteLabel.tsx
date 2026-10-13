import type { Label } from '@tracker/shared';
import { errorMessage } from '../../api';
import { useDeleteLabel } from '../../api/hooks/labels';
import { ConfirmCard } from '../../components';
import styles from '../statuses/StatusEditor.module.css';
import { deleteMessage } from './labelForm';

export interface DeleteLabelProps {
  projectKey: string;
  label: Label;
  count: number;
  onCancel: () => void;
  onDeleted: () => void;
}

export function DeleteLabel({ projectKey, label, count, onCancel, onDeleted }: DeleteLabelProps) {
  const remove = useDeleteLabel();
  const confirm = () => remove.mutate({ projectKey, labelId: label.id }, { onSuccess: onDeleted });
  return (
    <div className={styles.confirm}>
      <ConfirmCard
        message={deleteMessage(label.name, count)}
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
