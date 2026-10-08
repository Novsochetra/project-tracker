import { collapseGroup } from '@tracker/shared';
import { useState } from 'react';
import { ShowMoreButton } from '../../../components';
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
        <ShowMoreButton
          expanded={expanded}
          moreLabel={`Show ${hiddenCount} more`}
          onClick={() => setExpanded((value) => !value)}
        />
      )}
    </>
  );
}
