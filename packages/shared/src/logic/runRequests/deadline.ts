import { RUN_REQUEST_DEADLINE_MS } from '../../domain/runRequest';

export const requestExpiresAt = (createdAt: number): number => createdAt + RUN_REQUEST_DEADLINE_MS;

export const requestIsOverdue = (expiresAt: number, now: number): boolean => now >= expiresAt;
