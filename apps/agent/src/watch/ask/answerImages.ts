import { resolve } from 'node:path';
import {
  answerImagePaths,
  changesFolder,
  CHAT_ANSWER_IMAGE_TYPES,
  sniffImageType,
  type Attachment,
  type FinishRunInput,
} from '@tracker/shared';
import { attachFolders } from '../../files/allowedPath';
import { checkLocalFile, readLocalBytes, type LocalFile } from '../../files/localFile';
import { fittedAnswer } from './askOutcome';

export type UploadImage = (
  file: Blob,
  name: string,
  signal: AbortSignal,
) => Promise<Pick<Attachment, 'id'>>;

export interface AnswerImageDeps {
  upload: UploadImage;
  // The project folder Claude ran in: a relative path in a card is read from there.
  cwd: string;
  describe: (error: unknown) => string;
}

const notAPicture = (name: string) => new Error(`${name} isn't a PNG, JPEG, GIF or WebP picture.`);

// Ask and Plan change nothing, so they make no picture in a temp folder; only Edit and Auto may.
const foldersFor = (cwd: string, mode: unknown) =>
  changesFolder(mode) ? attachFolders(cwd) : [cwd];

// The bytes decide, not the name: an answer could name any file x.png (PT-225 review).
async function pictureOf(file: LocalFile): Promise<Blob> {
  const bytes = await readLocalBytes(file);
  const type = sniffImageType(bytes);
  if (!type || !CHAT_ANSWER_IMAGE_TYPES.includes(type)) throw notAPicture(file.name);
  return new Blob([bytes], { type });
}

// The rules of attach_file: only allowed folders, never a dot-folder, and the very file that was
// checked. The tracker strips the picture's metadata as it stores it.
async function uploadOne(deps: AnswerImageDeps, path: string, mode: unknown, stop: AbortSignal) {
  const file = await checkLocalFile(resolve(deps.cwd, path), foldersFor(deps.cwd, mode));
  try {
    if (!CHAT_ANSWER_IMAGE_TYPES.includes(file.mimeType)) throw notAPicture(file.name);
    return (await deps.upload(await pictureOf(file), file.name, stop)).id;
  } finally {
    await file.handle.close();
  }
}

// One at a time, so only one picture is held in memory. A picture that can't go up gets a note
// in the answer instead, since the answer itself is still worth having.
export async function withAnswerImages(
  deps: AnswerImageDeps,
  outcome: FinishRunInput,
  stop: AbortSignal,
  mode: unknown,
): Promise<FinishRunInput> {
  if (outcome.status !== 'done' || !outcome.answer) return outcome;
  const attachmentIds: string[] = [];
  const notes: string[] = [];
  for (const path of answerImagePaths(outcome.answer)) {
    if (stop.aborted) return { status: 'cancelled' };
    try {
      attachmentIds.push(await uploadOne(deps, path, mode, stop));
    } catch (error) {
      if (stop.aborted) return { status: 'cancelled' };
      notes.push(`Couldn't show ${path}. ${deps.describe(error)}`);
    }
  }
  const answer =
    notes.length > 0 ? fittedAnswer(`${outcome.answer}\n\n${notes.join('\n')}`) : outcome.answer;
  return attachmentIds.length > 0 ? { ...outcome, answer, attachmentIds } : { ...outcome, answer };
}
