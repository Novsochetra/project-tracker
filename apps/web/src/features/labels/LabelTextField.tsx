import { useId } from 'react';
import { AutoTextarea } from '../../components';
import styles from './LabelEditor.module.css';

export interface LabelTextFieldProps {
  label: string;
  hint: string;
  placeholder: string;
  maxLength: number;
  value: string;
  onChange: (value: string) => void;
}

export function LabelTextField({ label, hint, value, onChange, ...field }: LabelTextFieldProps) {
  const id = useId();
  const hintId = useId();
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <AutoTextarea
        id={id}
        className={styles.input}
        rows={2}
        aria-describedby={hintId}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        {...field}
      />
      <p id={hintId} className={styles.hint}>
        {hint}
      </p>
    </div>
  );
}
