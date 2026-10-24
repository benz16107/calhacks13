#!/usr/bin/env python3
"""Test-FET payments on Fetch's Dorado testnet, for the box. Test money with no value.

The core (wallet.ts) runs this as a command. The key comes from the environment (FETCH_WALLET_KEY, 64 hex
characters), never from arguments, and is never printed. Every command prints one JSON line and exits 0, or
prints {"error": "..."} and exits 1.

  pay.py address
  pay.py balance
  pay.py fund                          the faucet, only when the balance is under 1 FET
  pay.py send <to> <amount_fet> <memo>
  pay.py verify <tx> <to> <amount_fet> [memo]
  pay.py find <to> <amount_fet> <memo> an earlier send of this wallet, if one is on the chain

Amounts in and out are FET as decimal strings. The chain counts atestfet: 1 FET = 10**18.
With FETCH_LEDGER=offline nothing touches the network: sends go to $FETCH_STATE/ledger.json and the
addresses are fake (fetch1test...). Plain python3 is enough then; live mode needs cosmpy (the track's venv).
"""
import fcntl
import hashlib
import json
import os
import re
import sys
from decimal import Decimal, getcontext

getcontext().prec = 80
DENOM = 'atestfet'
FET = 10**18
LOW = FET  # fund only under 1 FET
GAS_RESERVE = FET // 100  # a send costs about 0.0005 FET
OFFLINE_START = 100 * FET
NETWORK = 'Fetch Dorado testnet'
B32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'  # bech32 letters
# The block explorer at explore-dorado.fetch.ai stopped indexing (2.4M blocks behind on 2026-10-24), so link the raw tx.
TX_URL = 'https://rest-dorado.fetch.ai/cosmos/tx/v1beta1/txs/'


def offline():
    return os.environ.get('FETCH_LEDGER') == 'offline'


def to_atto(amount_fet):
    d = Decimal(str(amount_fet).strip())
    if not d.is_finite() or d <= 0:
        raise ValueError('amount must be a positive number of FET')
    atto = d.scaleb(18)
    if atto != atto.to_integral_value():
        raise ValueError('amount has more than 18 decimal places')
    return int(atto)


def fmt(atto):
    return format(Decimal(atto).scaleb(-18).normalize(), 'f')


def check_address(addr):
    if not re.fullmatch('fetch1[%s]{38}' % B32, addr):
        raise ValueError('not a Fetch address (fetch1 and 38 letters)')
    return addr


def new_key():
    return os.urandom(32).hex()


def _bytes(key_hex):
    if len(key_hex) != 64:
        raise ValueError('wallet key must be 64 hex characters')
    return bytes.fromhex(key_hex)


# ---------- offline: a JSON ledger instead of the chain ----------


def _ledger_file():
    if os.environ.get('FETCH_LEDGER_FILE'):  # tests: the box's own offline ledger, so its checks see test agents' sends
        return os.environ['FETCH_LEDGER_FILE']
    state = os.environ.get('FETCH_STATE')
    if not state:
        raise ValueError('FETCH_STATE is not set')
    os.makedirs(state, exist_ok=True)
    return os.path.join(state, 'ledger.json')


def _read_ledger():
    try:
        with open(_ledger_file()) as f:
            return json.load(f)
    except FileNotFoundError:
        return []


def _append_ledger(entry):
    path = _ledger_file()
    with open(path + '.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)  # two sends at once must not lose one
        txs = _read_ledger() + [entry]
        with open(path + '.tmp', 'w') as f:
            json.dump(txs, f)
            f.flush()
            os.fsync(f.fileno())
        os.replace(path + '.tmp', path)


def _fake_address(key_hex):
    # bech32 letters, no valid checksum: it shows as an address but no chain accepts it
    h = hashlib.sha512(b'offline:' + _bytes(key_hex)).digest()
    return 'fetch1test' + ''.join(B32[b % 32] for b in h[:34])


# ---------- live: cosmpy on Dorado ----------


def _chain():
    from cosmpy.aerial.client import LedgerClient
    from cosmpy.aerial.config import NetworkConfig

    return NetworkConfig.fetchai_stable_testnet(), LedgerClient


def _client():
    cfg, client = _chain()
    return client(cfg)


def _wallet(key_hex):
    from cosmpy.aerial.wallet import LocalWallet, PrivateKey

    return LocalWallet(PrivateKey(_bytes(key_hex)), prefix='fetch')


def address(key_hex):
    return _fake_address(key_hex) if offline() else str(_wallet(key_hex).address())


def balance(addr):
    """Atestfet. Offline: 100 FET to start, plus what the ledger shows in and out."""
    if offline():
        return OFFLINE_START + sum(to_atto(t['amount']) * ((t['to'] == addr) - (t['from'] == addr)) for t in _read_ledger())
    from cosmpy.crypto.address import Address

    return int(_client().query_bank_balance(Address(addr), DENOM))


def fund(addr):
    """Ask the faucet for test FET (10 on Dorado), only when the balance is under 1 FET."""
    before = balance(addr)
    if before >= LOW or offline():
        return {'funded': False, 'balance': fmt(before)}
    from cosmpy.aerial.faucet import FaucetApi

    FaucetApi(_chain()[0]).get_wealth(addr)
    return {'funded': True, 'balance': fmt(balance(addr))}


def _result(tx, frm, to, atto):
    return {'tx': tx, 'from': frm, 'to': to, 'amount': fmt(atto), 'denom': 'FET', **({} if offline() else {'link': TX_URL + tx})}


def send(key_hex, to, amount_fet, memo):
    atto, to = to_atto(amount_fet), check_address(to)
    if len(memo) > 256:
        raise ValueError('memo is longer than 256 characters')
    me = address(key_hex)
    have = balance(me)
    if have < atto + (0 if offline() else GAS_RESERVE):
        raise ValueError(f'not enough test FET: the wallet has {fmt(have)} and the send needs {fmt(atto)}' + ('' if offline() else ' plus gas'))
    if offline():
        tx = 'offline-' + os.urandom(16).hex()
        _append_ledger({'tx': tx, 'from': me, 'to': to, 'amount': fmt(atto), 'memo': memo})
        return _result(tx, me, to, atto)
    from cosmpy.crypto.address import Address

    sent = _client().send_tokens(Address(to), atto, DENOM, _wallet(key_hex), memo=memo).wait_to_complete(timeout=60)
    return _result(sent.tx_hash, me, to, atto)


def verify(tx, to, amount_fet, memo=None):
    """Did this tx succeed, with a single send of at least this much to `to` (and this memo, when given)?"""
    want, to = to_atto(amount_fet), check_address(to)
    if offline():
        t = next((t for t in _read_ledger() if t['tx'] == tx), None)
        if not t:
            return {'ok': False, 'error': 'no such transaction in the offline ledger'}
        got, frm, height, tmemo = to_atto(t['amount']), t['from'], 0, t['memo']
        if t['to'] != to:
            return {'ok': False, 'error': 'the payment went to a different address'}
    else:
        tx = tx.upper()
        if len(tx) != 64 or any(c not in '0123456789ABCDEF' for c in tx):
            return {'ok': False, 'error': 'not a transaction hash'}
        from cosmpy.protos.cosmos.bank.v1beta1.tx_pb2 import MsgSend
        from cosmpy.protos.cosmos.tx.v1beta1.service_pb2 import GetTxRequest

        try:
            res = _client().txs.GetTx(GetTxRequest(hash=tx))
        except Exception as e:
            if 'not found' in str(e):
                return {'ok': False, 'error': 'transaction not found on Dorado (it may not be included yet)'}
            raise
        if res.tx_response.code != 0:
            return {'ok': False, 'error': 'the transaction failed on the chain'}
        sends = []
        for m in res.tx.body.messages:
            if m.type_url == '/cosmos.bank.v1beta1.MsgSend':
                s = MsgSend()
                m.Unpack(s)
                sends += [(int(c.amount), s.from_address) for c in s.amount if c.denom == DENOM and s.to_address == to]
        if not sends:
            return {'ok': False, 'error': f'no {DENOM} send to that address in the transaction'}
        got, frm = max(sends)
        height, tmemo = int(res.tx_response.height), res.tx.body.memo
    if got < want:
        return {'ok': False, 'error': f'the payment is {fmt(got)} FET, less than the {fmt(want)} FET asked'}
    if memo is not None and tmemo != memo:
        return {'ok': False, 'error': 'the payment memo does not match the reference'}
    return {'ok': True, 'from': frm, 'to': to, 'amount': fmt(got), 'height': height}


def find(key_hex, to, amount_fet, memo):
    """An earlier send from this wallet with the same recipient, amount and memo, or None. For a resumed call."""
    atto, me, to = to_atto(amount_fet), address(key_hex), check_address(to)
    if offline():
        t = next((t for t in _read_ledger() if (t['from'], t['to'], to_atto(t['amount']), t['memo']) == (me, to, atto, memo)), None)
        return t and {**_result(t['tx'], me, to, atto), 'found': True}
    from cosmpy.protos.cosmos.bank.v1beta1.tx_pb2 import MsgSend
    from cosmpy.protos.cosmos.tx.v1beta1.service_pb2 import GetTxsEventRequest

    res = _client().txs.GetTxsEvent(GetTxsEventRequest(query=f"message.sender='{me}'", order_by=2, limit=20))  # 2 = newest first
    for tx, r in zip(res.txs, res.tx_responses):
        if r.code != 0 or tx.body.memo != memo:
            continue
        for m in tx.body.messages:
            s = MsgSend()
            if m.type_url == '/cosmos.bank.v1beta1.MsgSend' and m.Unpack(s) and s.to_address == to and any(c.denom == DENOM and int(c.amount) == atto for c in s.amount):
                return {**_result(r.txhash, me, to, atto), 'found': True}
    return None


# ---------- command line ----------


def run(argv, key):
    cmd, a = argv[0], argv[1:]
    if cmd == 'verify' and len(a) in (3, 4):
        return verify(*a)
    if not key:
        raise ValueError('FETCH_WALLET_KEY is not set')
    me = address(key)
    if cmd == 'address' and not a:
        return {'address': me}
    if cmd == 'balance' and not a:
        return {'address': me, 'balance': fmt(balance(me))}
    if cmd == 'fund' and not a:
        return {'address': me, **fund(me)}
    if cmd == 'send' and len(a) == 3:
        return send(key, *a)
    if cmd == 'find' and len(a) == 3:
        return find(key, *a) or {'found': False}
    raise ValueError('usage: pay.py address | balance | fund | send <to> <fet> <memo> | verify <tx> <to> <fet> [memo] | find <to> <fet> <memo>')


def main():
    key = os.environ.get('FETCH_WALLET_KEY', '')
    try:
        out = run(sys.argv[1:] or ['help'], key)
    except Exception as e:
        msg = e.details() if callable(getattr(e, 'details', None)) else str(e)  # grpc errors: the short part
        msg = msg.replace(key, '[key]') if key else msg
        print(json.dumps({'error': msg[:400] or type(e).__name__}))
        return 1
    out['network'] = 'offline simulation' if offline() else NETWORK
    out['test'] = True
    if offline():
        out['simulated'] = True
    print(json.dumps(out))
    return 0 if out.get('ok', True) else 1


if __name__ == '__main__':
    sys.exit(main())
