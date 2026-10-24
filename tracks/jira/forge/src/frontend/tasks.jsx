// The "GurtOS agent tasks" project page: this project's agent tasks from the box's log, with a filter, Roll back
// selected (confirm, then a report of what came back) and, for Jira admins, Pause all / Resume all.
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Button, Checkbox, DynamicTable, Inline, Lozenge, Modal, ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition,
  SectionMessage, Select, Spinner, Stack, Text, Textfield,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { IssueLink, Report, State, dollars } from './shared';

const PERIODS = [{ label: 'Last day', value: 1 }, { label: 'Last 7 days', value: 7 }, { label: 'Last 30 days', value: 30 }, { label: 'Last 90 days', value: 90 }];

const App = () => {
  const [period, setPeriod] = useState(PERIODS[1]);
  const [q, setQ] = useState('');
  const [data, setData] = useState();
  const [error, setError] = useState();
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(); // 'rollback' | 'pause' | 'resume'
  const [report, setReport] = useState();

  const load = () => invoke('activity', { days: period.value, q }).then((d) => (setData(d), setError(undefined)), (e) => setError(e.message));
  useEffect(() => {
    load();
  }, [period]);

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
      setAsk(undefined);
    }
  };
  const rollback = () => run(async () => {
    setReport((await invoke('rollbackIssues', { issues: picked })).results);
    setPicked([]);
  });
  const pause = (paused) => run(() => invoke('pause', { paused }));
  const toggle = (key) => setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  if (!data) return error ? <SectionMessage appearance="error" title="Could not reach the box"><Text>{error}</Text></SectionMessage> : <Spinner label="Loading agent tasks" />;
  const { tasks, totals, paused, canPause } = data;
  const actionable = (t) => t.issue && t.state !== 'undone';

  return (
    <Stack space="space.200">
      {error && <SectionMessage appearance="error"><Text>{error}</Text></SectionMessage>}
      <Inline space="space.100" alignBlock="center" shouldWrap>
        <Lozenge appearance={paused ? 'moved' : 'success'} isBold>{paused ? 'Agents paused' : 'Agents running'}</Lozenge>
        {canPause && (
          <Button appearance={paused ? 'primary' : 'warning'} isDisabled={busy} onClick={() => setAsk(paused ? 'resume' : 'pause')}>
            {paused ? 'Resume all agents' : 'Pause all agents'}
          </Button>
        )}
        <Text>
          {totals.tasks} tasks: {totals.done} done, {totals.waiting} waiting for an OK, {totals.failed} failed, {totals.undone} rolled back. {totals.blocked} blocked attempts. Spent {dollars(totals.costCents)}.
        </Text>
      </Inline>

      <Inline space="space.100" alignBlock="end" shouldWrap>
        <Textfield placeholder="Words in the title or what started it" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select options={PERIODS} value={period} onChange={(o) => setPeriod(o)} />
        <Button isDisabled={busy} onClick={load}>Search</Button>
        <Button appearance="danger" iconBefore="undo" isDisabled={busy || !picked.length} onClick={() => setAsk('rollback')}>
          Roll back selected ({picked.length})
        </Button>
      </Inline>

      <DynamicTable
        head={{ cells: ['', 'Issue', 'Task', 'State', 'Started by', 'Cost', 'Blocked', 'Files'].map((c, i) => ({ key: String(i), content: c })) }}
        rows={tasks.map((t) => ({
          key: t.id,
          cells: [
            { key: '0', content: actionable(t) ? <Checkbox isChecked={picked.includes(t.issue)} onChange={() => toggle(t.issue)} label={t.issue} /> : '' },
            { key: '1', content: <IssueLink issue={t.issue} /> },
            { key: '2', content: t.title },
            { key: '3', content: <State state={t.state} /> },
            { key: '4', content: t.source },
            { key: '5', content: dollars(t.costCents) },
            { key: '6', content: t.blocked?.join(', ') || 'none' },
            { key: '7', content: String(t.changes ?? 0) },
          ],
        }))}
        rowsPerPage={20}
        emptyView="No agent tasks in this project for this period."
      />

      <ModalTransition>
        {ask && (
          <Modal onClose={() => setAsk(undefined)}>
            <ModalHeader>
              <ModalTitle appearance="warning">
                {ask === 'rollback' ? `Roll back ${picked.length} ${picked.length === 1 ? 'task' : 'tasks'}?` : ask === 'pause' ? 'Pause every agent?' : 'Resume every agent?'}
              </ModalTitle>
            </ModalHeader>
            <ModalBody>
              <Text>
                {ask === 'rollback'
                  ? `This stops each task if it is still going and removes only its file changes: ${picked.join(', ')}. Other tasks keep theirs. Issues you cannot edit are skipped.`
                  : ask === 'pause'
                    ? 'Every running agent on the box stops where it is, and no new task starts until you resume.'
                    : 'Paused agents carry on and new tasks start again.'}
              </Text>
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setAsk(undefined)}>Cancel</Button>
              <Button appearance="danger" isDisabled={busy} onClick={() => (ask === 'rollback' ? rollback() : pause(ask === 'pause'))}>
                {ask === 'rollback' ? 'Roll back' : ask === 'pause' ? 'Pause all' : 'Resume all'}
              </Button>
            </ModalFooter>
          </Modal>
        )}
        {report && (
          <Modal onClose={() => setReport(undefined)} width="large">
            <ModalHeader><ModalTitle>What came back</ModalTitle></ModalHeader>
            <ModalBody><Report results={report} /></ModalBody>
            <ModalFooter><Button onClick={() => setReport(undefined)}>Close</Button></ModalFooter>
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
