import { Fragment } from 'react';
import { linkParts } from '../../../lib/linkify';

// The text is rendered as text nodes and anchors only, so nothing people or agents write becomes
// markup.
export function LinkedText({ text }: { text: string }) {
  return linkParts(text).map((part, index) =>
    part.kind === 'link' ? (
      <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">
        {part.text}
      </a>
    ) : (
      <Fragment key={index}>{part.text}</Fragment>
    ),
  );
}
