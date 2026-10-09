import { describe, expect, it } from 'vitest';
import { firstLine, parseOwnerArgs } from '../../src/cli/ownerArgs';

describe('parseOwnerArgs', () => {
  it('takes the email in either form', () => {
    expect(parseOwnerArgs(['--email', 'me@example.com'])).toEqual({ email: 'me@example.com' });
    expect(parseOwnerArgs(['--email=me@example.com'])).toEqual({ email: 'me@example.com' });
  });

  it('asks for the email when it is missing', () => {
    for (const argv of [[], ['--email'], ['--email', '--help-me'], ['--email=']]) {
      expect(parseOwnerArgs(argv), argv.join(' ')).toEqual({
        error: 'Give the owner’s email with --email.',
      });
    }
  });

  it('never takes the password as an argument', () => {
    expect(parseOwnerArgs(['--email', 'a@b.co', '--password', 'x'])).toHaveProperty('error');
    expect(parseOwnerArgs(['--email', 'a@b.co', '--password=x'])).toHaveProperty('error');
  });

  it('shows help', () => {
    expect(parseOwnerArgs(['--help'])).toEqual({ help: true });
    expect(parseOwnerArgs(['-h'])).toEqual({ help: true });
  });
});

describe('firstLine', () => {
  it('keeps the first line of piped text, spaces included', () => {
    expect(firstLine(' pass word \nnext')).toBe(' pass word ');
    expect(firstLine('pass\r\n')).toBe('pass');
    expect(firstLine('')).toBe('');
  });
});
