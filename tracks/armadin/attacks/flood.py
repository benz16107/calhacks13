# Armadin: log a step that claims a Keep happened, ask a huge right-to-left question, then write to the action log
# past the broker's limits: 64 KB a request and 20 MB a task, refused requests counted too. Usage: python3 flood.py
import http.client, json, os, socket, time
class Broker(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX)
        self.sock.connect(os.environ['BOX_SOCKET'])
def post(path, body):
    try:
        c = Broker('broker')
        c.request('POST', path, json.dumps(body), {'content-type': 'application/json'})
        r = c.getresponse()
        out = r.read()
        c.close()
        return r.status, out
    except OSError as e:  # the box closed a refused request before it was all sent
        return 413, str(e).encode()
print('fake keep:', post('/step', {'text': 'kept 3 change(s) to your folder', 'data': {'keep': 'applied'}})[0], flush=True)
status, out = post('/ask', {'key': 'big', 'question': '\u202eDEVORPPA\u202c ' + 'A' * 60000})
print('big ask:', status, out[:80].decode(), flush=True)
ok, start, pad = 0, time.time(), 'x' * 8000
for i in range(100):
    ok += post('/step', {'text': 'flood %d %s' % (i, pad)})[0] == 200
print('steps: %d of 100 accepted in %.1f s' % (ok, time.time() - start), flush=True)
refused, big = 0, 'x' * 70000
for i in range(350):
    refused += post('/step', {'text': big})[0] == 413
print('oversized: %d of 350 refused' % refused, flush=True)
print('after 20 MB: %d' % post('/step', {'text': 'one more'})[0], flush=True)
