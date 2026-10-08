export const moveMessage = (ticketKey: string, statusName: string | null): string =>
  statusName ? `${ticketKey} moved to ${statusName}` : `${ticketKey} moved`;
