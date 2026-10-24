// Pieces the tasks page and the bulk roll back share: state labels, money, and the report of what came back.
import React from 'react';
import { DynamicTable, Link, Lozenge, SectionMessage, Stack, Text } from '@forge/react';

export const dollars = (cents) => `$${((cents ?? 0) / 100).toFixed(2)}`;
const LOOK = { queued: 'new', running: 'inprogress', waiting: 'moved', done: 'success', failed: 'removed', undone: 'default' };
const WORDS = { queued: 'Queued', running: 'Running', waiting: 'Waiting for an OK', done: 'Done', failed: 'Failed', undone: 'Rolled back' };
export const State = ({ state }) => <Lozenge appearance={LOOK[state] ?? 'default'}>{WORDS[state] ?? state ?? 'Unknown'}</Lozenge>;
export const IssueLink = ({ issue }) => (issue ? <Link href={`/browse/${issue}`}>{issue}</Link> : <Text>none</Text>);

/** One row per issue: what the box said it did, or why it was skipped. */
export const Report = ({ results }) => {
  const done = results.filter((r) => r.ok).length;
  return (
    <Stack space="space.200">
      <SectionMessage appearance={done === results.length ? 'success' : 'warning'} title={`${done} of ${results.length} rolled back`}>
        <Text>This is what the box reported for each task. Each roll back is in the box's log with your name.</Text>
      </SectionMessage>
      <DynamicTable
        head={{ cells: [{ key: 'i', content: 'Issue' }, { key: 't', content: 'Task' }, { key: 'r', content: 'Result' }, { key: 'f', content: 'Files restored' }] }}
        rows={results.map((r, n) => ({
          key: `${r.issue ?? r.task}-${n}`,
          cells: [
            { key: 'i', content: <IssueLink issue={r.issue} /> },
            { key: 't', content: r.title ?? r.task ?? '' },
            { key: 'r', content: r.ok ? (r.alreadyUndone ? 'Already rolled back' : 'Rolled back') : `Not rolled back: ${r.error ?? 'no reason given'}` },
            { key: 'f', content: (r.changes ?? []).map((c) => `${c.path} (${c.change})`).join(', ') || 'none' },
          ],
        }))}
      />
    </Stack>
  );
};
