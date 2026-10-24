#!/usr/bin/env python3
"""Run the box's agents in one process with no Agentverse, for tests. Standard library only.

The agents message each other directly. Anything they send to an address outside the team goes to stdout, and the
test writes messages from outside on stdin, one JSON object per line:
  in:  {"from": "<sender address>", "to": "box", "session": "...", "text": "..."}   (or "payment": {"type": ...})
  out: {"id", "from": "<agent name>", "to", "session", "text", "card"?: {...}, "payment"?: {...}}
The first line out is {"addresses": {name: address}}.
"""
import hashlib
import json
import os
import queue
import sys
import threading
import time

import host
from brain import call

STATE = os.environ.get('FETCH_STATE', '.')


def fake_address(name):
    return 'agent1q' + hashlib.sha256(f'local-{name}'.encode()).hexdigest()[:52]


def deliver(mind, sender, m):
    if m.get('payment'):
        p = dict(m['payment'])
        mind.on_payment(sender, m['session'], p.pop('type'), p)
    else:
        mind.on_message(sender, m['session'], m.get('text', ''), m.get('card'))


def main():
    tools = call('GET', '/health')['tools']
    team = host.roster(tools, test_agents=True)
    addresses = {n: fake_address(n) for n in ['box'] + [t[0] for t in team]}
    minds = host.build(STATE, addresses, team)
    by_address = {a: n for n, a in addresses.items()}
    print(json.dumps({'addresses': addresses}), flush=True)
    lines = queue.Queue()
    threading.Thread(target=lambda: [lines.put(json.loads(x)) for x in sys.stdin if x.strip()], daemon=True).start()
    while True:
        while not lines.empty():
            m = lines.get()
            deliver(minds[m.get('to', 'box')], m['from'], m)
        for name, mind in minds.items():
            mind.tick()
        moved = True
        while moved:  # messages between the agents land at once; the rest go out
            moved = False
            for name, mind in minds.items():
                for m in list(mind.outbox):
                    mind.sent(m['id'])
                    if m['to'] in by_address:
                        deliver(minds[by_address[m['to']]], mind.address, m)
                        moved = True
                    else:
                        print(json.dumps({**m, 'from': name}), flush=True)
        time.sleep(0.2)


if __name__ == '__main__':
    main()
