import { resolve } from 'node:path';
import {
  answerImagePaths,
  CHAT_ANSWER_IMAGE_TYPES,
  type Attachment,
  type FinishRunInput,
} from '@tracker/shared';
import { attachFolders } from '../../files/allowedPath';
import { checkLocalFile, readLocalFile } from '../../files/localFile';
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

// The rules of attach_file: only the project folder or a temp folder, never a dot-folder, and the
// very file that was checked. The tracker strips the picture's metadata as it stores it.
async function uploadOne(deps: AnswerImageDeps, path: string, stop: AbortSignal) {
  const file = await checkLocalFile(resolve(deps.cwd, path), attachFolders(deps.cwd));
  try {
    if (!CHAT_ANSWER_IMAGE_TYPES.includes(file.mimeType)) throw notAPicture(file.name);
    return (await deps.upload(await readLocalFile(file), file.name, stop)).id;
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
): Promise<FinishRunInput> {
  if (outcome.status !== 'done' || !outcome.answer) return outcome;
  const attachmentIds: string[] = [];
  const notes: string[] = [];
  for (const path of answerImagePaths(outcome.answer)) {
    if (stop.aborted) return { status: 'cancelled' };
    try {
      attachmentIds.push(await uploadOne(deps, path, stop));
    } catch (error) {
      if (stop.aborted) return { status: 'cancelled' };
      notes.push(`Couldn't show ${path}. ${deps.describe(error)}`);
    }
  }
  const answer =
    notes.length > 0 ? fittedAnswer(`${outcome.answer}\n\n${notes.join('\n')}`) : outcome.answer;
  return attachmentIds.length > 0 ? { ...outcome, answer, attachmentIds } : { ...outcome, answer };
}
