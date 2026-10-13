import type { Emphasis, MarkToken, Token } from './tokens';
import type { Inline } from './types';

// Deeper emphasis shows its marks as text, so no answer builds a page thousands of elements deep.
export const MAX_INLINE_DEPTH = 8;

interface Frame {
  children: Inline[];
  // The marks shown as text when this emphasis is too deep to be one.
  literal: string | null;
}

function appendText(children: Inline[], text: string): void {
  if (!text) return;
  const last = children.at(-1);
  if (last?.kind === 'text') last.text += text;
  else children.push({ kind: 'text', text });
}

class Builder {
  readonly root: Inline[] = [];
  private readonly frames: Frame[] = [{ children: this.root, literal: null }];
  private depth = 0;

  private get top(): Frame {
    return this.frames.at(-1)!;
  }

  text(text: string): void {
    appendText(this.top.children, text);
  }

  atom(inline: Inline): void {
    this.top.children.push(inline);
  }

  open(kind: Emphasis, mark: string): void {
    const literal = kind === 'strong' ? mark.repeat(2) : mark;
    if (this.depth >= MAX_INLINE_DEPTH) {
      this.text(literal);
      this.frames.push({ children: this.top.children, literal });
      return;
    }
    const node: Inline = { kind, children: [] };
    this.top.children.push(node);
    this.frames.push({ children: node.children, literal: null });
    this.depth += 1;
  }

  close(): void {
    const frame = this.frames.pop()!;
    if (frame.literal === null) this.depth -= 1;
    else this.text(frame.literal);
  }

  mark(token: MarkToken): void {
    token.closes.forEach(() => this.close());
    this.text(token.char.repeat(token.left));
    for (let i = token.opens.length - 1; i >= 0; i -= 1) this.open(token.opens[i]!, token.char);
  }
}

// Matched marks nest properly, so each close ends the newest open emphasis.
export function buildInline(tokens: readonly Token[]): Inline[] {
  const builder = new Builder();
  for (const token of tokens) {
    if (token.kind === 'text') builder.text(token.text);
    else if (token.kind === 'atom') builder.atom(token.inline);
    else builder.mark(token);
  }
  return builder.root;
}
