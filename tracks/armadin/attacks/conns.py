# Armadin: hold 3,000 idle connections open to the box's proxy. Usage: python3 conns.py
import os, resource, socket, time
resource.setrlimit(resource.RLIMIT_NOFILE, (8192, resource.getrlimit(resource.RLIMIT_NOFILE)[1]))
port = int(os.environ['HTTP_PROXY'].rsplit(':', 1)[1])
held = []
try:
    for _ in range(3000):
        held.append(socket.create_connection(('127.0.0.1', port), 2))
except OSError as e:
    print('stopped:', e)
print('open:', len(held))
open('conns-open', 'w').write(str(len(held)))
time.sleep(8)
