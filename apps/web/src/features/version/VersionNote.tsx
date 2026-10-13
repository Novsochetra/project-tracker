import { versionLabel } from '@tracker/shared';
import { useMeta } from '../../api/hooks/meta';
import styles from './VersionNote.module.css';

export function VersionNote() {
  const meta = useMeta().data;
  if (!meta) return null;
  return <p className={styles.version}>Tracker {versionLabel(meta.version, meta.commit)}</p>;
}
