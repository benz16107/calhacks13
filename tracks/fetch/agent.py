#!/usr/bin/env python3
"""The box's agent on Agentverse. ASI:One finds it there and chats with it over the Agent Chat Protocol.

track.ts starts it on the box as an unprivileged user. It gets its messages through an Agentverse mailbox, so
the box needs no open port, and brain.py decides what each message does.
"""
import asyncio
import json
import os
import socket
import sys
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
from uagents_core.types import DeliveryStatus

from brain import STATE, Brain, BoxError

NAME = os.environ.get('FETCH_AGENT_NAME') or 'box'
DESCRIPTION = ('Runs your tasks on your own always-on box: each in its own copy of your files, with no keys, and '
               'only the network it needs. Asks for your OK before it spends, and can undo any task.')
HERE = os.path.dirname(os.path.abspath(__file__))

with socket.socket() as s:  # the agent's own small API, which only /connect below uses
    s.bind(('127.0.0.1', 0))
    PORT = s.getsockname()[1]
uagents.asgi.HOST = '127.0.0.1'  # a mailbox agent takes no inbound connections; keep its API off the network

agent = Agent(
    name=NAME,
    seed=os.environ['FETCH_AGENT_SEED'],
    port=PORT,
    mailbox=True,
    readme_path=os.path.join(HERE, 'agent.md'),
    description=DESCRIPTION,
    publish_agent_details=True,
)
brain = Brain(STATE)
chat = Protocol(spec=chat_protocol_spec)
busy = asyncio.Lock()  # one brain call at a time, in a thread, so the mailbox keeps polling meanwhile


def now():
    return datetime.now(timezone.utc)


def status(**fields):
    """What the box's ASI:One page shows."""
    out = {'address': agent.address, 'name': NAME, **fields}
    tmp = os.path.join(STATE, 'status.json.tmp')
    with open(tmp, 'w') as f:
        json.dump(out, f)
    os.replace(tmp, os.path.join(STATE, 'status.json'))


def card_metadata(card):
    # ASI:One Interactive Cards: https://innovationlab.fetch.ai/resources/docs/interactive-cards/asi-interactive-cards
    return {
        'card_protocol_version': '1',
        'requires_card_interaction': 'true',
        'card_kind': card['kind'],
        'card_payload': json.dumps(card['payload']),
    }


async def flush():
    """Send what the brain wrote. A message leaves the outbox only once it is sent, so a restart resends it."""
    async with busy:
        for m in list(brain.outbox):
            ctx = agent._build_context()
            # shortcut: a private field. uAgents 0.26 has no public way to send into a chat session from a timer,
            # and ASI:One groups messages into chats by session. Check it when upgrading uAgents.
            ctx._session = UUID(m['session'])
            content = [TextContent(type='text', text=m['text'])]
            if m.get('card'):
                content.append(MetadataContent(type='metadata', metadata=card_metadata(m['card'])))
            r = await ctx.send(m['to'], ChatMessage(timestamp=now(), msg_id=UUID(m['id']), content=content))
            if r.status == DeliveryStatus.FAILED:
                print(f'fetch: could not send to {m["to"]}, trying again: {r.detail}', file=sys.stderr)
                return
            brain.sent(m['id'])


@chat.on_message(ChatMessage)
async def on_chat(ctx: Context, sender: str, msg: ChatMessage):
    await ctx.send(sender, ChatAcknowledgement(timestamp=now(), acknowledged_msg_id=msg.msg_id))
    text = '\n'.join(c.text for c in msg.content if isinstance(c, TextContent))
    print(f'fetch: from {sender[:16]}... in {ctx.session}: {text[:200]!r}', file=sys.stderr)
    async with busy:
        await asyncio.to_thread(brain.on_message, sender, str(ctx.session), text)
    await flush()


@chat.on_message(ChatAcknowledgement)
async def on_ack(_ctx: Context, _sender: str, _msg: ChatAcknowledgement):
    pass


agent.include(chat, publish_manifest=True)


@agent.on_interval(period=1.0)
async def tick(_ctx: Context):
    if busy.locked():
        return  # a message is being handled; the next tick follows the tasks
    async with busy:
        try:
            await asyncio.to_thread(brain.tick)
        except (BoxError, OSError) as e:
            print(f'fetch: {e}', file=sys.stderr)
    await flush()


async def connect_mailbox():
    """What the Connect button in the Agentverse inspector does: call the agent's own /connect with the owner's key."""
    delay = 2
    while True:
        await asyncio.sleep(delay)
        try:
            body = {'user_token': os.environ.get('AGENTVERSE_API_KEY', ''), 'agent_type': 'mailbox'}
            async with aiohttp.ClientSession() as s, s.post(f'http://127.0.0.1:{PORT}/connect', json=body) as r:
                out = await r.json(content_type=None)
            if out.get('success'):
                return status(connected=True)
            status(connected=False, error=str(out.get('detail') or out))
        except Exception as e:  # the agent's own server may not be up yet
            status(connected=False, error=str(e))
        delay = min(delay * 2, 300)


@agent.on_event('startup')
async def startup(_ctx: Context):
    status(connected=False)
    asyncio.ensure_future(connect_mailbox())


if __name__ == '__main__':
    agent.run()
