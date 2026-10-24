#!/usr/bin/env python3
"""The box's agents on Agentverse: GurtOS itself, one agent per app, and (when asked for) three test agents.

track.ts starts this on the box as an unprivileged user. GurtOS and its app agents each have their own address and take
their messages through their own Agentverse mailbox, so the box needs no open port. The test agents stand in for
strangers' agents: they listen on this machine only (an endpoint on 127.0.0.1, found through the Almanac), so they take
no Agentverse places (a free account has eight). All of them speak the Agent Chat Protocol (with ASI:One Interactive
Cards) and Fetch's Agent Payment Protocol. Each runs in its own thread with its own event loop, in one process. The
minds in brain.py, apps.py and testagents.py decide what each message does; this file only carries messages.
"""
import asyncio
import json
import os
import signal
import socket
import sys
import threading
from datetime import datetime, timezone
from uuid import UUID

import aiohttp
import uagents.asgi
from uagents import Agent, Context, Protocol
from uagents_core.contrib.protocols.chat import (
    ChatAcknowledgement,
    ChatMessage,
    MetadataContent,
    TextContent,
    chat_protocol_spec,
)
from uagents_core.contrib.protocols.chat.cards import extract_card, extract_card_response
from uagents_core.contrib.protocols.payment import (
    CancelPayment,
    CommitPayment,
    CompletePayment,
    RejectPayment,
    RequestPayment,
    payment_protocol_spec,
)
from uagents_core.types import DeliveryStatus

import host
from brain import BoxError, call

STATE = os.environ.get('FETCH_STATE', '.')
SEED = os.environ['FETCH_AGENT_SEED']
NAME = os.environ.get('FETCH_AGENT_NAME') or 'GurtOS'
TEST_AGENTS = os.environ.get('FETCH_TEST_AGENTS') == '1'
HERE = os.path.dirname(os.path.abspath(__file__))
PAYMENTS = {m.__name__: m for m in (RequestPayment, CommitPayment, CompletePayment, CancelPayment, RejectPayment)}

uagents.asgi.HOST = '127.0.0.1'  # mailbox agents take no inbound connections; keep their small APIs off the network
signal.signal(signal.SIGTERM, lambda *_: os._exit(0))  # the outboxes are on disk; a stop needs no shutdown dance


def now():
    return datetime.now(timezone.utc)


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def card_metadata(card):
    # ASI:One Interactive Cards: https://innovationlab.fetch.ai/resources/docs/interactive-cards/asi-interactive-cards
    meta = {'card_protocol_version': '1', 'requires_card_interaction': 'true', 'card_kind': card['kind'],
            'card_payload': json.dumps(card['payload'])}
    if card.get('terminal'):
        meta['is_terminal'] = 'true'  # it informs; no click expected
    return meta


def read(msg):
    """(text, card) from a chat message. A card click comes back as JSON text or as a card response block."""
    text, card = [], None
    for c in msg.content:
        if isinstance(c, TextContent):
            text.append(c.text)
        elif isinstance(c, MetadataContent):
            response = extract_card_response(c)
            if response and response.selection:
                text.append(json.dumps(response.selection))
            elif response and response.text:
                text.append(response.text)
            elif (found := extract_card(c)) is not None:  # validated against the card schemas
                card = {'kind': c.metadata['card_kind'], 'payload': json.loads(c.metadata['card_payload']), 'terminal': found.is_terminal}
    return '\n'.join(text), card


# ---------- the team ----------

tools = call('GET', '/health')['tools']
team = host.roster(tools, TEST_AGENTS)
agents, ports, loops, labels = {}, {}, {}, {'box': NAME, **{t[0]: t[1] for t in team}}
local = {t[0] for t in team if t[0].startswith('test-')}  # endpoint on 127.0.0.1, no Agentverse place
for name in ['box'] + [t[0] for t in team]:
    ports[name], loops[name] = free_port(), asyncio.new_event_loop()
    readme = os.path.join(HERE, 'profiles', f'{name}.md')
    agents[name] = Agent(name=labels[name], seed=SEED if name == 'box' else f'{SEED}/{name}', port=ports[name],
                         mailbox=name not in local, endpoint=[f'http://127.0.0.1:{ports[name]}/submit'] if name in local else None,
                         loop=loops[name], readme_path=readme if os.path.exists(readme) else None,
                         description=host.DESCRIPTIONS[name], publish_agent_details=name not in local)
minds = host.build(STATE, {n: a.address for n, a in agents.items()}, team, NAME)
busy = {n: asyncio.Lock() for n in agents}  # one call into a mind at a time, in a thread; its agent keeps polling meanwhile
status_lock = threading.Lock()
connected = {}


def status(**fields):
    """What the box's ASI:One page shows: every agent's name, address and mailbox."""
    with status_lock:
        out = {'address': agents['box'].address, 'name': NAME, **fields,
               'agents': [{'name': n, 'label': labels[n], 'address': a.address, 'connected': n in local or connected.get(n, False),
                           'where': 'this machine (Almanac)' if n in local else 'Agentverse mailbox'} for n, a in agents.items()]}
        tmp = os.path.join(STATE, 'status.json.tmp')
        with open(tmp, 'w') as f:
            json.dump(out, f)
        os.replace(tmp, os.path.join(STATE, 'status.json'))


async def flush(name):
    """Send what a mind wrote. A message leaves the outbox only once it is sent, so a restart resends it."""
    agent, mind = agents[name], minds[name]
    async with busy[name]:
        for m in list(mind.outbox):
            ctx = agent._build_context()
            # shortcut: a private field. uAgents 0.26 has no public way to send into a chat session from a timer,
            # and ASI:One groups messages into chats by session. Check it when upgrading uAgents.
            ctx._session = UUID(m['session'])
            if m.get('payment'):
                fields = dict(m['payment'])
                msg = PAYMENTS[fields.pop('type')](**fields)
            else:
                content = [TextContent(type='text', text=m['text'])]
                if m.get('card'):
                    content.append(MetadataContent(type='metadata', metadata=card_metadata(m['card'])))
                msg = ChatMessage(timestamp=now(), msg_id=UUID(m['id']), content=content)
            r = await ctx.send(m['to'], msg)
            if r.status == DeliveryStatus.FAILED:
                print(f'fetch: {name} could not send to {m["to"]}, trying again: {r.detail}', file=sys.stderr)
                return
            mind.sent(m['id'])


def wire(name):
    agent, mind = agents[name], minds[name]
    chat = Protocol(spec=chat_protocol_spec)

    @chat.on_message(ChatMessage)
    async def on_chat(ctx: Context, sender: str, msg: ChatMessage):
        await ctx.send(sender, ChatAcknowledgement(timestamp=now(), acknowledged_msg_id=msg.msg_id))
        text, card = read(msg)
        print(f'fetch: {name} from {sender[:16]}... in {ctx.session}: {text[:200]!r}', file=sys.stderr)
        async with busy[name]:
            await asyncio.to_thread(mind.on_message, sender, str(ctx.session), text, card)
        await flush(name)

    @chat.on_message(ChatAcknowledgement)
    async def on_ack(_ctx: Context, _sender: str, _msg: ChatAcknowledgement):
        pass

    # Fetch's Agent Payment Protocol: every agent can sell (CommitPayment in) and buy (RequestPayment in).
    seller = Protocol(spec=payment_protocol_spec, role='seller')
    buyer = Protocol(spec=payment_protocol_spec, role='buyer')

    async def on_payment(ctx: Context, sender: str, msg):
        print(f'fetch: {name} payment {type(msg).__name__} from {sender[:16]}...', file=sys.stderr)
        async with busy[name]:
            await asyncio.to_thread(mind.on_payment, sender, str(ctx.session), type(msg).__name__, json.loads(msg.model_dump_json()))
        await flush(name)

    for proto, models in ((seller, (CommitPayment, RejectPayment)), (buyer, (RequestPayment, CancelPayment, CompletePayment))):
        for model in models:
            proto.on_message(model)(on_payment)
    agent.include(chat, publish_manifest=True)
    agent.include(seller, publish_manifest=True)
    agent.include(buyer, publish_manifest=True)

    @agent.on_interval(period=1.0)
    async def tick(_ctx: Context):
        if busy[name].locked():
            return  # a message is being handled; the next tick follows the tasks
        async with busy[name]:
            try:
                await asyncio.to_thread(mind.tick)
            except (BoxError, OSError) as e:
                print(f'fetch: {name}: {e}', file=sys.stderr)
        await flush(name)

    @agent.on_event('startup')
    async def startup(_ctx: Context):
        if name not in local:
            asyncio.ensure_future(connect_mailbox(name))
        if name == 'test-buyer':
            asyncio.ensure_future(asyncio.to_thread(mind.fund))


async def connect_mailbox(name):
    """What the Connect button in the Agentverse inspector does: call the agent's own /connect with the owner's key."""
    delay = 2
    while True:
        await asyncio.sleep(delay)
        try:
            body = {'user_token': os.environ.get('AGENTVERSE_API_KEY', ''), 'agent_type': 'mailbox'}
            async with aiohttp.ClientSession() as s, s.post(f'http://127.0.0.1:{ports[name]}/connect', json=body) as r:
                out = await r.json(content_type=None)
            if out.get('success'):
                connected[name] = True
                return status(connected=connected.get('box', False))
            status(connected=connected.get('box', False), error=f"{labels[name]}: {out.get('detail') or out}")
        except Exception as e:  # the agent's own server may not be up yet
            status(connected=connected.get('box', False), error=f'{labels[name]}: {e}')
        delay = min(delay * 2, 300)


for n in agents:
    wire(n)

def run(name):
    """One agent on its own event loop. If it ever stops, the whole process exits, and the box starts it again."""
    asyncio.set_event_loop(loops[name])
    try:
        loops[name].run_until_complete(agents[name].run_async())
    except BaseException as e:
        print(f'fetch: {name} stopped: {e!r}', file=sys.stderr)
    os._exit(1)


if __name__ == '__main__':
    status(connected=False)
    for n in agents:
        threading.Thread(target=run, args=(n,), daemon=True, name=n).start()
    threading.Event().wait()
