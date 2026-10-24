import { useState, type ReactNode } from 'react';

// Sample data only. The names and sentences match the GurtOS Figma frames and the Business core.
type MachineId = 'server' | 'personal' | 'business';
type View = 'home' | 'request' | 'add' | 'lock' | 'install';

const MACHINES: Record<MachineId, { name: string; edition: string; who?: string; online: boolean; state: string }> = {
  server: { name: 'Home box', edition: 'GurtOS Server', online: true, state: 'Online' },
  personal: { name: 'Ben’s laptop', edition: 'GurtOS Personal', online: false, state: 'Asleep · seen 18:52' },
  business: { name: 'Fogline Supply', edition: 'GurtOS Business', who: 'Signed in as Rosa Delgado, Controller', online: true, state: 'Online' },
};

const ROUTE = 'Requests over $10,000 go to the Controller for approval. Rosa Delgado can approve it.';

const I = {
  down: <path d="M4 6l4 4 4-4" />,
  next: <path d="M6 3l5 5-5 5" />,
  back: <path d="M10 3L5 8l5 5" />,
  check: <path d="M3 8.5l3 3 7-7" />,
  plus: <path d="M8 3v10M3 8h10" />,
  server: <><rect x="2.5" y="3" width="11" height="7" rx="2" /><path d="M8 10v3M5 13h6" /><circle cx="6" cy="6.5" r=".6" /><circle cx="10" cy="6.5" r=".6" /></>,
  laptop: <><rect x="3" y="3.5" width="10" height="7" rx="1.2" /><path d="M1.5 12.5h13" /></>,
  more: <><circle cx="4" cy="8" r=".9" /><circle cx="8" cy="8" r=".9" /><circle cx="12" cy="8" r=".9" /></>,
};
const Icon = ({ d, size = 16 }: { d: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>
);

function Tile({ id, size = 34 }: { id: MachineId; size?: number }) {
  return (
    <span className={`tile tile-${id}`} style={{ width: size, height: size, borderRadius: size * 0.27 }} aria-hidden="true">
      {id === 'business' ? 'FS' : <Icon d={id === 'server' ? I.server : I.laptop} size={size * 0.6} />}
    </span>
  );
}

const StatusBar = ({ time = '19:04', dark }: { time?: string; dark?: boolean }) => (
  <div className={`status ${dark ? 'status-dark' : ''}`}><span>{time}</span><span className="island" /><span className="battery" /></div>
);

const Row = ({ title, sub, trail, onClick, lead }: { title: string; sub?: ReactNode; trail?: ReactNode; onClick?: () => void; lead?: ReactNode }) => {
  const body = <>{lead}<span className="row-text"><span className="row-title">{title}</span>{sub && <span className="row-sub">{sub}</span>}</span>{trail}</>;
  return onClick ? <button className="row" onClick={onClick}>{body}</button> : <div className="row">{body}</div>;
};
const Progress = ({ value, label }: { value: number; label: string }) => (
  <span className="progress" role="progressbar" aria-label={label} aria-valuenow={value}><span style={{ width: `${value}%` }} /></span>
);
const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="section"><h2>{title}</h2><div className="card">{children}</div></section>
);

function Tabs({ business }: { business: boolean }) {
  const tabs = business ? ['Waiting', 'Tasks', 'Audit', 'Settings'] : ['Home', 'Tasks', 'Activity', 'Settings'];
  return <nav className="tabs" aria-label="Tabs">{tabs.map((t, i) => <span key={t} className={i === 0 ? 'tab tab-on' : 'tab'}>{t}</span>)}</nav>;
}

export default function App() {
  const [machine, setMachine] = useState<MachineId>('server');
  const [view, setView] = useState<View>('home');
  const [sheet, setSheet] = useState(false);
  const [paused, setPaused] = useState(false);
  const [folder, setFolder] = useState<'ready' | 'kept' | 'undone'>('ready');
  const [answer, setAnswer] = useState<'waiting' | 'approved' | 'denied'>('waiting');
  const [step, setStep] = useState(0);
  const [alert, setAlert] = useState(false);

  const waiting: Record<MachineId, number> = { server: 2, personal: folder === 'ready' ? 1 : 0, business: answer === 'waiting' ? 3 : 2 };
  const go = (m: MachineId, v: View = 'home') => { setMachine(m); setView(v); setSheet(false); };
  const reset = () => { setMachine('server'); setView('home'); setSheet(false); setPaused(false); setFolder('ready'); setAnswer('waiting'); setStep(0); setAlert(false); };

  const header = (
    <button className="switcher" onClick={() => setSheet(true)} aria-label={`${MACHINES[machine].name}. Switch machine`}>
      <span className="switcher-row"><Tile id={machine} /><span className="t-title1">{MACHINES[machine].name}</span><Icon d={I.down} size={22} /></span>
      <span className="t-caption muted">
        {MACHINES[machine].edition} · Online · {machine === 'server' ? (paused ? 'all paused' : '2 running · $0.34 today') : machine === 'personal' ? '1 running' : 'Rosa Delgado, Controller'}
      </span>
    </button>
  );

  const serverHome = (
    <>
      {paused && <div className="banner banner-red"><strong>All agents are paused</strong><span>Paused by you at 19:04. Running tasks stopped mid-step; new tasks wait in the queue.</span></div>}
      <Section title="Needs you">
        <Row lead={<span className="app app-wallet" />} title="Buy a GPU hour" sub="Spend $8.00, over its $5.00 budget" trail={<span className="badge">$8.00</span>} />
        <Row lead={<span className="app app-shopper" />} title="Hario V60 filters, 2 packs" sub="$13.00, test payment" trail={<span className="badge">$13.00</span>} />
      </Section>
      <Section title="Running">
        <Row lead={<span className="app app-tasks" />} title="Fix the failing test" sub={paused ? 'Paused at step 4 of 7' : <>Step 4 of 7, npm test<Progress value={57} label="Fix the failing test" /></>} />
        <Row lead={<span className="app app-find" />} title="Describe 1,200 photos" sub={paused ? 'Paused at batch 2 of 4' : <>Batch 2 of 4<Progress value={50} label="Describe 1,200 photos" /></>} />
      </Section>
      <Section title="Kill switch">
        <div className="pad">
          {paused
            ? <button className="btn btn-suggested btn-large" onClick={() => setPaused(false)}>Resume all agents</button>
            : <button className="btn btn-destructive btn-large" onClick={() => setPaused(true)}>Pause all agents</button>}
          <p className="t-caption muted">Running tasks stop mid-step and new ones wait. What waits for your OK stays open.</p>
        </div>
      </Section>
    </>
  );

  const personalHome = (
    <>
      <Section title={folder === 'ready' ? 'Ready for you' : 'Done'}>
        <div className="pad">
          <Row lead={<span className="folder" />} title="Sort receipts by month" sub="Documents › Invoices · finished at 18:12" />
          {folder === 'ready' && <>
            <p className="t-body">In a copy of Invoices: 38 files moved into 12 month folders and 3 renamed. Nothing outside the folder changed.</p>
            <span className="link">Review changes</span>
            <div className="btn-row">
              <button className="btn btn-large" onClick={() => setFolder('undone')}>Undo</button>
              <button className="btn btn-suggested btn-large" onClick={() => setFolder('kept')}>Keep changes</button>
            </div>
            <p className="t-caption muted">Your folder stays as it was until you choose Keep.</p>
          </>}
          {folder === 'kept' && <p className="t-body">Kept. The 41 changes are in Invoices now, each marked "Changed by an agent". <button className="link-btn" onClick={() => setFolder('ready')}>Put files back</button></p>}
          {folder === 'undone' && <p className="t-body">Undone. Invoices is as it was; the agent's copy is gone. <button className="link-btn" onClick={() => setFolder('ready')}>Show it again</button></p>}
        </div>
      </Section>
      <Section title="Running">
        <Row lead={<span className="folder" />} title="Rename trip photos" sub={<>Pictures › Lisbon · step 3 of 5, in a copy<Progress value={60} label="Rename trip photos" /></>} />
      </Section>
      <Section title="Kept recently">
        <Row lead={<span className="folder" />} title="Tidy Downloads" sub="Kept yesterday · 21 files moved" trail={<button className="btn">Put back</button>} />
      </Section>
    </>
  );

  const businessHome = (
    <>
      <Section title="Waiting for me">
        {answer === 'waiting' && <Row onClick={() => setView('request')} lead={<span className="app app-credit" />} title="Bright Harbor Catering"
          sub={<>Credit line · APP-1042 · Net 30<br />Requested by Sam Chen · prepared by Credit analyst agent</>} trail={<span className="badge">$40,000</span>} />}
        <Row lead={<span className="app app-credit" />} title="Mission St. Taqueria" sub={<>Write-off · INV-24102<br />Requested by Sam Chen · prepared by Collections clerk agent</>} trail={<span className="badge">$2,400</span>} />
        <Row lead={<span className="app app-credit" />} title="Pacific Crest Provisions" sub={<>Fraud referral · APP-1043<br />Requested by Sam Chen · prepared by Credit analyst agent</>} trail={<span className="badge badge-red">Fraud referral</span>} />
      </Section>
      {answer !== 'waiting' && <p className="t-caption muted center">You {answer} the $40,000 credit line for Bright Harbor Catering. It is in the audit log.</p>}
      <p className="t-caption muted">You approve for the Controller and the fraud reviewer, so fraud referrals and requests over $10,000 come to you. Everything else goes to any approver.</p>
    </>
  );

  const request = (
    <div className="screen-scroll">
      <button className="back" onClick={() => setView('home')}><Icon d={I.back} /> Waiting for me</button>
      <span className="chip"><Tile id="business" size={22} />Fogline Supply · signed in as Rosa Delgado</span>
      <h1 className="t-title2">Credit line for Bright Harbor Catering</h1>
      <p className="amount">$40,000 <span className="t-caption muted">Net 30 · APP-1042</span></p>
      <p className="t-body-strong">Requested by Sam Chen · prepared by Credit analyst agent</p>
      <div className="banner banner-accent">{ROUTE}</div>
      <h2 className="t-heading">The agent's checks</h2>
      <div className="card">
        {[['Guarantor credit 790, band A', 'TransUnion through CRS · BND-A'], ['Identity checks passed', 'CRS identity verification'], ['Fraud Finder: no reasons', 'CRS Fraud Finder'],
          ['Verified revenue $2,150,000', 'The lowest of stated, business credit and bank deposits · LIM-2'], ['Limit $40,000 on Net 30', 'The smallest of the request, band A’s cap and 10% of revenue · LIM-1']]
          .map(([t, s]) => <Row key={t} lead={<span className="ok"><Icon d={I.check} /></span>} title={t} sub={s} />)}
      </div>
      <p className="t-caption muted">Sandbox data from CRS and Capital One Nessie test accounts.</p>
      <div className="pinned">
        {answer === 'waiting'
          ? <div className="btn-row">
              <button className="btn btn-large" onClick={() => setAnswer('denied')}>Deny</button>
              <button className="btn btn-suggested btn-large" onClick={() => setAnswer('approved')}>Approve $40,000</button>
            </div>
          : <div className={`banner ${answer === 'approved' ? 'banner-green' : ''}`}>{answer === 'approved' ? 'Approved by you. The Credit analyst carries on and sets the limit.' : 'Denied by you. Sam Chen gets a notification.'} <button className="link-btn" onClick={() => setView('home')}>Back to Waiting for me</button></div>}
      </div>
    </div>
  );

  const lock = (
    <div className="lock">
      <StatusBar time="14:07" dark />
      <p className="lock-date">Tuesday, October 20</p>
      <p className="lock-time">14:07</p>
      <button className="notif" onClick={() => go('business', 'request')}>
        <span className="notif-head"><span className="app app-tasks small" />GurtOS<span className="muted right">now</span></span>
        <strong>Fogline Supply</strong>
        <span>Approve a $40,000 credit line? Bright Harbor Catering, asked by Sam Chen.</span>
      </button>
      <p className="lock-hint">Tap the notification. It opens the request on Fogline Supply.</p>
    </div>
  );

  const add = (
    <div className="camera">
      <StatusBar dark />
      <div className="cam-bar"><button className="link-btn on-dark" onClick={() => setView('home')}>Cancel</button><strong>Add a machine</strong><span /></div>
      <div className="cam-view"><div className="cam-card"><span><strong>Pair a phone</strong><br />Scan with the GurtOS app.</span><img src="/qr-example.svg" alt="Example QR code" /></div></div>
      <div className="cam-panel">
        <h2 className="t-title3">Point the camera at the QR code on the machine's screen</h2>
        <p className="t-caption muted">GurtOS Server: Settings › Devices › Pair a phone.<br />GurtOS Personal: GurtOS Settings › Phone.<br />GurtOS Business: an admin adds you, and GurtOS shows your QR code.</p>
        <button className="btn btn-large" onClick={() => setView('home')}>Type the code instead</button>
      </div>
    </div>
  );

  const installSteps: ReactNode[] = [
    <div className="camera" key="0">
      <StatusBar dark />
      <div className="cam-view tall"><div className="cam-card"><span><strong>Pair a phone</strong><br />Home box<br />Scan with Camera to install GurtOS.</span><img src="/qr-example.svg" alt="Example QR code" /></div></div>
      <button className="pill" onClick={() => setStep(1)}>app.gurtos.com</button>
      <p className="lock-hint">Step 1 of 5: Camera reads the QR code. Tap the link.</p>
    </div>,
    <div className="screen-scroll center-col" key="1">
      <StatusBar />
      <span className="app app-tasks big" />
      <h1 className="t-title2">Install GurtOS on this phone</h1>
      <p className="t-body muted">To answer Home box from this phone, add GurtOS to your Home Screen, then open it from there. It pairs inside the app.</p>
      <div className="card">{['Tap ⋯ below, then Share', 'Tap Add to Home Screen', 'Leave Open as Web App on, then tap Add', 'Open GurtOS from your Home Screen'].map((s, i) => <Row key={s} lead={<span className="num">{i + 1}</span>} title={s} />)}</div>
      <div className="safari"><span className="url">app.gurtos.com</span><button className="more" aria-label="Page Menu" onClick={() => setStep(2)}><Icon d={I.more} size={20} /></button></div>
    </div>,
    <div className="screen-scroll" key="2">
      <StatusBar />
      <div className="scrim" />
      <div className="sheet low">
        <div className="sheet-bar"><button className="link-btn" onClick={() => setStep(1)}>Cancel</button><strong>Add to Home Screen</strong><button className="link-btn strong" onClick={() => setStep(3)}>Add</button></div>
        <div className="card"><Row lead={<span className="app app-tasks big" />} title="GurtOS" sub="app.gurtos.com" /></div>
        <div className="card"><Row title="Open as Web App" trail={<span className="switch on" aria-label="On" />} /></div>
        <p className="t-caption muted">Step 3 of 5: adds an icon to your Home Screen. GurtOS opens from it like an app and can send you notifications.</p>
      </div>
    </div>,
    <div className="screen-scroll center-col" key="3">
      <StatusBar />
      <span className="app app-tasks big" />
      <h1 className="t-title2">Get approvals on this phone</h1>
      <p className="t-body muted">GurtOS sends a notification when something needs your OK, and names the machine it came from. Nothing else.</p>
      <div className="pinned"><button className="btn btn-suggested btn-large" onClick={() => setAlert(true)}>Turn on notifications</button><button className="btn btn-flat btn-large" onClick={() => setStep(4)}>Not now</button></div>
      {alert && <><div className="scrim" /><div className="alert" role="alertdialog" aria-label="Notifications">
        <strong>"GurtOS" Would Like to Send You Notifications</strong>
        <span className="t-caption muted">Notifications may include alerts, sounds and icon badges. You can change this in Settings.</span>
        <div className="btn-row"><button className="btn btn-large" onClick={() => { setAlert(false); setStep(4); }}>Don't Allow</button><button className="btn btn-suggested btn-large" onClick={() => { setAlert(false); setStep(4); }}>Allow</button></div>
      </div></>}
    </div>,
    <div className="screen-scroll center-col" key="4">
      <StatusBar />
      <Tile id="server" size={64} />
      <h1 className="t-title2">Pair with Home box?</h1>
      <p className="t-body muted">Check that this code is the one on the box's screen.</p>
      <p className="code">7Q4M-2KXD</p>
      <div className="card"><Row title="Name this phone" sub="Ben's iPhone" /><Row title="This is the owner's phone" sub="It can change settings, not just answer" trail={<span className="switch on" aria-label="On" />} /></div>
      <div className="pinned"><button className="btn btn-suggested btn-large" onClick={() => { setStep(0); go('server'); }}>Pair</button></div>
    </div>,
  ];

  let screen: ReactNode;
  if (view === 'lock') screen = lock;
  else if (view === 'add') screen = add;
  else if (view === 'install') screen = installSteps[step];
  else if (view === 'request') screen = request;
  else screen = (
    <div className="screen-scroll with-tabs">
      <StatusBar />
      {header}
      {machine === 'server' ? serverHome : machine === 'personal' ? personalHome : businessHome}
      <Tabs business={machine === 'business'} />
    </div>
  );

  return (
    <div className="page">
      <header className="proto-bar">
        <strong>GurtOS phone app · prototype with sample data</strong>
        <div className="proto-actions">
          <button className="btn" onClick={() => { setSheet(false); setView('lock'); }}>Simulate a notification</button>
          <button className="btn" onClick={() => { setSheet(false); setStep(0); setAlert(false); setView('install'); }}>Install walkthrough</button>
          <button className="btn btn-flat" onClick={reset}>Reset</button>
        </div>
      </header>
      <div className="phone">
        {screen}
        {sheet && <>
          <div className="scrim" onClick={() => setSheet(false)} />
          <div className="sheet" role="dialog" aria-label="Machines">
            <span className="grabber" />
            <div className="sheet-bar"><button className="link-btn" onClick={() => setSheet(false)}>Close</button><strong>Machines</strong><span /></div>
            <div className="card">
              {(Object.keys(MACHINES) as MachineId[]).map((id) => {
                const m = MACHINES[id];
                return <button key={id} className={`row machine ${id === machine ? 'current' : ''}`} onClick={() => go(id)}>
                  <Tile id={id} size={44} />
                  <span className="row-text"><span className="row-title">{m.name}</span><span className="row-sub">{m.edition}</span>{m.who && <span className="row-sub">{m.who}</span>}
                    <span className={m.online ? 'state on' : 'state'}><span className="dot" />{m.state}</span></span>
                  <span className="count"><span className="badge">{waiting[id]}</span><span className="t-caption muted">waiting</span></span>
                  <span className="check">{id === machine && <Icon d={I.check} size={20} />}</span>
                </button>;
              })}
            </div>
            <div className="card"><Row onClick={() => { setSheet(false); setView('add'); }} lead={<span className="tile tile-add"><Icon d={I.plus} size={22} /></span>} title="Add a machine" sub="Scan the QR code on its screen" trail={<Icon d={I.next} />} /></div>
            <p className="t-caption muted">Each machine has its own pairing. On a GurtOS Business machine you are a person with a role; on the others, this phone answers for the owner. Approvals from every machine reach this phone, each named by its machine.</p>
          </div>
        </>}
      </div>
      <p className="foot">Tap the machine name to switch machines. Sample data, no real machines or payments.</p>
    </div>
  );
}
