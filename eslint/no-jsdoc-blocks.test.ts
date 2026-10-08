import { RuleTester, type Rule } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import noJsdocBlocks from './no-jsdoc-blocks.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

// The rule is plain JavaScript, so TypeScript widens its meta.type to a string.
ruleTester.run('no-jsdoc-blocks', noJsdocBlocks as Rule.RuleModule, {
  valid: [
    '// Agents read this, so the person is "User".\nconst label = "User";',
    '/* eslint-disable-next-line no-console */\nconsole.log("ready");',
    "const pattern = '**/*.test.ts';",
    '/**/\nconst empty = 1;',
  ],
  invalid: [
    {
      code: '/** The ticket in full for an agent. */\nexport function ticketReply(): void {}',
      errors: [{ messageId: 'jsdocBlock', line: 1, column: 1 }],
    },
    {
      code: 'interface Options {\n  /**\n   * Bytes sent so far.\n   */\n  onProgress?: () => void;\n}',
      errors: [{ messageId: 'jsdocBlock', line: 2, endLine: 4 }],
    },
    {
      code: 'const a = 1; /** Trailing. */\n/** @deprecated */\nconst b = a;',
      errors: [
        { messageId: 'jsdocBlock', line: 1 },
        { messageId: 'jsdocBlock', line: 2 },
      ],
    },
  ],
});
