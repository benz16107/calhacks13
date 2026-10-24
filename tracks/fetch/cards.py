"""ASI:One Interactive Cards the box's agents send. Standard library only.

Each builder returns {'kind', 'payload', 'ref', 'actions', 'terminal'}: agent.py turns kind and payload into the card's
metadata (https://innovationlab.fetch.ai/resources/docs/interactive-cards/asi-interactive-cards), and the brain keeps
`ref` and `actions` so a click relayed in words ("the user approved the card") still finds its approval or task.
cards.test.py checks every builder against the schemas in uagents_core, because ASI:One drops a card that does not
match them and shows only the text.
"""


def dollars(cents):
    return f'${cents / 100:.2f}' if cents >= 1 or cents == 0 else f'${cents / 100:.4f}'


def card(kind, payload, ref=None, actions=(), terminal=False):
    return {'kind': kind, 'payload': payload, 'ref': ref, 'actions': list(actions), 'terminal': terminal}


def button(label, action, primary=False, **selection):
    return {'type': 'button', 'label': label, 'primary': primary, 'action': {'selection': {'action': action, **selection}}}


def badges(*labels, variant='info'):
    return {'type': 'group', 'direction': 'row', 'gap': 6,
            'children': [{'type': 'badge', 'label': str(x), 'variant': variant} for x in labels if x]}


def approval(a, task_title, by_agent=None):
    """Approve or Deny a request a task is paused on."""
    rows = [{'label': 'Task', 'value': task_title}, {'label': 'Asks', 'value': a['question']}]
    if a.get('costCents'):
        rows.append({'label': 'Cost', 'value': dollars(a['costCents'])})
    if by_agent:
        rows.append({'label': 'Agent', 'value': by_agent})
    return card('review', {
        'title': 'Approve this?',
        'summary_rows': rows,
        'approve_cta': {'label': 'Approve', 'primary': True, 'selection': {'action': 'approve', 'approval': a['id']}},
        'reject_cta': {'label': 'Deny', 'selection': {'action': 'deny', 'approval': a['id']}},
    }, ref=a['id'], actions=('approve', 'deny'))


def progress(task_id, title, steps, budget_cents, cost_cents, waiting=None):
    """What a running task has done so far, with Status and Stop."""
    kids = [badges('own Linux user', 'own copy of the files', 'no network of its own',
                   f'budget {dollars(budget_cents)}', f'spent {dollars(cost_cents)}')]
    if steps:
        kids.append({'type': 'list', 'items': [{'children': [{'type': 'text', 'value': s[:140]}]} for s in steps[-6:]]})
    if waiting:
        kids.append({'type': 'badge', 'label': f'Waiting for your OK: {waiting[:120]}', 'variant': 'warning'})
    kids.append({'type': 'group', 'direction': 'row', 'children': [
        button('Status', 'status', primary=True, task=task_id), button('Stop and undo', 'undo', task=task_id)]})
    return card('custom', {'root': {'type': 'section', 'title': f'Working: {title}'[:120], 'subtitle': task_id, 'children': kids}},
                ref=task_id, actions=('status', 'undo'))


def result(task_id, title, cost_cents, summary, changes, diff, blocked=()):
    """A finished task: what it said, what it changed, and Keep or Undo."""
    kids = [badges(f'cost {dollars(cost_cents)}', f'{len(changes)} file{"" if len(changes) == 1 else "s"} changed', 'in its own layer')]
    if summary:
        kids.append({'type': 'text', 'value': summary[-1200:]})
    if changes:
        word = {'added': 'success', 'modified': 'info', 'deleted': 'warning'}
        kids.append({'type': 'list', 'items': [{'children': [{'type': 'badge', 'label': f"{c['change']} {c['path']}"[:100], 'variant': word.get(c['change'], 'info')}]}
                                               for c in changes[:12]]})
    if diff:
        kids.append({'type': 'text', 'value': diff if len(diff) <= 1800 else diff[:1800] + '\n... (the whole diff is on the portal)', 'style': 'muted'})
    if blocked:
        kids.append({'type': 'badge', 'label': f"Blocked: {', '.join(blocked)}"[:120], 'variant': 'warning'})
    if changes:
        kids.append({'type': 'group', 'direction': 'row', 'children': [
            button('Keep', 'keep', primary=True, task=task_id), button('Undo', 'undo', task=task_id)]})
    return card('custom', {'root': {'type': 'section', 'title': f'Done: {title}'[:120], 'subtitle': task_id, 'children': kids}},
                ref=task_id if changes else None, actions=('keep', 'undo') if changes else ())


def blocked(agent_label, address, excerpt, kept):
    """An outside agent's reply carried instructions; the box dropped them. `excerpt` says what they tried, never the text."""
    kids = [badges('untrusted reply', 'instruction blocked', 'logged on the box', variant='warning'),
            {'type': 'text', 'value': f'Its reply {excerpt[:300]}. The exact text is in the box\'s log.', 'style': 'emphasis'}]
    if kept:
        kids.append({'type': 'text', 'value': f'Kept as data: {kept[:600]}'})
    return card('custom', {'root': {'type': 'section', 'title': f'Blocked an instruction from {agent_label}'[:120],
                                    'subtitle': address, 'children': kids}}, terminal=True)


def paid(what, amount, tx, explorer=None, simulated=False):
    """A payment the box made or received, in test FET."""
    rows = [{'label': 'For', 'value': what}, {'label': 'Amount', 'value': f'{amount} test FET (Fetch testnet, no value)'},
            {'label': 'Transaction', 'value': tx}]
    if explorer:
        rows.append({'label': 'Explorer', 'value': explorer})
    if simulated:
        rows.append({'label': 'Note', 'value': 'simulated: offline demo run'})
    return card('detail', {'title': 'Payment (test money)', 'summary_rows': rows,
                           'ctas': [{'label': 'OK', 'primary': True, 'selection': {'action': 'ok'}}]}, terminal=True)
