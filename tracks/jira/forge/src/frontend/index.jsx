// The GurtOS agent task panel on a BOX issue: the task's live state, its pending approvals with Approve and Deny, its blocked
// attempts, a short audit trail, the files it changed, and Roll back. Everything comes from the resolver, which
// asks the box; this page holds no secret.
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Button, ButtonGroup, CodeBlock, DynamicTable, Heading, Inline, Lozenge, Modal, ModalBody, ModalFooter, ModalHeader,
  ModalTitle, ModalTransition, SectionMessage, Spinner, Stack, Text,
} from '@forge/react';
import { invoke } from '@forge/bridge';

const dollars = (cents) => `$${(cents / 100).toFixed(2)}`;
const time = (at) => new Date(at).toLocaleTimeString([], { hour12: false });
const LOOK = { queued: 'new', running: 'inprogress', waiting: 'moved', done: 'success', failed: 'removed', undone: 'default' };
const WORDS = { queued: 'Queued', running: 'Running', waiting: 'Waiting for an OK', done: 'Done', failed: 'Failed', undone: 'Rolled back' };

const App = () => {
  const [data, setData] = useState();
  const [error, setError] = useState();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const load = () => invoke('load').then((d) => (setData(d), setError(undefined)), (e) => setError(e.message));
  useEffect(() => {
    load();
    const timer = setInterval(load, 4000); // approvals and steps arrive while the panel is open
    return () => clearInterval(timer);
  }, []);
  const act = async (name, payload) => {
    setBusy(true);
    try {
      await invoke(name, payload);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  if (!data) return error ? <SectionMessage appearance="error" title="Could not reach the box"><Text>{error}</Text></SectionMessage> : <Spinner label="Loading the task" />;
  if (data.none) return <Text>This issue is not a GurtOS task.</Text>;
  const { task, pending, blocked, audit, changes, diff, reasoning, canAct } = data;

  return (
    <Stack space="space.200">
      {error && <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage>}
      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Lozenge appearance={LOOK[task.state]} isBold>{WORDS[task.state]}</Lozenge>
        <Text>
          Spent {dollars(task.costCents)}{task.budgetCents ? ` of a ${dollars(task.budgetCents)} budget` : ', with no budget'}. Worker {task.worker}, workspace {task.workspace}, task {task.id}.
        </Text>
      </Inline>

      {pending.map((a) => (
        <SectionMessage key={a.id} appearance="warning" title="The agent is waiting for your OK">
          <Stack space="space.100">
            <Text>{a.question}</Text>
            {canAct ? (
              <ButtonGroup label="Answer the agent">
                <Button appearance="primary" isDisabled={busy} onClick={() => act('answer', { approval: a.id, approved: true })}>Approve</Button>
                <Button isDisabled={busy} onClick={() => act('answer', { approval: a.id, approved: false })}>Deny</Button>
              </ButtonGroup>
            ) : <Text>Only people who can edit this issue can answer.</Text>}
          </Stack>
        </SectionMessage>
      ))}

      {blocked.length > 0 && (
        <SectionMessage appearance="error" title={`Blocked ${blocked.length === 1 ? 'attempt' : 'attempts'}`}>
          {blocked.map((b, i) => <Text key={i}>{time(b.at)}: tried to reach {b.host}. The box refused the connection.</Text>)}
        </SectionMessage>
      )}

      {reasoning && (
        <Stack space="space.050">
          <Heading size="xsmall">The agent's reasoning</Heading>
          <Text>{reasoning}</Text>
        </Stack>
      )}

      <Heading size="xsmall">Audit trail, newest first</Heading>
      <DynamicTable
        head={{ cells: [{ key: 'at', content: 'Time' }, { key: 'what', content: 'What happened' }] }}
        rows={audit.map((l, i) => ({ key: String(i), cells: [{ key: 'at', content: time(l.at) }, { key: 'what', content: l.text }] })).reverse()}
        rowsPerPage={10}
      />

      <Heading size="xsmall">Files changed</Heading>
      {changes.length ? (
        <Stack space="space.100">
          <Text>{changes.map((c) => `${c.path} (${c.change})`).join(', ')}{task.state === 'undone' ? '. Rolled back: these changes are no longer in the workspace.' : ''}</Text>
          <CodeBlock language="diff" text={diff} />
        </Stack>
      ) : <Text>No file changes.</Text>}

      {canAct && task.state !== 'undone' && (
        <Inline>
          <Button appearance="danger" iconBefore="undo" isDisabled={busy} onClick={() => setConfirming(true)}>Roll back this task</Button>
        </Inline>
      )}
      <ModalTransition>
        {confirming && (
          <Modal onClose={() => setConfirming(false)}>
            <ModalHeader><ModalTitle appearance="danger">Roll back this task?</ModalTitle></ModalHeader>
            <ModalBody>
              <Text>This stops the task if it is still going and removes only its file changes. Other tasks keep theirs. The roll back goes into the box's log with your name.</Text>
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button appearance="danger" isDisabled={busy} onClick={() => act('rollback')}>Roll back</Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
