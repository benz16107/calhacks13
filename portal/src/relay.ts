// The GurtOS relay (relay/): a computer's own https address, push to phones, and the meeting place for pairing and
// Quick Start, and the hosted web app (relay/app) that pairs a phone through it. A self-hosted relay and web app change
// these two lines (docs/self-host.md).
import { useEffect, useState } from 'preact/hooks';

export const RELAY = 'https://box.gurtos.com';
export const APP = 'https://app.gurtos.com';
export const RELAY_HOST = new URL(RELAY).host;
export const APP_HOST = new URL(APP).hostname;
/** A computer's address on the relay: rosa.box.gurtos.com. */
export const onRelay = (host: string) => host.endsWith(`.${RELAY_HOST}`) && /^[a-z0-9-]{3,30}$/.test(host.slice(0, -RELAY_HOST.length - 1));
export const SELF_HOST_DOCS = 'https://gurtos.com/docs/guides/self-host/';

let probe: { at: number; up: Promise<boolean> } | undefined;
/** Whether the relay answers, asked at most once a minute and given 5 s. */
export function relayUp() {
  if (!probe || Date.now() - probe.at > 60_000)
    probe = { at: Date.now(), up: fetch(`${RELAY}/v1/status`, { cache: 'no-store', signal: AbortSignal.timeout(5000) }).then((r) => r.ok, () => false) };
  return probe.up;
}
/** undefined while asking (or when `ask` is false). */
export function useRelayUp(ask = true) {
  const [up, setUp] = useState<boolean>();
  useEffect(() => void (ask && relayUp().then(setUp)), [ask]);
  return up;
}

/** What POST /api/pair/start returns. */
export interface PairCode {
  code: string;
  url: string;
  /** This computer's own pairing page (BOX_URL, or its https address with remote access on). */
  boxUrl?: string;
  expiresAt: string;
}
/**
 * The link in a pairing QR. The hosted app's link (`url`) helps only with remote access on (`?box=`), or during setup
 * with the relay answering (`rv=`, pair over the internet). Otherwise the phone opens this computer's own pairing
 * page on the home network (`boxUrl`), which needs no service of ours. undefined while the relay check runs.
 * `here`: this page's origin, for an older core that returns only a code.
 */
export function pairLink(c: PairCode, relayUp: boolean | undefined, here?: string): string | undefined {
  const meet = /[#&]rv=/.test(c.url);
  if (meet && relayUp === undefined) return undefined;
  // The hosted app reaches only computers on its own relay: one on an owner's own relay pairs on its own page.
  const named = c.url.match(/[?&]box=([^&#]+)/)?.[1];
  if ((named && onRelay(decodeURIComponent(named))) || (meet && relayUp)) return c.url;
  if (c.boxUrl) return c.boxUrl;
  if (meet) return undefined; // the relay is down and this computer has no address of its own: no QR that cannot work
  if (/^https?:/.test(c.url) && !named) return c.url;
  return here && `${here}/#pair/${c.code}`;
}
/** Where the phone has to be for a pairing link to work. */
export const pairNote = (link: string) =>
  /[#&]rv=|[?&]box=/.test(link) ? "Your phone doesn't need to be on the same Wi-Fi." : 'Your phone needs to be on the same Wi-Fi or network as this computer.';

/** Whether an error says the relay didn't answer: the box's "fetch failed" or "the relay answered 502", or ours. */
export const relayDown = (message: string) => /fetch failed|relay answered 5|can't reach the relay|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timed? ?out|aborted|isn't answering/i.test(message);
