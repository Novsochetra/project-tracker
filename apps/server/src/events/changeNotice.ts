import type { ChangeEvent } from '@tracker/shared';
import type { UserScope } from '../auth/scope';

// The user whose project changed stays on the server; streams get the event alone.
export interface ChangeNotice {
  userId: UserScope;
  event: ChangeEvent;
}
