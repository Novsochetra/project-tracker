import { CircleUser } from 'lucide-react';
import { useKnownSession } from '../../api';
import { useSheets } from '../../app/sheets/context';
import { Icon } from '../../components';
import { NavBarButton } from '../../navigation';
import styles from './AccountButton.module.css';

// Only while signed in with the owner's account: a tracker open without one has no one to sign out.
function useAccount() {
  const email = useKnownSession()?.email;
  const sheets = useSheets();
  return { email, open: () => sheets.open({ type: 'account' }) };
}

export function AccountButton() {
  const { email, open } = useAccount();
  if (!email) return null;
  return (
    <NavBarButton aria-label="Account" onClick={open}>
      <Icon icon={CircleUser} size={20} />
    </NavBarButton>
  );
}

export function AccountRow() {
  const { email, open } = useAccount();
  if (!email) return null;
  return (
    <button type="button" className={styles.row} aria-label="Account" onClick={open}>
      <Icon icon={CircleUser} className={styles.icon} />
      <span className={styles.email}>{email}</span>
    </button>
  );
}
