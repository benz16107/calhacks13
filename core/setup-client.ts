// The calls an agent makes to set up a GurtOS computer from another one (AGENT-SETUP.md). The `gurtos` command and
// the MCP server's setup mode both use these, so they do the same thing. Every call goes to the box's own setup API,
// which runs the same code as the screen's wizard and logs each step.

export type Api = (method: string, path: string, body?: unknown) => Promise<any>;

/** Trade the code shown on the computer's screen for a setup token (it lasts until setup finishes, two hours at most). */
export async function connect(url: string, code: string, name = 'Setup agent'): Promise<{ token: string; box: { id: string; name: string } }> {
  const r = await fetch(`${url.replace(/\/$/, '')}/api/pair`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: code.trim(), name, kind: 'setup' }) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`);
  return data;
}

export function client(url: string, token: string): Api {
  return async (method, path, body) => {
    const r = await fetch(`${url.replace(/\/$/, '')}/api${path}`, { method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await r.json().catch(() => undefined);
    if (!r.ok) throw new Error(data?.error ?? `HTTP ${r.status}`);
    return data;
  };
}

/** One entry per setup step: what the CLI's subcommands and the MCP tools call. */
export const steps = {
  status: (api: Api) => api('GET', '/setup'),
  owner: (api: Api, user: string) => api('PUT', '/owner', { user }),
  setKey: (api: Api, name: string, value: string) => api('PUT', `/vault/${encodeURIComponent(name)}`, { value }),
  keys: (api: Api) => api('GET', '/vault'), // names and when each was set; never a value
  folders: (api: Api, folders: string[]) => api('PATCH', '/settings', { agentFolders: folders }),
  settings: (api: Api, patch: Record<string, unknown>) => api('PATCH', '/settings', patch),
  apps: (api: Api) => api('GET', '/apps?all=1'),
  app: (api: Api, id: string, on: boolean) => api('POST', `/apps/${encodeURIComponent(id)}/${on ? 'enable' : 'disable'}`),
  remote: (api: Api, name?: string) => api('POST', '/remote', name ? { name } : {}),
  pair: (api: Api) => api('POST', '/pair/start', { owner: true }), // the owner's phone
  step: (api: Api, id: string) => api('POST', '/setup/step', { id }),
  doctor: (api: Api) => api('GET', '/setup/doctor'),
  finish: (api: Api) => api('POST', '/setup/finish'),
};
