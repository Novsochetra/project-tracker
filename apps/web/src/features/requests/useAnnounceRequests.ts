import type { RunRequest } from '@tracker/shared';
import { useEffect } from 'react';
import { announce } from '../../app/announce';
import { announcementOf } from './requestText';
import { toAnnounce } from './toAnnounce';

const announced = new Set<string>();

// A request needs the person, unlike a step, so it is read out politely when it comes.
export function useAnnounceRequests(requests: readonly RunRequest[], now: number): void {
  useEffect(() => {
    const fresh = toAnnounce(requests, now, announced);
    fresh.forEach(({ id }) => announced.add(id));
    if (fresh.length > 0) announce(fresh.map(announcementOf).join('. '));
  }, [requests, now]);
}
