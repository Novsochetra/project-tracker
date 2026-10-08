import { describe, expect, it } from 'vitest';
import { clipTitle } from './clipTitle';

describe('clipTitle', () => {
  it('leaves text that fits alone', () => {
    expect(clipTitle('Fix login', 24)).toBe('Fix login');
    expect(clipTitle('x'.repeat(24), 24)).toBe('x'.repeat(24));
  });

  it('ends longer text in an ellipsis, within the width', () => {
    expect(clipTitle('x'.repeat(300), 24)).toBe(`${'x'.repeat(23)}…`);
    expect(clipTitle('Fix the login button on the iPad', 24)).toBe('Fix the login button on…');
  });

  it('drops a space before the ellipsis', () => {
    expect(clipTitle(`${'a'.repeat(22)} bcd`, 24)).toBe(`${'a'.repeat(22)}…`);
  });

  it('counts Chinese, Japanese and Korean characters and emoji as two letters wide', () => {
    expect(clipTitle('修复横屏时个人资料页面崩溃的问题并添加测试用例', 24)).toBe(
      '修复横屏时个人资料页面…',
    );
    expect(clipTitle('ログイン画面のボタンが押せない問題を直す', 24)).toBe(
      'ログイン画面のボタンが…',
    );
    expect(clipTitle(`${'a'.repeat(20)}😀😀😀`, 24)).toBe(`${'a'.repeat(20)}😀…`);
  });
});
