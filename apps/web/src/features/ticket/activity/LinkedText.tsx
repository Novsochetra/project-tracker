import { Fragment } from 'react';
import { linkParts } from '../../../lib/linkify';
import { textRuns } from '../../../lib/textRuns';

// The text is rendered as text nodes and anchors only, so nothing people or agents write becomes
// markup. Very long text goes out as several text nodes, which WebKit wraps (lib/textRuns).
export function LinkedText({ text }: { text: string }) {
  return linkParts(text).map((part, index) =>
    part.kind === 'link' ? (
      <a key={index} href={part.href} target="_blank" rel="noopener noreferrer">
        {textRuns(part.text)}
      </a>
    ) : (
      <Fragment key={index}>{textRuns(part.text)}</Fragment>
    ),
  );
}
