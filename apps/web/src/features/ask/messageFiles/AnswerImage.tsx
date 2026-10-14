import type { Attachment } from '@tracker/shared';
import { FileImage } from 'lucide-react';
import { use, useState } from 'react';
import { Icon } from '../../../components';
import { OpeningMark } from '../../attachments/OpeningMark';
import { AttachmentViewerContext, ViewerOpeningContext } from '../../attachments/viewerContext';
import styles from './MessageAttachments.module.css';

export interface AnswerImageProps {
  image: Attachment;
  label: string;
  onOpen: () => void;
}

// The picture at the answer's width, so a screenshot or a diagram reads without a tap; a tap
// opens it full size in the image viewer.
export function AnswerImage({ image, label, onOpen }: AnswerImageProps) {
  const viewer = use(AttachmentViewerContext);
  const opening = use(ViewerOpeningContext) === image.id;
  const [failed, setFailed] = useState(false);
  return (
    <button
      type="button"
      className={styles.answerImage}
      aria-label={`Open ${label}`}
      onPointerDown={viewer?.prepare}
      onKeyDown={viewer?.prepare}
      onClick={onOpen}
    >
      {failed ? (
        <span className={styles.failed}>
          <Icon icon={FileImage} size={20} />
          {image.fileName}
        </span>
      ) : (
        <img
          src={image.url}
          alt=""
          width={image.width ?? undefined}
          height={image.height ?? undefined}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
        />
      )}
      {opening && <OpeningMark overIcon={false} />}
    </button>
  );
}
