import { collapseGroup } from '@tracker/shared';
import clsx from 'clsx';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '../../../components';
import { LinkedText } from './LinkedText';
import styles from './ReportBody.module.css';

// A long list collapses like a long group (SPEC §7.3): PT-23's 46 files made a 3,700px card on a
// 320px phone.
export function ReportFiles({ files }: { files: readonly string[] }) {
  const [expanded, setExpanded] = useState(false);
  const { shown, hiddenCount, hasToggle } = collapseGroup(files, { expanded, searching: false });
  return (
    <>
      <ul className={styles.files}>
        {shown.map((file, index) => (
          <li key={index}>
            <LinkedText text={file} />
          </li>
        ))}
      </ul>
      {hasToggle && (
        <button
          type="button"
          className={clsx('ring-inside', styles.more)}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show less' : `Show ${hiddenCount} more`}
          <Icon icon={ChevronDown} className={styles.chevron} />
        </button>
      )}
    </>
  );
}
