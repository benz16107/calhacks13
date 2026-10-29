# Armadin: make many small files in the task's own copy, then log steps. At each step the box records what changed
# in the layer (the flight recorder), on its own thread. Usage: python3 -u many.py <count>
import http.client, json, os, socket, sys, time
class Broker(http.client.HTTPConnection):
    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX)
        self.sock.connect(os.environ['BOX_SOCKET'])
def step(text):
    c = Broker('broker')
    c.request('POST', '/step', json.dumps({'text': text}), {'content-type': 'application/json'})
    c.getresponse().read()
    c.close()
n = int(sys.argv[1])
os.makedirs('many', exist_ok=True)
for i in range(n):
    open('many/%d' % i, 'w').close()
print('made: %d files' % n)
for i in range(3):
    start = time.time()
    step('many files, step %d' % i)
    print('step: %d took %.2f s' % (i, time.time() - start))
