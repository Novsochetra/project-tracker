import { useNavigation } from '../../navigation';
import { newTicketChatRoute } from '../ask/ticketChat';

// A new chat about the ticket, under its screen, so Back returns to the ticket (PT-184).
export function useAskClaude(ticketKey: string): () => void {
  const { push } = useNavigation();
  return () => {
    const route = newTicketChatRoute(ticketKey);
    if (route) push(route);
  };
}
