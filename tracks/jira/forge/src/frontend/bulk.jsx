// "Roll back with GurtOS" in the issue list's Apps menu: the picked issues with their task and state, a Confirm,
// then what came back for each. The issue keys come from Jira's context in the resolver, not from this page.
import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Button, ButtonGroup, DynamicTable, SectionMessage, Spinner, Stack, Text } from '@forge/react';
import { invoke, view } from '@forge/bridge';
import { IssueLink, Report, State } from './shared';

const App = () => {
  const [issues, setIssues] = useState();
  const [error, setError] = useState();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState();
  useEffect(() => {
    invoke('selected').then(setIssues, (e) => setError(e.message));
  }, []);

  const go = (keys) => async () => {
    setBusy(true);
    try {
      setReport((await invoke('rollbackIssues', { issues: keys })).results);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <SectionMessage appearance="error" title="Could not roll back"><Text>{error}</Text></SectionMessage>;
  if (report) return <Stack space="space.200"><Report results={report} /><Button onClick={() => view.close()}>Close</Button></Stack>;
  if (!issues) return <Spinner label="Reading the picked issues" />;
  const ready = issues.filter((i) => i.task?.id && i.canEdit && i.task.state !== 'undone');

  return (
    <Stack space="space.200">
      <Text>
        {issues.length ? `Roll back ${ready.length} of the ${issues.length} picked issues. Each task stops if it is still going and loses only its own file changes; other tasks keep theirs.` : 'Pick issues in the list first.'}
      </Text>
      <DynamicTable
        head={{ cells: [{ key: 'i', content: 'Issue' }, { key: 't', content: 'Task' }, { key: 's', content: 'State' }, { key: 'w', content: 'Will it roll back?' }] }}
        rows={issues.map((i) => ({
          key: i.key,
          cells: [
            { key: 'i', content: <IssueLink issue={i.key} /> },
            { key: 't', content: i.summary },
            { key: 's', content: i.task?.id ? <State state={i.task.state} /> : 'Not a GurtOS task' },
            { key: 'w', content: !i.task?.id ? 'No' : !i.canEdit ? 'No, you cannot edit this issue' : i.task.state === 'undone' ? 'Already rolled back' : 'Yes' },
          ],
        }))}
      />
      <ButtonGroup label="Confirm the roll back">
        <Button appearance="subtle" onClick={() => view.close()}>Cancel</Button>
        <Button appearance="danger" isDisabled={busy || !ready.length} onClick={go(ready.map((i) => i.key))}>
          {busy ? 'Rolling back' : `Confirm: roll back ${ready.length}`}
        </Button>
      </ButtonGroup>
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
