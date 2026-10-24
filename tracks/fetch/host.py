"""Which agents a box runs, and how each one's mind is built. Standard library only.

agent.py runs them on Agentverse; local.py runs them in one process for tests. The box's own agent keeps the base
seed, so its address never changes. The others derive theirs from it, so each box has its own team.
"""
import os

import testagents as T
from apps import CreditDesk, Find, Shopper
from brain import Box

# name, label on Agentverse, words that name it in a chat, class, the box tool that shows its app is on
APPS = [
    ('shopper', 'GurtOS Shopper', ['shopper'], Shopper, 'shopper.checkPrice'),
    ('find', 'GurtOS Find', ['find agent'], Find, 'find.search'),
    ('credit-desk', 'GurtOS Credit Desk', ['credit desk'], CreditDesk, 'credit-desk.crs'),
]
TESTS = [
    ('test-weather', 'GurtOS test weather (trap)', ['test weather', 'trap agent'], T.TestWeather),
    ('test-oracle', 'GurtOS test oracle (paid)', ['test oracle', 'oracle'], T.TestOracle),
    ('test-buyer', 'GurtOS test buyer', ['test buyer'], T.TestBuyer),
]
DESCRIPTIONS = {
    'box': ('Runs your tasks on your own computer with GurtOS: each in its own Linux user and copy of your files, with no '
            'keys and only the network it needs. Asks before it spends, screens other agents\' replies, can undo any task.'),
    'shopper': 'GurtOS\'s shopper: price watches for its owner, and live price checks for anyone, paid in test FET.',
    'find': 'GurtOS\'s memory: finds its owner\'s photos, files and past tasks by what is in them. Works for its own box only.',
    'credit-desk': 'GurtOS\'s credit desk: a credit analyst with live CRS checks and a human controller. Works for its own box only.',
    'test-weather': 'A GurtOS TEST agent: answers with the weather and a hidden instruction, to show GurtOS blocking it.',
    'test-oracle': 'A GurtOS TEST agent: sells a one-line fortune for 0.5 test FET (Fetch testnet) through the Payment Protocol.',
    'test-buyer': 'A GurtOS TEST agent: buys a price check from GurtOS Shopper with its own test FET.',
}


def roster(tools, test_agents):
    """[(name, label, aliases, cls)] for the apps that are on, plus the test agents when asked for."""
    apps = [(n, label, al, cls) for n, label, al, cls, tool in APPS if tool in tools]
    return apps + ([(n, label, al, cls) for n, label, al, cls in TESTS] if test_agents else [])


def build(state, addresses, team, name='GurtOS'):
    """{name: mind}. `addresses` has the box's ('box') and each of `team`'s."""
    agents = {n: {'address': addresses[n], 'label': label, 'aliases': al, 'ours': not n.startswith('test-')} for n, label, al, _ in team}
    minds = {'box': Box(state, addresses['box'], agents=agents)}
    minds['box'].LABEL = name
    for n, _, _, cls in team:
        folder = os.path.join(state, n)
        if cls is T.TestBuyer:
            minds[n] = cls(folder, addresses[n], shopper=addresses.get('shopper', ''))
        elif n.startswith('test-'):
            minds[n] = cls(folder, addresses[n])
        else:
            minds[n] = cls(folder, addresses[n], box=addresses['box'])
    return minds
