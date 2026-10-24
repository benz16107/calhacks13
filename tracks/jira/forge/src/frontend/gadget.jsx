// The "GurtOS agent activity" dashboard gadget: tasks, blocked attempts and cost per project for a period, and the
// latest blocked attempts. Its edit view picks the period and, if wanted, one project.
import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  BarChart, Button, DynamicTable, Heading, Label, SectionMessage, Select, Spinner, Stack, Text, Textfield, useProductContext,
} from '@forge/react';
import { invoke, view } from '@forge/bridge';
import { IssueLink, dollars } from './shared';

const PERIODS = [{ label: 'Last day', value: 1 }, { label: 'Last 7 days', value: 7 }, { label: 'Last 30 days', value: 30 }, { label: 'Last 90 days', value: 90 }];

const Edit = ({ config }) => {
  const [period, setPeriod] = useState(PERIODS.find((p) => p.value === Number(config.days)) ?? PERIODS[1]);
  const [project, setProject] = useState(config.project ?? '');
  return (
    <Stack space="space.150">
      <Label labelFor="period">Period</Label>
      <Select id="period" options={PERIODS} value={period} onChange={setPeriod} />
      <Label labelFor="project">Project key (leave empty for every project)</Label>
      <Textfield id="project" value={project} onChange={(e) => setProject(e.target.value.toUpperCase())} />
      <Button appearance="primary" onClick={() => view.submit({ days: period.value, project: project.trim() })}>Save</Button>
    </Stack>
  );
};

const View = ({ config }) => {
  const [data, setData] = useState();
  const [error, setError] = useState();
  useEffect(() => {
    invoke('activity', { days: config.days ?? 7, project: config.project }).then(setData, (e) => setError(e.message));
  }, [config.days, config.project]);
  if (error) return <SectionMessage appearance="error" title="Could not reach the box"><Text>{error}</Text></SectionMessage>;
  if (!data) return <Spinner label="Loading agent activity" />;
  const { totals, byProject, tasks, paused } = data;
  const blocked = tasks.filter((t) => t.blocked?.length).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
  const days = PERIODS.find((p) => p.value === Number(config.days ?? 7))?.label ?? `Last ${config.days} days`;
  return (
    <Stack space="space.200">
      <Text>
        {days}{config.project ? `, project ${config.project}` : ''}: {totals.tasks} agent tasks, {totals.blocked} blocked attempts, {totals.undone} rolled back, {dollars(totals.costCents)} spent.{paused ? ' Agents are paused.' : ''}
      </Text>
      {byProject.length > 0 && <BarChart title="Tasks per project" data={byProject} xAccessor="project" yAccessor="tasks" height={220} />}
      <DynamicTable
        head={{ cells: ['Project', 'Tasks', 'Blocked attempts', 'Cost'].map((c) => ({ key: c, content: c })) }}
        rows={byProject.map((p) => ({ key: p.project ?? 'none', cells: [{ key: 'Project', content: p.project ?? 'none' }, { key: 'Tasks', content: String(p.tasks) }, { key: 'Blocked attempts', content: String(p.blocked) }, { key: 'Cost', content: dollars(p.costCents) }] }))}
        emptyView="No agent tasks in this period."
      />
      <Heading size="xsmall">Latest blocked attempts</Heading>
      {blocked.length ? (
        <DynamicTable
          head={{ cells: ['Issue', 'Task', 'Tried to reach'].map((c) => ({ key: c, content: c })) }}
          rows={blocked.map((t) => ({ key: t.id, cells: [{ key: 'Issue', content: <IssueLink issue={t.issue} /> }, { key: 'Task', content: t.title }, { key: 'Tried to reach', content: t.blocked.join(', ') }] }))}
        />
      ) : <Text>None in this period.</Text>}
    </Stack>
  );
};

const App = () => {
  const context = useProductContext();
  if (!context) return <Spinner />;
  const config = context.extension.gadgetConfiguration ?? {};
  return context.extension.entryPoint === 'edit' ? <Edit config={config} /> : <View config={config} />;
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
