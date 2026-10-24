#!/usr/bin/env python3
"""The box's half of an ASI:One chat: it turns chat messages into box tasks, and task events into replies.

It talks only to the box's own HTTP API, the one the portal and the phone use, and keeps its state in
FETCH_STATE/state.json. Standard library only. agent.py carries its messages to and from ASI:One over
Agentverse. Run this file directly to carry them over stdin and stdout instead, one JSON object per line:
  in:  {"from": "<sender address>", "session": "<chat session id>", "text": "..."}
  out: {"id": "...", "to": "...", "session": "...", "text": "...", "card": {"kind": "review", "payload": {...}}}
"""
import json
import os
import queue
import re
import secrets
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from urllib.parse import quote

API = os.environ.get('BOX_API', 'http://127.0.0.1:7700')
STATE = os.environ.get('FETCH_STATE', '.')
WORKER = os.environ.get('FETCH_WORKER', 'droid')  # 'fake' runs the chat text itself as a scripted task, for tests
WORKSPACE = os.environ.get('FETCH_WORKSPACE', 'project')
TOOLS = os.environ.get('FETCH_TOOLS')  # comma separated; by default every apify.* tool the box has
HOLD = float(os.environ.get('FETCH_HOLD', '40'))  # seconds to wait for news before replying "still working"
BUDGET_CENTS = 25  # tool spending above this waits for the owner's OK
MAX_WRONG = 10  # wrong pairing codes the box takes in a minute, from everyone together
BY = 'asi1'  # how the box's log names answers given in the chat

PROMPT = """{text}

This request came from the box's owner, in an ASI:One chat. Do the work yourself. You work in your own copy of
the "{workspace}" workspace and have no internet of your own: for web work, use the box tools you have{web}.
Use box_ask only to get an OK before something risky or costly, never to ask the owner for information.
Finish with two or three plain sentences for the chat: what you found, or what you changed and how you checked it."""

STRANGER = ("I run tasks on someone's own box, and I take work only from its owner. If this is your box, send me "
            "the pairing code from its screen (the ASI:One page on its portal), like this: pair 123456")

_open = urllib.request.build_opener(urllib.request.ProxyHandler({})).open  # the box's API is local: never proxy it


class BoxError(Exception):
    pass


def call(method, path, body=None):
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(API + path, data=data, method=method, headers={'content-type': 'application/json'})
    try:
        with _open(req, timeout=15) as r:
            return json.loads(r.read() or b'null')
    except urllib.error.HTTPError as e:
        try:
            detail = json.loads(e.read()).get('error')
        except ValueError:
            detail = None
        raise BoxError(detail or f'HTTP {e.code} from {path}') from None


def answer(approval_id, approved):
    # The box decodes the id in the path, so an id with spaces (from Droid's own questions) works here too.
    # This is a call from the box's own machine, so the box takes the name in `by` as given.
    return call('POST', f'/approvals/{quote(approval_id, safe="")}', {'approved': approved, 'by': BY})


def new_code():
    return f'{secrets.randbelow(10 ** 6):06d}'


def dollars(cents):
    return f'${cents / 100:.2f}' if cents >= 1 or cents == 0 else f'${cents / 100:.4f}'


def title(text):
    first = re.split(r'(?<=[.!?])\s|\n', text.strip(), maxsplit=1)[0].strip()
    first = re.sub(r'^(please|can you|could you)\s+', '', first, flags=re.I)
    first = first[:1].upper() + first[1:]
    return first if len(first) <= 60 else first[:57] + '...'


def step_text(text):
    """A Droid step, 'Execute {"command": ...}', as a short line for the chat."""
    m = re.match(r'(\w+) (\{.*)', text, re.S)
    if not m:
        return text[:160]
    tool = re.sub(r'^box___', '', m.group(1)).replace('__', '.')  # a box tool through the MCP relay: box___apify__run
    if tool == 'TodoWrite':
        doing = re.search(r'\[in_progress\] (.+?)(?:\\n|"|$)', m.group(2))
        return f'working on: {doing.group(1)}' if doing else 'updated its plan'
    arg = re.search(r'"(?:command|file_path|path|pattern|url|query)"\s*:\s*"((?:[^"\\]|\\.){1,100})', m.group(2))
    return f'{tool} {arg.group(1)}' if arg else tool


SORT = ("You sort messages sent to an agent that runs tasks on its owner's computer. Reply with one word. "
        "'status' if the message checks on work already asked for: how it is going, whether it is done, or its result. "
        "'new' if it asks for new work. Tasks already asked for:\n{titles}")
# The fallback when ASI:One cannot answer. ASI:One's planner checks on a task like this: "Status check: how is it going?"
STATUS = re.compile(r"\bstatus (check|update)\b|\bhow(?:'s| is| are)\b.*\bgoing\b|\b(is it|has it) (done|finished|completed)\b")


def asks_status(text, titles):
    """Does this check on earlier work, or ask for new work? ASI:One's own model decides."""
    key = os.environ.get('ASI_ONE_API_KEY')
    if key:
        body = {'model': 'asi1-mini', 'temperature': 0, 'max_tokens': 5, 'messages': [
            {'role': 'system', 'content': SORT.format(titles='\n'.join(f'- {t}' for t in titles))},
            {'role': 'user', 'content': text[:2000]}]}
        req = urllib.request.Request('https://api.asi1.ai/v1/chat/completions', data=json.dumps(body).encode(), method='POST',
                                     headers={'authorization': f'Bearer {key}', 'content-type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                return 'status' in json.loads(r.read())['choices'][0]['message']['content'].lower()
        except (OSError, ValueError, KeyError, IndexError) as e:
            print(f'fetch: ASI:One could not sort a message, so a keyword rule did: {e}', file=sys.stderr)
    return bool(STATUS.search(text.lower()))


def selection(text):
    """A click on one of our cards. A direct chat sends the card's selection as JSON."""
    try:
        sel = json.loads(text)
    except ValueError:
        return None
    return sel if isinstance(sel, dict) and sel.get('action') else None


VERDICTS = [('undo', r'undo|revert|roll ?back'), ('keep', r'keep'),
            ('deny', r"den(y|ied)|reject(ed)?|declined?|cancel(l?ed)?|(not|n't) (approve|confirm|accept)"),
            ('approve', r'approved?|confirm(ed)?|accept(ed)?|yes|ok(ay)?|go ahead')]


def verdict(text):
    """approve, deny, undo or keep. The first word decides ("Yes, no problem"), else the first rule that matches."""
    t = text.lower()
    for word, pattern in VERDICTS:
        if re.match(rf'\W*({pattern})\b', t):
            return word
    if re.match(r'\W*no\b', t):
        return 'deny'
    return next((word for word, pattern in VERDICTS if re.search(rf'\b({pattern})\b', t)), None)


def approval_card(a, task_title):
    rows = [{'label': 'Task', 'value': task_title}, {'label': 'Asks', 'value': a['question']}]
    if a.get('costCents'):
        rows.append({'label': 'Cost', 'value': dollars(a['costCents'])})
    return {'kind': 'review', 'payload': {
        'title': 'Approve this?',
        'summary_rows': rows,
        'approve_cta': {'label': 'Approve', 'primary': True, 'selection': {'action': 'approve', 'approval': a['id']}},
        'reject_cta': {'label': 'Deny', 'selection': {'action': 'deny', 'approval': a['id']}},
    }}


def undo_card(task_id, task_title, changed):
    return {'kind': 'review', 'payload': {
        'title': 'Keep these changes?',
        'summary_rows': [{'label': 'Task', 'value': task_title}, {'label': 'Changed', 'value': changed}],
        'approve_cta': {'label': 'Keep', 'primary': True, 'selection': {'action': 'keep', 'task': task_id}},
        'reject_cta': {'label': 'Undo', 'selection': {'action': 'undo', 'task': task_id}},
    }}


class Brain:
    def __init__(self, state_dir=STATE):
        self.file = os.path.join(state_dir, 'state.json')
        try:
            with open(self.file) as f:
                self.s = json.load(f)
        except FileNotFoundError:
            self.s = {'owners': [], 'code': new_code(), 'wrong': [], 'chats': {}, 'outbox': [], 'cards': {}}
            self.save()

    def save(self):
        tmp = self.file + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(self.s, f)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, self.file)

    # ---------- the outbox: replies wait here until the transport has sent them, across restarts ----------

    @property
    def outbox(self):
        return self.s['outbox']

    def sent(self, msg_id):
        self.s['outbox'] = [m for m in self.outbox if m['id'] != msg_id]
        self.save()

    def say(self, to, session, text, card=None):
        msg = {'id': str(uuid.uuid4()), 'to': to, 'session': session, 'text': text}
        if card:
            msg['card'] = card
            yes, no = card['payload']['approve_cta']['selection'], card['payload']['reject_cta']['selection']
            self.s['cards'][session] = {'ref': yes.get('approval') or yes.get('task'), 'actions': [yes['action'], no['action']]}
        self.outbox.append(msg)

    def forget(self, ref):
        """A card's question was answered, here or anywhere else: later messages are not about it."""
        self.s['cards'] = {k: v for k, v in self.s['cards'].items() if v['ref'] != ref}

    def reply(self, chat, text, card=None):
        """Write in a task's chat. Any message about it answers the person's last message, so stop holding."""
        self.say(chat['to'], chat['session'], text, card)
        chat['wait'] = None

    # ---------- messages from the chat ----------

    def on_message(self, sender, session, text):
        text = (text or '').strip()
        if not text:
            return
        try:
            if sender not in self.s['owners']:
                self.stranger(sender, session, text)
            elif sel := selection(text):
                self.act(sender, session, sel['action'], sel.get('approval') or sel.get('task'))
            else:
                self.owner(sender, session, text)
        except (BoxError, OSError) as e:
            self.say(sender, session, f'The box could not do that: {e}')
        self.save()

    def stranger(self, sender, session, text):
        if 'pair' not in text.lower():
            return self.say(sender, session, STRANGER)
        now = time.time()
        self.s['wrong'] = [x for x in self.s['wrong'] if x > now - 60]
        if len(self.s['wrong']) >= MAX_WRONG:
            return self.say(sender, session, 'Too many wrong codes just now. Try again in a minute.')
        code = re.search(r'\b(\d{6})\b', text)
        if code and code.group(1) == self.s['code']:
            self.s['owners'].append(sender)
            self.s['code'] = new_code()  # the code on the screen works once
            return self.say(sender, session, 'Paired. This box now takes work from you here. Tell me what to do, for '
                                             'example "fix the failing test in my project".')
        self.s['wrong'].append(now)
        self.say(sender, session, "That is not the code on the box's screen.")

    def mine(self, sender):
        """This person's chat tasks, newest first."""
        chats = [(tid, c) for tid, c in self.s['chats'].items() if c['to'] == sender]
        return sorted(chats, key=lambda x: x[1]['at'], reverse=True)

    def owner(self, sender, session, text):
        t = text.lower().strip()
        mine = self.mine(sender)
        word = verdict(t)
        # ASI:One's planner relays a card click in its own words ("The user approved the card interaction you
        # requested"), without the selection. It is about the last card still open in this chat.
        last = self.s['cards'].get(session)
        if last and word in last['actions'] and (last['ref'] in text or 'card' in t):
            return self.act(sender, session, word, last['ref'])
        pending = [a for a in call('GET', '/approvals?state=pending') if a['task'] in dict(mine)]  # this person's own
        named = next((a['id'] for a in pending if a['id'] in text), None)
        if named and word in ('approve', 'deny'):
            return self.act(sender, session, word, named)
        named = next((tid for tid, _ in mine if tid in text), None)
        if named and word in ('undo', 'keep'):
            return self.act(sender, session, word, named)
        if re.fullmatch(r'\W*(yes|ok|okay|approve[d]?|go ahead|confirm|no|deny|reject|cancel)\W*', t):
            if not pending:
                return self.say(sender, session, 'Nothing from you is waiting for an OK.')
            if len(pending) == 1:
                return self.act(sender, session, word, pending[0]['id'])
            for a in pending:
                self.say(sender, session, 'This is waiting for your OK:', approval_card(a, self.task_title(a['task'])))
            return
        if re.fullmatch(r'\W*undo( it| that)?\W*', t):
            done = next((tid for tid, c in mine if c.get('state') == 'done'), None)
            if not done:
                return self.say(sender, session, 'There is no finished task from you to undo.')
            return self.act(sender, session, 'undo', done)
        if re.fullmatch(r"\W*(what'?s the )?(status|progress)\W*", t) or (mine and asks_status(text, [c['title'] for _, c in mine[:5]])):
            here = {tid: c for tid, c in self.s['chats'].items() if c['session'] == session and not c.get('closed')}
            a = next((a for a in pending if a['task'] in here), None)
            if a:  # it is waiting for the OK, so show the card again
                return self.reply(here[a['task']], f"Waiting for your OK: {a['question']}", approval_card(a, here[a['task']]['title']))
            for chat in here.values():
                chat['wait'] = time.time() + HOLD  # answer with the task's next news, or "still working"
            return None if here else self.status(sender, session)
        self.start(sender, session, text)

    def act(self, sender, session, action, ref):
        ref = str(ref or '')
        self.forget(ref)
        # The box takes this process for its own screen, so the chat must hold itself to its own tasks.
        mine = dict(self.mine(sender))
        if action in ('approve', 'deny'):
            a = next((x for x in call('GET', '/approvals') if x['id'] == ref and x['task'] in mine), None)
            if not a:
                return self.say(sender, session, 'That is not a request from one of your chat tasks.')
            if a['state'] != 'pending':
                return self.say(sender, session, f"That was already {a['state']} ({a.get('by') or 'on the box'}).")
            answer(a['id'], action == 'approve')
            chat = self.s['chats'].get(a['task'])
            if chat and action == 'approve':
                # What happens next is the reply to this click, in the chat it came from.
                chat.update(to=sender, session=session, wait=time.time() + HOLD)
            else:
                self.say(sender, session, 'Approved. The task carries on.' if action == 'approve' else 'Denied. The task will not do that.')
            return
        if action in ('undo', 'keep'):
            if ref not in mine:
                return self.say(sender, session, 'That is not one of your chat tasks.')
            if action == 'keep':
                return self.say(sender, session, 'Kept. Its changes stay in the workspace; you can still undo it from the portal.')
            t = call('POST', f'/tasks/{ref}/undo')
            chat = self.s['chats'].get(ref)
            if chat:
                chat.update(closed=True, state='undone')
            return self.say(sender, session, f"Undone: {t['title']}. Its changes are gone, and other tasks keep theirs.")
        self.say(sender, session, f'I do not know the action "{action}".')

    def start(self, sender, session, text):
        tools = TOOLS.split(',') if TOOLS is not None else [x for x in call('GET', '/health')['tools'] if x.startswith('apify.')]
        web = (': for a web search, apify.run with actor "apify/rag-web-browser" and input {"query": "...", "maxResults": 3}. '
               'Each search costs money and waits for the owner\'s OK, so make one and answer from what it found') if 'apify.run' in tools else ''
        prompt = text if WORKER == 'fake' else PROMPT.format(text=text, workspace=WORKSPACE, web=web)
        spec = {'title': title(text), 'prompt': prompt, 'workspace': WORKSPACE, 'worker': WORKER,
                'tools': [x for x in tools if x], 'hosts': [], 'budgetCents': BUDGET_CENTS, 'source': BY}
        t = call('POST', '/tasks', spec)
        self.s['chats'][t['id']] = {'to': sender, 'session': session, 'title': t['title'], 'seq': 0,
                                    'at': time.time(), 'wait': time.time() + HOLD}

    def task_title(self, task_id):
        chat = self.s['chats'].get(task_id)
        return chat['title'] if chat else call('GET', f'/tasks/{task_id}')['task']['title']

    def status(self, sender, session):
        mine = self.mine(sender)[:5]
        if not mine:
            return self.say(sender, session, 'No tasks from you yet. Tell me what to do, for example "fix the failing test in my project".')
        lines = []
        for tid, _ in mine:
            t = call('GET', f'/tasks/{tid}')['task']
            now = f" Now: {step_text(t['step'])}" if t.get('step') and t['state'] in ('running', 'waiting') else ''
            lines.append(f"- {t['title']} ({tid}): {t['state']}, {dollars(t['costCents'])}.{now}")
        text = 'Your latest tasks on the box:\n' + '\n'.join(lines)
        # One message: ASI:One's planner takes one reply per message it sends. The portal lists any other OKs.
        a = next((a for a in call('GET', '/approvals?state=pending') if a['task'] in dict(mine)), None)
        if a:
            return self.say(sender, session, f"{text}\n\nWaiting for your OK: {a['question']}", approval_card(a, self.task_title(a['task'])))
        self.say(sender, session, text)

    # ---------- task events, polled from the box's log ----------

    def tick(self):
        changed = False
        for tid, chat in self.s['chats'].items():
            if chat.get('closed'):
                continue
            try:
                events = call('GET', f"/log?after={chat['seq']}&task={tid}")
                for e in events:
                    self.event(tid, chat, e)
                    chat['seq'] = e['seq']
                    changed = True
                if chat.get('wait') and time.time() > chat['wait'] and not chat.get('closed'):
                    step = f" The latest step: {chat['step']}" if chat.get('step') else ''
                    self.reply(chat, f"Still working on {chat['title']} ({tid}).{step} I will write here when it is "
                                     "done, or ask me for the status.")
                    changed = True
            except (BoxError, OSError) as e:
                print(f'fetch: could not follow task {tid}: {e}', file=sys.stderr)
        if changed:
            self.save()

    def event(self, tid, chat, e):
        kind = e['type']
        if kind == 'task.step':
            data = e.get('data') or {}
            if data.get('summary'):
                chat['summary'] = e['text']
            elif not data.get('session'):
                chat['step'] = step_text(e['text'])
        elif kind == 'net.blocked':
            hosts = chat.setdefault('blocked', [])
            if e['host'] not in hosts and len(hosts) < 5:
                hosts.append(e['host'])
        elif kind == 'approval.asked':
            a = e['approval']
            self.reply(chat, f"Paused for your OK: {a['question']} Approve or deny here, or on the box's portal or "
                             'your phone.', approval_card(a, chat['title']))
        elif kind == 'approval.answered':
            self.forget(e['id'])
            if e['by'] in (BY, 'undo'):
                return
            where = {'phone': 'your phone', 'portal': 'the portal'}.get(e['by'], e['by'])
            self.reply(chat, f"Approved on {where}. The task carries on." if e['approved'] else f'Denied on {where}.')
        elif kind == 'task.state' and e['state'] in ('done', 'failed', 'undone'):
            if e['state'] == 'done':
                self.result(tid, chat)  # if the box does not answer, the next tick tries this event again
            elif e['state'] == 'failed':
                self.reply(chat, f"{chat['title']} failed: {e.get('error') or 'no reason given'}. The box kept none of its changes.")
            else:
                self.forget(tid)
                self.reply(chat, f"Undone: {chat['title']}. Its changes are gone, and other tasks keep theirs.")
            chat['closed'] = True
            chat['state'] = e['state']

    def result(self, tid, chat):
        t = call('GET', f'/tasks/{tid}')['task']
        d = call('GET', f'/tasks/{tid}/diff')
        parts = [f"Done: {chat['title']} ({tid}, {dollars(t['costCents'])})."]
        if chat.get('summary'):
            parts.append(chat['summary'][-1500:])
        card = None
        if d['changes']:
            changed = ', '.join(f"{x['change']} {x['path']}" for x in d['changes'][:10])
            diff = d['diff'] if len(d['diff']) <= 2500 else d['diff'][:2500] + '\n... (the whole diff is on the portal)'
            parts += [f'Changed: {changed}', f'```diff\n{diff}\n```']
            card = undo_card(tid, chat['title'], changed)
        if chat.get('blocked'):
            parts.append(f"The box blocked its connections to {', '.join(chat['blocked'])}, which were not on its list.")
        self.reply(chat, '\n\n'.join(parts), card)


def main():
    """Carry the chat over stdin and stdout, for tests."""
    brain = Brain()
    lines = queue.Queue()
    threading.Thread(target=lambda: [lines.put(json.loads(l)) for l in sys.stdin if l.strip()], daemon=True).start()
    while True:
        while not lines.empty():
            m = lines.get()
            brain.on_message(m['from'], m['session'], m['text'])
        brain.tick()
        for m in list(brain.outbox):
            print(json.dumps(m), flush=True)
            brain.sent(m['id'])
        time.sleep(0.2)


if __name__ == '__main__':
    main()
