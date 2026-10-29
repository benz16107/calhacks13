# What the native GurtOS app decides, with no GTK: which section a task belongs in, how an action log event reads, what
# Activity's filters match, and what Time Machine takes out. selftest.py runs these against a real box.
from datetime import datetime, timedelta, timezone

LIVE = ('queued', 'running', 'waiting')
TWELVE = False  # GNOME's clock is set to AM/PM; box-ui.py reads org.gnome.desktop.interface clock-format at start
DONE_SHOWN = 20  # the Agents page lists this many finished tasks; Activity and Time Machine have the rest


def when(iso):
    try:
        t = datetime.fromisoformat((iso or '').replace('Z', '+00:00'))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)


def hm(t):
    """A time of day as GNOME's clock shows it: 13:44, or 1:44 PM."""
    return t.strftime('%-I:%M %p') if TWELVE else t.strftime('%H:%M')


def clock(iso):
    t = when(iso)
    if not t:
        return ''
    t = t.astimezone()
    return hm(t) if t.date() == datetime.now().astimezone().date() else f"{t.strftime('%b %-d')}, {hm(t)}"


def dollars(cents):
    return f'${(cents or 0) / 100:,.2f}'


def needs_review(t):
    return t.get('review') in ('pending', 'conflict')


def sections(tasks, pending):
    """The Agents page: Needs you (approvals, oldest first), Running, Ready to review, Done (newest first)."""
    by_id = {t['id']: t for t in tasks}
    newest = sorted(tasks, key=lambda t: t.get('updatedAt', ''), reverse=True)
    asking = {a['task'] for a in pending}
    return {
        'needs': [(a, by_id.get(a['task'])) for a in pending],
        'running': [t for t in newest if t['state'] in LIVE and t['id'] not in asking],
        'review': [t for t in newest if t['state'] == 'done' and needs_review(t)],
        'done': [t for t in newest if t['state'] in ('done', 'failed', 'undone') and not needs_review(t)][:DONE_SHOWN],
    }


def headline(s):
    parts = []
    if s['needs']:
        parts.append(f"{len(s['needs'])} need{'s' if len(s['needs']) == 1 else ''} you")
    if s['running']:
        parts.append(f"{len(s['running'])} running")
    if s['review']:
        parts.append(f"{len(s['review'])} to review")
    return ' · '.join(parts) or 'Nothing running'


def app_of(e):
    """The app (track) an event belongs to: a track's own note, or the app whose tool a task called."""
    if e.get('track'):
        return e['track']
    tool = e.get('tool') or ''
    return tool.split('.', 1)[0] if '.' in tool else None


STATE_WORDS = {'queued': 'Queued', 'running': 'Started', 'waiting': 'Needs you', 'done': 'Finished', 'failed': 'Failed',
               'undone': 'Undone'}


def who(by, me=None):
    """Who answered a request, in plain words: `desktop:<user>` is you on this computer."""
    by = by or ''
    kind, _, name = by.partition(':')
    if kind == 'desktop':
        return 'you' if name in (me, '') or me is None else name
    if kind == 'voice':
        return 'you, by voice'
    if kind == 'passkey':
        return 'you, with your passkey'
    if kind in ('phone', 'device') or by == 'phone':
        return 'your phone'
    if kind in ('portal', 'screen'):
        return 'the GurtOS screen'
    return name or kind or 'someone'


def event_text(e, me=None):
    """(icon, line) for one action log event, in plain words."""
    t = e.get('type', '')
    if t == 'task.created':
        return 'list-add-symbolic', 'Created: ' + (e.get('spec') or {}).get('title', 'a task')
    if t == 'task.state':
        line = STATE_WORDS.get(e.get('state'), e.get('state', ''))
        if e.get('state') == 'failed' and e.get('error'):
            line = f"Could not finish. {failure_text(e['error'])}"
        return {'done': 'object-select-symbolic', 'failed': 'dialog-error-symbolic', 'undone': 'edit-undo-symbolic'}.get(e.get('state'), 'media-playback-start-symbolic'), line
    if t == 'task.step':
        return 'go-next-symbolic', e.get('text', '')
    if t == 'tool.call':
        app, _, action = (e.get('tool') or 'a tool').partition('.')
        return 'applications-system-symbolic', f"Used {app.capitalize()}" + (f" ({action.replace('_', ' ')})" if action else '')
    if t == 'tool.result':
        if e.get('ok'):
            return ('gurtos-money-symbolic', f"Finished, spent {dollars(e['cents'])}") if e.get('cents') else ('object-select-symbolic', 'It worked')
        return 'process-stop-symbolic', f"Blocked: it was refused. {failure_text(e.get('error'))}"
    if t == 'approval.asked':
        return 'dialog-question-symbolic', 'Asks: ' + (e.get('approval') or {}).get('question', '')
    if t == 'approval.answered':
        closed = {'undo': 'Closed: the task was undone', 'task ended': 'Closed: the task ended'}.get(e.get('by'))  # no one answered
        if closed and not e.get('approved'):
            return 'process-stop-symbolic', closed
        return ('object-select-symbolic' if e.get('approved') else 'process-stop-symbolic'), f"{'Approved' if e.get('approved') else 'Denied'} by {who(e.get('by'), me)}"
    if t == 'cost':
        return 'gurtos-money-symbolic', f"Spent {dollars(e.get('cents'))} on {e.get('what', 'the model')}"
    if t == 'net.blocked':
        return 'security-high-symbolic', f"Blocked: reaching {e.get('host', 'a site')}, not one of this task's hosts"
    if t == 'keep':
        return 'document-save-symbolic', {'pending': 'Changes ready for review', 'kept': 'You kept its changes', 'conflict': 'Keep stopped: you edited the same files',
                                          'unkept': 'Undone after Keep: the files are back', 'reverted': 'The Keep was undone', 'undone': 'Undone'}.get(e.get('result'), 'Changes updated')
    if t == 'note':
        return 'document-edit-symbolic', e.get('text') or f"{(e.get('track') or 'An app').capitalize()} made a note"
    return 'emblem-documents-symbolic', 'Something happened'


def failure_text(error):
    """A failure as a sentence: no `worker exited with 1: Error:`, no JSON."""
    import re
    e = re.sub(r'^worker exited with \d+:\s*', '', error or '', flags=re.I)
    e = re.sub(r'^Error:\s*', '', e)
    if re.search(r'key was not accepted', e, re.I):
        return e.strip().splitlines()[0]  # the core's own sentence
    if re.search(r'\b401\b|authentication_error|invalid x-api-key|invalid api key', e, re.I):
        return 'Your Anthropic key was not accepted. Change it in Settings, Accounts & Keys.'
    if re.search(r'vault has no', e, re.I):
        return 'Add an Anthropic API key in GurtOS Settings first.'
    first = e.strip().splitlines()[0] if e.strip() else ''
    if first.startswith('{') or first.startswith('['):
        return 'It stopped with an error. Technical details has the rest.'
    first = first[:1].upper() + first[1:]  # a sentence, after "Could not finish."
    return (first if first[-1:] in '.?!' else first + '.') if first else 'It stopped with an error.'


def added_text(diff, path):
    """The text of a file a task added, from its unified diff."""
    out, inside = [], False
    for line in diff.splitlines():
        if line.startswith('+++ '):
            inside = line[4:].strip() in (f'b/{path}', path)
            continue
        if line.startswith('--- ') or line.startswith('diff '):
            inside = False if line.startswith('diff ') else inside
            continue
        if inside and line.startswith('+'):
            out.append(line[1:])
        elif inside and line.startswith('@@'):
            continue
    return out


def app_title(e, apps):
    a = app_of(e)
    return next((x['title'] for x in apps if x.get('track') == a), a.capitalize() if a else None)


def matches(e, titles, query='', task=None, app=None):
    """Activity's search box and its two filters."""
    if task and e.get('task') != task:
        return False
    if app and app_of(e) != app:
        return False
    if query:
        hay = f"{event_text(e)[1]} {titles.get(e.get('task'), '')} {app_of(e) or ''}".lower()
        return all(w in hay for w in query.lower().split())
    return True


def can_take_out(t):
    """How Time Machine undoes a finished task: `undo` throws its copy away, `unkeep` reverses a Keep. A task whose
    Keep was already undone stays `done` with review `undone`: there is nothing left to take out."""
    if t.get('review') == 'kept':
        return 'unkeep'
    if t['state'] == 'done' and t.get('review') != 'undone':
        return 'undo'
    return None


SPANS = [('the last 15 minutes', timedelta(minutes=15)), ('the last hour', timedelta(hours=1)), ('today', None)]


def since(span, now=None):
    now = now or datetime.now().astimezone()
    return now.replace(hour=0, minute=0, second=0, microsecond=0) if span is None else now - span


def go_back_plan(tasks, start):
    """Every task that finished after `start` and can still be undone, newest first, so later changes go
    before the earlier ones they may sit on."""
    out = [t for t in tasks if can_take_out(t) and (when(t.get('updatedAt')) or start) >= start]
    return sorted(out, key=lambda t: t.get('updatedAt', ''), reverse=True)


def reach(detail):
    """What a task can reach, from its creation event: folders (or its workspace), the internet, its apps' tools."""
    t = detail['task']
    spec = next((e.get('spec') or {} for e in detail.get('events', []) if e.get('type') == 'task.created'), {})
    folders = t.get('folders') or ([t['folder']] if t.get('folder') else []) or spec.get('folders') or ([spec['folder']] if spec.get('folder') else [])
    return {'folders': folders, 'workspace': t.get('workspace') or spec.get('workspace'), 'hosts': spec.get('hosts') or [],
            'tools': spec.get('tools') or [], 'user': t.get('user') or ''}


# ---------- the flight recorder (portal/src/apps/replay-model.ts, the same rules) ----------

KIND_WORDS = {'start': 'Started', 'step': 'Step', 'tool': 'Tool', 'blocked': 'Blocked', 'ask': 'Request', 'approved': 'Approved',
              'denied': 'Denied', 'spend': 'Spent', 'running': 'Running', 'waiting': 'Needs you', 'done': 'Done', 'failed': 'Failed',
              'undone': 'Undone', 'kept': 'Kept', 'keep': 'Keep', 'note': 'Note'}
MATTERS = ('blocked', 'ask', 'approved', 'denied', 'failed', 'undone', 'kept')


def kind_of(e):
    t = e.get('type')
    if t == 'task.created':
        return 'start'
    if t == 'task.step':
        return 'step'
    if t == 'tool.call':
        return 'tool'
    if t == 'tool.result':
        return ('spend' if e.get('cents') else 'tool') if e.get('ok') else 'blocked'
    if t == 'net.blocked':
        return 'blocked'
    if t == 'approval.asked':
        return 'ask'
    if t == 'approval.answered':
        return 'approved' if e.get('approved') else 'denied'
    if t == 'cost':
        return 'spend'
    if t == 'task.state':
        st = e.get('state')
        return st if st in ('done', 'failed', 'undone', 'waiting') else 'running'
    if t == 'keep':
        return {'kept': 'kept', 'reverted': 'undone'}.get(e.get('result'), 'keep')
    return 'note'


def replay_points(events):
    """Every point of one task, oldest first, with its kind, whether it matters and what was spent by then (cents)."""
    cost, out = 0, []
    for e in sorted(events, key=lambda e: e.get('seq', 0)):
        if e.get('type') == 'task.step' and not e.get('text'):
            continue  # a scripted wait: nothing to say
        if e.get('type') == 'cost':
            cost += e.get('cents') or 0
        if e.get('type') == 'tool.result':
            cost += e.get('cents') or 0
        k = kind_of(e)
        out.append({'seq': e.get('seq', 0), 'at': e.get('at'), 'kind': k, 'cents': cost, 'matters': k in MATTERS, 'event': e})
    return out


def next_matter(points, i, step=1):
    """The next (step 1) or previous (step -1) point that matters, or i when there is none."""
    j = i + step
    while 0 <= j < len(points):
        if points[j]['matters']:
            return j
        j += step
    return i


def files_at(recorded, seq):
    """The newest recorded file state at or before a point."""
    return max((s for s in recorded if s <= seq), default=None)


GONE = "This task's files are gone."
BEFORE = "This task ran before GurtOS kept its files at each step, so this shows its final changes."


def files_note(points, i, recorded, capped, final):
    """What the Files part of Replay says at point i: (seq of the recorded files to show, or None for the final diff
    or nothing, and the line under it). recorded is the seqs core kept, oldest first; [] for a task from before it
    recorded files, or one whose files were purged."""
    if not recorded:
        if (final or {}).get('undone') or not (final or {}).get('changes'):
            return None, GONE
        return None, BEFORE
    at = files_at(recorded, points[i]['seq'])
    if at is None:
        return None, 'No files changed yet.'
    last = next((p['kind'] for p in reversed(points[:i + 1]) if p['kind'] in ('kept', 'undone')), None)
    if last == 'undone':
        return at, 'As they were before Undo removed them.'
    if capped and at == recorded[-1] and points[i]['seq'] > at:
        return at, 'Recording stopped at 50 MB for this task, so this shows the last files it kept.'
    return at, None
