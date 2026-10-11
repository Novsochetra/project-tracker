import { isLoopbackHost } from '@tracker/shared';
import { isLocalTracker } from './connectCommand';

// The CLI sends a token over plain http only to this computer (PT-132), so a tracker opened at a
// plain-http LAN address (HOST=0.0.0.0) is set up through localhost, which works on its own computer.
export function agentAddress(address: string): string {
  const url = URL.canParse(address) ? new URL(address) : null;
  if (url?.protocol !== 'http:' || isLoopbackHost(url.hostname)) return address;
  url.hostname = 'localhost';
  return url.origin;
}

export function addressNote(address: string, agentUrl: string): string {
  if (agentUrl !== address) {
    return 'Agents on the tracker’s computer reach it here. On other computers they need its https address: plain http would show their token to the network.';
  }
  return isLocalTracker(address)
    ? 'Agents on this computer reach the tracker here.'
    : 'Agents reach the tracker here, from any computer.';
}
