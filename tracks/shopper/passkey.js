// Approve with Face ID, in the browser. A plain ES module served as-is at /t/shopper/passkey.js (no build step).
// Pass a `fetch` that already carries the pairing token; it defaults to window.fetch.

// A browser never makes a passkey for an IP address (Chromium: "This is an invalid domain"), even on a secure page.
const onIp = () => /^\d+\.\d+\.\d+\.\d+$/.test(location.hostname) || location.hostname.startsWith('[');
export const supported = () => !!window.PublicKeyCredential && window.isSecureContext && !onIp();

const toBuf = (s) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer;
};
const toB64 = (buf) => {
  let bin = '';
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

function check() {
  if (!window.isSecureContext) throw new Error('This page is not on HTTPS, so Face ID is off here. Approve with a tap instead.');
  if (onIp()) throw new Error("Face ID needs the box's web address, not an IP address. Approve with a tap instead.");
  if (!window.PublicKeyCredential) throw new Error('This browser cannot use passkeys. Approve with a tap instead.');
}

/** Plain words for what the browser throws. */
function plain(e) {
  const by = {
    NotAllowedError: 'Face ID was cancelled, or it timed out.',
    AbortError: 'Face ID was cancelled.',
    InvalidStateError: 'This device already has a passkey for this box.',
    SecurityError: 'This page is not on HTTPS, so Face ID is off here. Approve with a tap instead.',
    NotSupportedError: 'This device cannot make a passkey.',
  };
  return new Error(by[e?.name] ?? e?.message ?? String(e));
}

async function post(f, url, body) {
  const r = await f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `The box answered ${r.status}.`);
  return j;
}

const ids = (list) => (list ?? []).map((c) => ({ ...c, id: toBuf(c.id) }));

/** Set up a passkey on this device. `existing: true` when one is already set up: it signs with that one first. */
export async function enroll(deviceName, { fetch: f = fetch, base = '/t/shopper', existing = false } = {}) {
  check();
  const proof = existing ? await sign('enroll', deviceName, { fetch: f, base }) : undefined;
  const o = await post(f, `${base}/passkey/register/options`, { device: deviceName, ...(proof && { proof }) });
  let c;
  try {
    c = await navigator.credentials.create({
      publicKey: { ...o, challenge: toBuf(o.challenge), user: { ...o.user, id: toBuf(o.user.id) }, excludeCredentials: ids(o.excludeCredentials) },
    });
  } catch (e) {
    throw plain(e);
  }
  if (!c) throw new Error('Face ID was cancelled.');
  const response = {
    id: c.id, rawId: toB64(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment ?? undefined,
    clientExtensionResults: c.getClientExtensionResults(),
    response: { clientDataJSON: toB64(c.response.clientDataJSON), attestationObject: toB64(c.response.attestationObject), transports: c.response.getTransports?.() ?? [] },
  };
  return post(f, `${base}/passkey/register`, { device: deviceName, response });
}

/** Sign `purpose` + `subject` with Face ID. The box decides what the signature covers. Returns the assertion to send along. */
export async function sign(purpose, subject, { fetch: f = fetch, base = '/t/shopper', payload } = {}) {
  check();
  const o = await post(f, `${base}/passkey/options`, { purpose, subject, ...(payload !== undefined && { payload }) });
  let c;
  try {
    c = await navigator.credentials.get({ publicKey: { ...o, challenge: toBuf(o.challenge), allowCredentials: ids(o.allowCredentials) } });
  } catch (e) {
    throw plain(e);
  }
  if (!c) throw new Error('Face ID was cancelled.');
  const r = c.response;
  return {
    id: c.id, rawId: toB64(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment ?? undefined,
    clientExtensionResults: c.getClientExtensionResults(),
    response: {
      clientDataJSON: toB64(r.clientDataJSON), authenticatorData: toB64(r.authenticatorData), signature: toB64(r.signature),
      ...(r.userHandle && { userHandle: toB64(r.userHandle) }),
    },
  };
}

/** Approve one approval with Face ID. Returns the box's answer. */
export async function approve(approvalId, opts = {}) {
  const { fetch: f = fetch, base = '/t/shopper' } = opts;
  const assertion = await sign('approval', approvalId, opts);
  return post(f, `${base}/passkey/approve`, { approval: approvalId, assertion });
}

/** Save spending rules, signed with Face ID (the box asks for it once a passkey is set up). Returns the saved rules. */
export async function saveRules(rules, opts = {}) {
  const { fetch: f = fetch, base = '/t/shopper' } = opts;
  const assertion = await sign('rules', 'rules', { ...opts, payload: rules });
  return post(f, `${base}/rules`, { rules, assertion });
}
