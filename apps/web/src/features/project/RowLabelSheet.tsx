import type { ProjectBoard } from '@tracker/shared';
import { LabelSheet } from '../labels/LabelSheet';
import { useManageLabels } from '../labels/useManageLabels';
import { useLabelsChange } from './rowEdits';
import type { RowSheet } from './useRowSheet';

export interface RowLabelSheetProps {
  sheet: RowSheet | null;
  board: ProjectBoard;
  onClose: () => void;
}

// A swipe's Labels tags a ticket from the list. The sheet reads the ticket from the board, not
// the swipe's copy, so each pick shows the one before it.
export function RowLabelSheet({ sheet, board, onClose }: RowLabelSheetProps) {
  const changeLabels = useLabelsChange();
  const onManage = useManageLabels(board.project.key, onClose);
  const ticket = sheet?.ticket;
  const live = ticket && board.tickets.find((item) => item.id === ticket.id);

  return (
    <LabelSheet
      open={sheet?.kind === 'labels' && sheet.open}
      onClose={onClose}
      projectKey={board.project.key}
      labels={board.labels ?? []}
      value={live?.labelIds ?? ticket?.labelIds ?? []}
      subtitle={ticket?.key}
      onManage={onManage}
      onChange={(labelIds) => {
        if (ticket) changeLabels(ticket, labelIds);
      }}
    />
  );
}
