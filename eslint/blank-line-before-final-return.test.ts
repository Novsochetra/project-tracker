import { RuleTester, type Rule } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import blankLineBeforeFinalReturn from './blank-line-before-final-return.js';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

// The rule is plain JavaScript, so TypeScript widens its meta.type to a string.
ruleTester.run('blank-line-before-final-return', blankLineBeforeFinalReturn as Rule.RuleModule, {
  valid: [
    'function only() {\n  return 1;\n}',
    'function spaced() {\n  const a = 1;\n\n  return a;\n}',
    'const arrow = () => {\n  const a = 1;\n\n  // Why it returns a.\n  return a;\n};',
    'const expression = (a: number) => a + 1;',
    'function nested(a: boolean) {\n  if (a) {\n    log();\n    return 1;\n  }\n\n  return 2;\n}',
    'function noReturn() {\n  const a = 1;\n  log(a);\n}',
  ],
  invalid: [
    {
      code: 'function packed() {\n  const a = 1;\n  return a;\n}',
      output: 'function packed() {\n  const a = 1;\n\n  return a;\n}',
      errors: [{ messageId: 'blankLine', line: 3 }],
    },
    {
      code: 'const methods = {\n  run() {\n    log();\n    return true;\n  },\n};',
      output: 'const methods = {\n  run() {\n    log();\n\n    return true;\n  },\n};',
      errors: [{ messageId: 'blankLine', line: 4 }],
    },
    {
      code: 'const kept = () => {\n  log(); // Why it logs.\n  // Why it returns.\n  return 1;\n};',
      output:
        'const kept = () => {\n  log(); // Why it logs.\n\n  // Why it returns.\n  return 1;\n};',
      errors: [{ messageId: 'blankLine', line: 4 }],
    },
  ],
});
