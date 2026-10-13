import { COMMENT_TEXT_MAX, MAX_NEW_ATTACHMENTS, type Attachment } from '@tracker/shared';
import { z } from 'zod';
import type { TrackerApi } from '../client';
import { attachFolders } from '../files/allowedPath';
import { checkLocalFile, readLocalFile, type LocalFile } from '../files/localFile';
import { ticketKey } from './fields';
import { defineTool, type ToolReply } from './tool';

const TOO_MANY = `Attach up to ${MAX_NEW_ATTACHMENTS} files at a time.`;

export const nameList = (names: readonly string[]): string =>
  names.length < 2 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

// One at a time, so they keep the order given and a big video isn't held in memory with the rest.
async function upload(client: TrackerApi, files: readonly LocalFile[], ticket?: string) {
  const uploaded: Attachment[] = [];
  for (const file of files) {
    uploaded.push(await client.uploadAttachment(await readLocalFile(file), file.name, ticket));
  }
  return uploaded;
}

async function attach(
  client: TrackerApi,
  ticket: string,
  files: readonly LocalFile[],
  comment: string,
): Promise<ToolReply> {
  const names = nameList(files.map((file) => file.name));
  if (!comment) {
    const attachments = await upload(client, files, ticket);
    return { text: `Attached ${names} to ${ticket}.`, data: attachments };
  }
  const attachmentIds = (await upload(client, files)).map((file) => file.id);
  const activity = await client.addComment(ticket, { text: comment, attachmentIds });
  return { text: `Added a comment with ${names} to ${ticket}.`, data: activity };
}

export const attachFile = defineTool({
  name: 'attach_file',
  description:
    "Attach local files to a ticket, or to a new comment on it when you pass a comment. Use it for results that aren't " +
    'code changes, such as a draft, a CSV, a PDF or an image, so the person can read them on their phone, and list ' +
    'them under OUTPUT in your report. Only files in the current folder or a temp folder can be attached: images ' +
    '(PNG, JPEG, GIF, WebP, HEIC), videos (MP4, MOV, WebM), text files (TXT, LOG, MD, CSV, JSON) and PDFs.',
  input: z.object({
    ticket: ticketKey,
    paths: z
      .array(z.string().trim().min(1, 'A file path cannot be empty.'))
      .min(1, 'Pass at least one file.')
      .max(MAX_NEW_ATTACHMENTS, TOO_MANY)
      .describe('Paths of the files, absolute or relative to the current folder.'),
    comment: z
      .string()
      .trim()
      .max(COMMENT_TEXT_MAX)
      .optional()
      .describe(
        'Text of a comment to attach the files to. Without it they go under the description.',
      ),
  }),
  readOnly: false,
  async handler(client, { ticket, paths, comment = '' }) {
    const folders = attachFolders();
    const files: LocalFile[] = [];
    // Every file is checked before any is sent, so a bad path leaves the ticket as it was.
    for (const path of paths) files.push(await checkLocalFile(path, folders));
    return attach(client, ticket, files, comment);
  },
});
