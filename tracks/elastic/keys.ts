// Which Elastic API key may do what. A key made by another API key cannot carry privileges, so these are made by a
// person in Kibana (Dev Tools: POST /_security/api_key) or through the signed-in session; `node tracks/elastic/agent.ts keys`
// prints the request bodies. Nothing here is a secret.
//
//   box key   one per box. Creates documents in box-actions and reads that box's own rows (and its requests). It cannot
//             update or delete anything, so what Elastic holds cannot be rewritten from the box, even by root.
//   ask keys  one per person. Reads box-actions through a filter that copies what that person's Business role may see,
//             calls the agent, and leaves requests. It cannot write to the log.
import { INDEX, REQUESTS } from './docs.ts';

export const KIBANA_APP = 'kibana-.kibana';

/** A Business person, as GET /api/people lists them. `role` is owner, admin, approver, requester or auditor. */
export interface Person { id: string; name: string; role: string }

const own = (machine: string) => JSON.stringify({ term: { 'box.machine': machine } });

export function boxKey(machine: string, label: string) {
  return {
    name: `gurtos-box-${label}`,
    role_descriptors: {
      box: {
        indices: [
          { names: [INDEX], privileges: ['create_doc'] },
          { names: [INDEX, REQUESTS], privileges: ['read'], query: own(machine) },
        ],
      },
    },
  };
}

/** What a person may read, in the same terms as Business: the owner, an admin and an auditor see the whole audit, an
 *  approver the requests routed to them or answered by them, a requester the tasks they asked for. */
export function filterFor(p: Person): object | undefined {
  if (['owner', 'admin', 'auditor'].includes(p.role)) return undefined;
  if (p.role === 'approver') {
    return { bool: { should: [{ term: { 'who.approver': p.id } }, { term: { 'approval.person': p.id } }, { term: { 'approval.route_people': p.id } }], minimum_should_match: 1 } };
  }
  return { term: { 'who.asked': p.id } }; // a requester
}

export function askKey(p: Person) {
  const query = filterFor(p);
  return {
    name: `gurtos-ask-${p.id}`,
    metadata: { gurtos_person: p.id, gurtos_role: p.role },
    role_descriptors: {
      ask: {
        indices: [
          { names: [INDEX], privileges: ['read'], ...(query ? { query: JSON.stringify(query) } : {}) },
          { names: [REQUESTS], privileges: ['create_doc'] }, // the agent's request tools write here; the box reads and asks its owner
        ],
        // The agent runs on Kibana's own model endpoint, which a key must be allowed to see: monitor_inference and actions.read.
        cluster: ['monitor_inference'],
        applications: [{ application: KIBANA_APP, privileges: ['feature_agentBuilder.read', 'feature_actions.read', 'feature_workflowsManagement.workflow_execute', 'feature_workflowsManagement.workflow_read'], resources: ['space:default'] }],
      },
    },
  };
}

/** The people of the demo Business box, and the owner of a Server box. */
export const PEOPLE: Person[] = [
  { id: 'owner', name: 'Owner', role: 'owner' },
  { id: 'rosa', name: 'Rosa Delgado', role: 'approver' },
  { id: 'sam', name: 'Sam Chen', role: 'requester' },
  { id: 'priya', name: 'Priya Nair', role: 'admin' },
  { id: 'owen', name: 'Owen Clarke', role: 'auditor' },
];
