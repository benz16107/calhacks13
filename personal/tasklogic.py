# What the native GurtOS app decides, with no GTK: which section a task belongs in, how an action log event reads, what
# Activity's filters match, and what Time Machine takes out. selftest.py runs these against a real box.
from datetime import datetime, timedelta, timezone

LIVE = ('queued', 'running', 'waiting')
DONE_SHOWN = 20  # the Agents page lists this many finished tasks; Activity and Time Machine have the rest


def when(iso):
    try:
        t = datetime.fromisoformat((iso or '').replace('Z', '+00:00'))
    except ValueError:
        return None
    return t if t.tzinfo else t.replace(tzinfo=timezone.utc)


def clock(iso):
    t = when(iso)
    if not t:
        return ''
    t = t.astimezone()
    return t.strftime('%H:%M') if t.date() == datetime.now().astimezone().date() else t.strftime('%b %-d, %H:%M')


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


STATE_WORDS = {'queued': 'Queued', 'running': 'Started', 'waiting': 'Waiting for your OK', 'done': 'Finished', 'failed': 'Failed',
               'undone': 'Undone'}


def event_text(e):
    """(icon, line) for one action log event, in plain words."""
    t = e.get('type', '')
    if t == 'task.created':
        return 'list-add-symbolic', 'Created: ' + (e.get('spec') or {}).get('title', 'a task')
    if t == 'task.state':
        line = STATE_WORDS.get(e.get('state'), e.get('state', ''))
        if e.get('state') == 'failed' and e.get('error'):
            line += f": {e['error']}"
        return {'done': 'object-select-symbolic', 'failed': 'dialog-error-symbolic', 'undone': 'edit-undo-symbolic'}.get(e.get('state'), 'media-playback-start-symbolic'), line
    if t == 'task.step':
        return 'go-next-symbolic', e.get('text', '')
    if t == 'tool.call':
        return 'applications-system-symbolic', f"Used {e.get('tool', 'a tool')}"
    if t == 'tool.result':
        return ('object-select-symbolic', 'The tool answered') if e.get('ok') else ('dialog-warning-symbolic', f"The tool failed: {e.get('error', '')}")
    if t == 'approval.asked':
        return 'dialog-question-symbolic', 'Asked: ' + (e.get('approval') or {}).get('question', '')
    if t == 'approval.answered':
        return ('object-select-symbolic' if e.get('approved') else 'process-stop-symbolic'), f"{'Approved' if e.get('approved') else 'Denied'} by {e.get('by', 'someone')}"
    if t == 'cost':
        return 'gurtos-money-symbolic', f"Spent {dollars(e.get('cents'))} on {e.get('what', 'the model')}"
    if t == 'net.blocked':
        return 'security-high-symbolic', f"Blocked a connection to {e.get('host', 'a site')}"
    if t == 'keep':
        return 'document-save-symbolic', {'pending': 'Changes ready for review', 'kept': 'You kept its changes', 'conflict': 'Keep stopped: you edited the same files',
                                          'unkept': 'You put the files back', 'undone': 'Its changes were thrown away'}.get(e.get('result'), f"Keep: {e.get('result', '')}")
    if t == 'note':
        d = e.get('data') or {}
        return 'document-edit-symbolic', ', '.join(f'{k} {v}' for k, v in list(d.items())[:2]) if isinstance(d, dict) else str(d)
    return 'emblem-documents-symbolic', t.replace('.', ' ')


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
    """How Time Machine takes a finished task out: Undo throws its copy away, Put back reverses a Keep."""
    if t.get('review') == 'kept':
        return 'unkeep'
    if t['state'] == 'done':
        return 'undo'
    return None


SPANS = [('the last 15 minutes', timedelta(minutes=15)), ('the last hour', timedelta(hours=1)), ('today', None)]


def since(span, now=None):
    now = now or datetime.now().astimezone()
    return now.replace(hour=0, minute=0, second=0, microsecond=0) if span is None else now - span


def go_back_plan(tasks, start):
    """Every task that finished after `start` and still has changes to take out, newest first, so later changes go
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
