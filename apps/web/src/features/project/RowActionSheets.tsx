import { sortStatuses, type Status } from '@tracker/shared';
import { ActionSheet, type ActionSheetAction } from '../../overlays';
import { useRemoveTicket, useStatusChange } from './rowEdits';
import type { RowSheet } from './useRowSheet';

export interface RowActionSheetsProps {
  sheet: RowSheet | null;
  statuses: readonly Status[];
  onClose: () => void;
}

export function RowActionSheets({ sheet, statuses, onClose }: RowActionSheetsProps) {
  const changeStatus = useStatusChange();
  const removeTicket = useRemoveTicket();
  const ticket = sheet?.ticket;
  const statusActions: ActionSheetAction[] = ticket
    ? sortStatuses(statuses)
        .filter((status) => status.id !== ticket.statusId)
        .map((status) => ({
          label: status.name,
          onSelect: () => {
            changeStatus(ticket, status);
            onClose();
          },
        }))
    : [];
  const deleteActions: ActionSheetAction[] = ticket
    ? [
        {
          label: 'Delete ticket',
          tone: 'danger',
          bold: true,
          onSelect: () => {
            removeTicket(ticket);
            onClose();
          },
        },
      ]
    : [];
  return (
    <>
      <ActionSheet
        open={sheet?.kind === 'status' && sheet.open}
        onClose={onClose}
        label="Status"
        caption={ticket && `Move ${ticket.key} to`}
        actions={statusActions}
      />
      <ActionSheet
        open={sheet?.kind === 'delete' && sheet.open}
        onClose={onClose}
        label="Delete ticket"
        caption={ticket && `Delete ${ticket.key}? This can't be undone.`}
        actions={deleteActions}
      />
    </>
  );
}
