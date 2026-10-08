import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { markRead, markWritten, writesBefore } from './freshReads';

describe('fresh reads after a write', () => {
  it('reads a ticket as usual until it is written', () => {
    expect(writesBefore(new QueryClient(), 'MOB-1')).toBeUndefined();
  });

  it('reads a written ticket fresh until a fresh read lands', () => {
    const queryClient = new QueryClient();
    markWritten(queryClient, 'MOB-1');
    const writes = writesBefore(queryClient, 'MOB-1');
    expect(writes).toBe(1);
    expect(writesBefore(queryClient, 'MOB-2')).toBeUndefined();
    markRead(queryClient, 'MOB-1', writes ?? 0);
    expect(writesBefore(queryClient, 'MOB-1')).toBeUndefined();
  });

  it('keeps reading fresh when another write settled while the read was on its way', () => {
    const queryClient = new QueryClient();
    markWritten(queryClient, 'MOB-1');
    const writes = writesBefore(queryClient, 'MOB-1') ?? 0;
    markWritten(queryClient, 'MOB-1');
    markRead(queryClient, 'MOB-1', writes);
    expect(writesBefore(queryClient, 'MOB-1')).toBe(2);
  });

  it('keeps each query client to itself', () => {
    const written = new QueryClient();
    markWritten(written, 'MOB-1');
    expect(writesBefore(new QueryClient(), 'MOB-1')).toBeUndefined();
  });
});
