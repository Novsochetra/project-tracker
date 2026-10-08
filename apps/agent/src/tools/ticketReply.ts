import { attachmentKind, type TicketDetail } from '@tracker/shared';
import type { TrackerApi } from '../client';
import { ticketFiles, type FileView } from '../format/attachments';
import { formatTicket } from '../format/ticket';
import { ticketImages } from './images';
import { loadTextFiles } from './textFiles';
import type { ToolReply } from './tool';

async function fileView(client: TrackerApi, detail: TicketDetail): Promise<FileView> {
  const textFiles = ticketFiles(detail).filter((file) => attachmentKind(file.mimeType) === 'text');
  return {
    texts: await loadTextFiles(client, textFiles),
    fileUrl: (file) => client.attachmentFileUrl(file.id),
    usesToken: client.usesToken ?? false,
  };
}

export async function ticketReply(
  client: TrackerApi,
  detail: TicketDetail,
  intro?: string,
): Promise<ToolReply> {
  const text = formatTicket(detail, await fileView(client, detail));
  return {
    text: intro ? `${intro}\n\n${text}` : text,
    data: detail,
    images: ticketImages(detail),
  };
}
