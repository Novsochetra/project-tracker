// A comment's value leaves out the opening `/*`, so a `/**` block's value starts with `*`.
const isJsdocBlock = (comment) => comment.type === 'Block' && comment.value.startsWith('*');

export default {
  meta: {
    type: 'suggestion',
    docs: { description: 'Disallow /** */ comments; CLAUDE.md allows only short // why-comments' },
    messages: {
      jsdocBlock:
        'No /** */ comments: CLAUDE.md only allows comments that explain why. Delete it (rename ' +
        'anything unclear instead), or keep the why as a short // comment.',
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (isJsdocBlock(comment)) context.report({ loc: comment.loc, messageId: 'jsdocBlock' });
        }
      },
    };
  },
};
