const BLANK_LINE = /\n[ \t]*\r?\n/;

const isComment = (token) => token.type === 'Line' || token.type === 'Block';

// A comment that ends the previous statement's line stays on that line when the blank line goes in.
function lastOnLine(sourceCode, node) {
  let last = node;
  let next = sourceCode.getTokenAfter(last, { includeComments: true });

  while (next && isComment(next) && next.loc.start.line === last.loc.end.line) {
    last = next;
    next = sourceCode.getTokenAfter(last, { includeComments: true });
  }

  return last;
}

export default {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: { description: 'Require a blank line before the return that ends a function body' },
    messages: {
      blankLine:
        'Put a blank line before the final return (docs/coding-style.md), unless it is the only ' +
        'statement of the function.',
    },
    schema: [],
  },
  create(context) {
    const { sourceCode } = context;

    function check(fn) {
      const statements = fn.body.type === 'BlockStatement' ? fn.body.body : [];
      const last = statements.at(-1);
      if (statements.length < 2 || last.type !== 'ReturnStatement') return;

      const previous = statements.at(-2);
      const between = sourceCode.text.slice(previous.range[1], last.range[0]);
      if (BLANK_LINE.test(between)) return;

      context.report({
        node: last,
        messageId: 'blankLine',
        fix: (fixer) => fixer.insertTextAfter(lastOnLine(sourceCode, previous), '\n'),
      });
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
};
