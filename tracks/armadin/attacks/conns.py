# Armadin: open 1,000 idle connections to the box's proxy and hold them, then count how many the proxy kept open.
# Usage: python3 -u conns.py
import os, resource, socket, time
resource.setrlimit(resource.RLIMIT_NOFILE, (8192, resource.getrlimit(resource.RLIMIT_NOFILE)[1]))
port = int(os.environ['HTTP_PROXY'].rsplit(':', 1)[1])
held = []
try:
    for _ in range(1000):
        held.append(socket.create_connection(('127.0.0.1', port), 2))
except OSError as e:
    print('stopped:', e)
print('opened:', len(held))
time.sleep(3)  # the proxy closes the ones past its limit as it takes them
alive = 0
for s in held:
    s.setblocking(False)
    try:
        alive += s.recv(1, socket.MSG_PEEK) != b''  # data would be odd; b'' is a closed connection
    except BlockingIOError:
        alive += 1  # open and quiet
    except OSError:
        pass  # reset by the proxy
print('open: %d' % alive)
open('conns-open', 'w').write(str(alive))
time.sleep(3)
