import { attachmentKind, type Attachment, type ChatRole } from '@tracker/shared';
import { ThumbnailGrid } from '../../attachments/ThumbnailGrid';
import { readableFiles } from '../../attachments/readableFiles';
import { thumbnailLabels } from '../../attachments/thumbnailLabels';
import { useAttachmentViewer } from '../../attachments/viewerContext';
import { AnswerImage } from './AnswerImage';
import styles from './MessageAttachments.module.css';
import { WithheldNote } from './WithheldNote';

type Open = (files: readonly Attachment[], index: number) => void;

const isImage = (file: Attachment) => attachmentKind(file.mimeType) === 'image';

// Claude's pictures show large, under its words; any other file as a tile below them.
function AnswerFiles({ files, open }: { files: Attachment[]; open: Open }) {
  const labels = thumbnailLabels(files);
  const others = files.filter((file) => !isImage(file));
  return (
    <div className={styles.answerFiles}>
      {files.map((file, index) =>
        isImage(file) ? (
          <AnswerImage
            key={file.id}
            image={file}
            label={labels[index] ?? file.fileName}
            onOpen={() => open(files, index)}
          />
        ) : null,
      )}
      {others.length > 0 && (
        <ThumbnailGrid size="sm" attachments={others} onOpen={(index) => open(others, index)} />
      )}
    </div>
  );
}

function Files({ files, from }: { files: Attachment[]; from: ChatRole }) {
  const { open } = useAttachmentViewer();
  if (from === 'claude') return <AnswerFiles files={files} open={open} />;
  return (
    <>
      <ThumbnailGrid
        size="sm"
        attachments={files}
        onOpen={(index) => open(files, index)}
        className={styles.sent}
      />
      <WithheldNote files={files} />
    </>
  );
}

// The files of a chat message, either way: the person's sent with a question, Claude's pictures in
// its answer (PT-225). An older tracker sends no list. Only a message with files needs the viewers'
// provider (the Shell's), so a chat shown without one still works.
export function MessageAttachments({
  attachments,
  from,
}: {
  attachments: Attachment[] | undefined;
  from: ChatRole;
}) {
  const files = readableFiles(attachments);
  return files.length > 0 ? <Files files={files} from={from} /> : null;
}
