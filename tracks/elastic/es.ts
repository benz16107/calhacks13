// A small JSON client for Elasticsearch and Kibana.
/** A string body goes as NDJSON (_bulk). Throws on any status but 2xx, with the status on the error. */
export function client(base: string, apiKey: string) {
  return async <T = any>(method: string, p: string, body?: unknown): Promise<T> => {
    const ndjson = typeof body === 'string';
    const r = await fetch(base.replace(/\/$/, '') + p, {
      method,
      headers: { authorization: `ApiKey ${apiKey}`, 'content-type': ndjson ? 'application/x-ndjson' : 'application/json', 'kbn-xsrf': 'true', 'x-elastic-internal-origin': 'Kibana' },
      body: body === undefined || ndjson ? (body as string | undefined) : JSON.stringify(body),
    });
    const reply = await r.text();
    if (!r.ok) throw Object.assign(new Error(`${method} ${p}: ${r.status} ${reply.slice(0, 500)}`), { status: r.status });
    return (reply ? JSON.parse(reply) : {}) as T;
  };
}
export type Es = ReturnType<typeof client>;
