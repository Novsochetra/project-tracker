import { AgentAvatar } from '../../components';
import styles from './ChatScreen.module.css';

export function ClaudeFrom() {
  return (
    <div className={styles.from}>
      <AgentAvatar />
      <span>Claude</span>
    </div>
  );
}
