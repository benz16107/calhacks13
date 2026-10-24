// Every app the desktop can open, as a window. GurtOS's own apps first, then each track's app from GET /api/apps.
import { box } from '../live.ts';
import { wm } from '../wm.tsx';
import { taskTitle } from '../util.ts';
import { TasksApp } from './tasks.tsx';
import { TaskApp } from './task.tsx';
import { ActivityApp } from './activity.tsx';
import { TimeMachineApp } from './timemachine.tsx';
import { SettingsApp } from './settings.tsx';
import { AppCenterApp } from './appcenter.tsx';
import { TrackApp, trackEntry } from './track.tsx';
import { PairApp } from './pair.tsx';
import { AuditApp } from './audit.tsx';
import { RequestApp, WaitingApp } from './business.tsx';

wm.apps = {
  tasks: { title: () => 'Tasks', icon: 'tasks', size: [1480, 689], render: (arg) => <TasksApp view={arg} />, single: true },
  task: { title: (id) => taskTitle(id), icon: 'tasks', size: [1400, 660], render: (id) => <TaskApp id={id} key={id} /> },
  activity: { title: () => 'Activity', icon: 'activity', size: [1560, 900], render: () => <ActivityApp />, single: true },
  'time-machine': { title: () => 'Time Machine', icon: 'time-machine', size: [1480, 680], render: () => <TimeMachineApp />, single: true },
  settings: { title: () => 'Settings', icon: 'settings', size: [1240, 920], render: (page) => <SettingsApp page={page} />, single: true },
  'app-center': { title: () => 'App Center', icon: 'app-center', size: [1240, 860], render: (id) => <AppCenterApp id={id} />, single: true },
  app: { title: (arg) => trackEntry(arg)?.title.replace(/\s*\(.*\)$/, '') ?? arg, icon: '', size: [1280, 820], render: (arg) => <TrackApp arg={arg} key={arg} /> },
  pair: { title: () => 'Pair this phone', icon: 'settings', size: [560, 560], render: (code) => <PairApp code={code} /> },
  // GurtOS Business
  waiting: { title: () => 'Waiting for me', icon: 'waiting', size: [1240, 820], render: () => <WaitingApp />, single: true },
  request: { title: () => 'Request', icon: 'waiting', size: [760, 820], render: (id) => <RequestApp id={id} key={id} /> },
  audit: { title: () => 'Audit', icon: 'audit', size: [1500, 860], render: () => <AuditApp />, single: true },
};

export interface Launchable {
  id: string;
  route: string;
  title: string;
  /** The app icon's id: its own glyph when it has one, else its first letter. */
  icon: string;
  track?: string;
  /** Settings and App Center sit after the dock's divider. */
  system?: boolean;
}

/** What the dock and Show Apps list: GurtOS's own apps, every enabled track app, then the system apps. */
export function launchable(): Launchable[] {
  const own: Launchable[] = [
    ...(box.business.on ? [{ id: 'waiting', route: 'waiting', title: 'Waiting for me', icon: 'waiting' }] : []),
    { id: 'tasks', route: 'tasks', title: 'Tasks', icon: 'tasks' },
    { id: 'activity', route: 'activity', title: 'Activity', icon: 'activity' },
    { id: 'time-machine', route: 'time-machine', title: 'Time Machine', icon: 'time-machine' },
    ...(box.business.on ? [{ id: 'audit', route: 'audit', title: 'Audit', icon: 'audit' }] : []),
  ];
  const tracks = box.apps.map((a) => ({
    id: `${a.track}/${a.name}`,
    route: `app/${a.track}/${a.name}`,
    title: a.title.replace(/\s*\(.*\)$/, ''),
    icon: `${a.track}/${a.name}`,
    track: a.track,
  }));
  return [
    ...own,
    ...tracks,
    { id: 'settings', route: 'settings', title: 'Settings', icon: 'settings', system: true },
    { id: 'app-center', route: 'app-center', title: 'App Center', icon: 'app-center', system: true },
  ];
}
