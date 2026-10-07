import { describe, expect, it } from 'vitest';
import { formatTicketKey, parseTicketKey } from '../src/logic/ticketKey';

describe('formatTicketKey', () => {
  it('joins the project key and the number with a dash', () => {
    expect(formatTicketKey('MOB', 3)).toBe('MOB-3');
  });

  it('keeps project keys that end in a digit', () => {
    expect(formatTicketKey('MOB2', 3)).toBe('MOB2-3');
  });
});

describe('parseTicketKey', () => {
  it('splits a key into the project key and the number', () => {
    expect(parseTicketKey('MOB-3')).toEqual({ projectKey: 'MOB', num: 3 });
  });

  it('uppercases the project key', () => {
    expect(parseTicketKey('mob-3')).toEqual({ projectKey: 'MOB', num: 3 });
    expect(parseTicketKey('Mob-3')).toEqual({ projectKey: 'MOB', num: 3 });
  });

  it('ignores surrounding whitespace', () => {
    expect(parseTicketKey('  MOB-3 \n')).toEqual({ projectKey: 'MOB', num: 3 });
  });

  it('reads project keys that contain digits', () => {
    expect(parseTicketKey('MOB2-3')).toEqual({ projectKey: 'MOB2', num: 3 });
    expect(parseTicketKey('2048-15')).toEqual({ projectKey: '2048', num: 15 });
  });

  it('reads multi-digit numbers', () => {
    expect(parseTicketKey('WEB-1024')).toEqual({ projectKey: 'WEB', num: 1024 });
  });

  it('reads leading zeros as the plain number', () => {
    expect(parseTicketKey('MOB-007')).toEqual({ projectKey: 'MOB', num: 7 });
  });

  it('round-trips with formatTicketKey', () => {
    expect(parseTicketKey(formatTicketKey('ABCD2', 41))).toEqual({ projectKey: 'ABCD2', num: 41 });
  });

  it('rejects ticket number 0', () => {
    expect(parseTicketKey('MOB-0')).toBeNull();
    expect(parseTicketKey('MOB-000')).toBeNull();
  });

  it('rejects more than one dash, because project keys never contain one', () => {
    expect(parseTicketKey('MOB-2-3')).toBeNull();
    expect(parseTicketKey('MOB--3')).toBeNull();
  });

  it.each([
    '',
    '   ',
    'MOB',
    'MOB-',
    '-3',
    '3',
    'MOB 3',
    'MOB - 3',
    'MOB -3',
    'MO B-3',
    'MOB_3',
    'MOB-x',
    'MOB-3a',
    'MOB-3.5',
    'MOB-+3',
    'MÖB-3',
    'MOB-٣',
  ])('rejects %j', (input) => {
    expect(parseTicketKey(input)).toBeNull();
  });
});
