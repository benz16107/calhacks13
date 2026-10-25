"""The box's app agents: each GurtOS app with its own address on Agentverse. Standard library only.

Each is a Brain whose one owner is the box's own agent: the owner asks GurtOS in ASI:One, GurtOS routes the request
here over the chat protocol, and this agent starts the app's work on the box and reports back the same way, cards
included. Anyone else may reach an app agent directly on Agentverse too: the Shopper sells live price checks for test
FET through Fetch's Agent Payment Protocol, and the other two say they work only for their own box.
"""
import json
import re
import time
import urllib.parse

from brain import HOLD, WORKER, Brain, call, dollars, title

PRICE_FET = '0.05'  # one price check, paid by anyone; test FET on Fetch's testnet


class App(Brain):
    STRANGER = ''

    def __init__(self, state_dir, address='', box=''):
        super().__init__(state_dir, address)
        self.s['owners'] = [box] if box else []  # only the box's own agent gives it work

    def stranger(self, sender, session, text):
        self.say(sender, session, self.STRANGER)

    def follow(self, to, session, tid, task_title, budget):
        """Report on a task the app itself started, as if this agent had started it."""
        self.s['chats'][tid] = {'to': to, 'session': session, 'title': task_title, 'seq': 0, 'at': time.time(),
                                'wait': time.time() + HOLD, 'budget': budget, 'steps': []}


class Shopper(App):
    LABEL = 'GurtOS Shopper'
    STRANGER = (f'I am the shopper on someone\'s GurtOS box. Anyone can buy a live price check from me for {PRICE_FET} test FET '
                "(Fetch's testnet, no real value) through the Agent Payment Protocol: say \"price check\" and what to look up.")

    def request(self, sender, session, text):
        if WORKER == 'fake':  # tests: the GurtOS Test Store, no model
            return self.task(sender, session, {'title': title(text), 'worker': 'fake', 'workspace': 'guest', 'tools': ['shopper.checkPrice'],
                                               'budgetCents': 1, 'prompt': f'call shopper.checkPrice {json.dumps({"product": product(text)})}'}, price=True, query=product(text))
        t = call('POST', '/t/shopper/ask', {'text': text})  # Droid finds the product and sets up the watch; it cannot buy
        if t.get('error'):
            return self.say(sender, session, f"The shopper could not start: {t['error']}")
        self.follow(sender, session, t['id'], t['title'], t.get('budgetCents', 25))

    def stranger(self, sender, session, text):
        if re.search(r'\bprice\b|\bin stock\b|\bcost\b', text, re.I):
            return self.sell(sender, session, 'price', {'product': product(text)}, PRICE_FET, f'A live price check for "{product(text)}"')
        self.say(sender, session, self.STRANGER)

    def serve(self, ref, sale):
        tools = [x for x in call('GET', '/health')['tools'] if x in ('apify.checkPrice', 'shopper.checkPrice')]
        tool = 'apify.checkPrice' if 'apify.checkPrice' in tools and WORKER != 'fake' else 'shopper.checkPrice'
        args = {'product': sale['args']['product'], **({'max': 2} if tool == 'apify.checkPrice' else {})}
        self.task(sale['to'], sale['session'], {'title': f"Paid price check: {sale['args']['product']}"[:60], 'worker': 'fake',
                                                'workspace': 'guest', 'tools': [tool], 'budgetCents': 2, 'source': 'asi1:paid',
                                                'prompt': f'call {tool} {json.dumps(args)}'}, sale=ref, price=True, query=args['product'], wait=None)

    def done(self, tid, chat):
        if not chat.get('price'):
            return super().done(tid, chat)  # a watch Droid set up: its summary and diff
        out = self.tool_output(tid) or {}
        found = [p for p in out.get('products') or [] if matches(chat.get('query', ''), p.get('name', ''))]
        if not found:
            return self.reply(chat, f"{chat['title']}: nothing at {out.get('store', 'the store')} matched \"{chat.get('query', '')}\""
                                    + (' (its search returned only unrelated items).' if out.get('products') else '.'))
        lines = [f"- {p.get('name')}: {p.get('price')} {out.get('currency', '')}, {'in stock' if p.get('inStock') else 'not in stock'}"
                 for p in found[:3]]
        self.reply(chat, f"{chat['title']} at {out.get('store')}:\n" + '\n'.join(lines))


def matches(query, name):
    """Does a store's hit share most of what was asked for? A search for "hario v60 filters" once returned an RF filter."""
    stem = lambda w: w[:-1] if w.endswith('s') and len(w) > 3 else w
    words = {stem(w) for w in re.findall(r'[a-z0-9]{2,}', query.lower())} - {'the', 'and', 'for', 'with', 'pack', 'count'}
    have = {stem(w) for w in re.findall(r'[a-z0-9]{2,}', name.lower())}
    return not words or len(words & have) * 2 > len(words)


def product(text):
    """What to look up, from 'price check: airpods pro' or 'is the Hario V60 back in stock?'."""
    t = re.sub(r'(?i)\b(please|can you|could you|price check( for| of)?|check( if| the)?|is|are|the|back|in stock|price( of)?|for me|cost of|how much (is|are|does)|costs?)\b', ' ', text)
    return re.sub(r'[\s?:.!,]+', ' ', t).strip()[:100] or text[:100]


class Find(App):
    LABEL = 'GurtOS Find'
    STRANGER = 'I search one person\'s own photos and files, so I answer only their GurtOS box.'

    def request(self, sender, session, text):
        q = re.sub(r'(?i)^\s*(please\s+)?(find|where is|where\'s|look for|search for)\s+(me\s+)?(my\s+)?', '', text).strip(' ?.') or text
        hits = call('GET', f'/t/find/search?{urllib.parse.urlencode({"q": q, "k": 3})}')
        hits = hits.get('results', hits) if isinstance(hits, dict) else hits
        if not hits:
            return self.say(sender, session, f'Nothing on the box matches "{q}".')
        lines = []
        for h in hits[:3]:
            m = h.get('metadata', h)
            where = '/'.join(x for x in (m.get('workspace'), m.get('path')) if x) or m.get('task') or h.get('id', '')
            what = (m.get('description') or h.get('text') or '')[:160]
            lines.append(f'- {where}: {what}')
        self.say(sender, session, f'Found {len(hits[:3])} for "{q}":\n' + '\n'.join(lines))


class CreditDesk(App):
    LABEL = 'GurtOS Credit Desk'
    STRANGER = 'I run the credit desk of one company on its GurtOS box, so I take work only from that box.'

    def request(self, sender, session, text):
        # The scripted analyst seat: no model, but real CRS checks and the controller's sign-off on the fraud hold.
        r = call('POST', '/t/credit-desk/run', {'case': 'fogline-2026-10', 'seats': ['analyst'], 'scripted': True})
        tid = (r.get('tasks') or {}).get('analyst')
        if not tid:
            return self.say(sender, session, f"The credit desk could not start: {r.get('error', 'no analyst task')}")
        self.follow(sender, session, tid, 'Credit analyst on the Fogline case (scripted seat, live CRS)', 0)
        self.say(sender, session, f"Started the credit analyst on the Fogline Supply case (run {r['run']}): it checks each applicant "
                                  'with CRS, and asks the controller, you, before any fraud hold or large limit.')

    def done(self, tid, chat):
        events = call('GET', f'/tasks/{tid}')['events']
        decisions = [e['input'] for e in events if e['type'] == 'tool.call' and e['tool'] == 'credit-desk.credit_decision']
        seen = {}
        for d in decisions:
            seen[d.get('application_id')] = d
        lines = [f"- {k}: {d.get('outcome')}, limit {dollars(int(d.get('limit') or 0) * 100)}, {d.get('terms')}. {d.get('why', '')}" for k, d in seen.items()]
        self.reply(chat, 'The credit analyst finished:\n' + ('\n'.join(lines) or 'no decisions recorded') +
                   '\nThe whole run is in the Credit desk app on the box.')
