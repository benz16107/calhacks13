# Armadin: one task listens for another, on an abstract Unix socket and on TCP in the proxy's port range.
# Usage: python3 listen.py <run id> <tcp port>
import select, socket, sys, time
run, port = sys.argv[1], int(sys.argv[2])
a = socket.socket(socket.AF_UNIX)
a.bind('\0armadin-' + run)
a.listen(4)
socks = [a]
try:
    t = socket.socket()
    t.bind(('127.0.0.1', port))
    t.listen(4)
    socks.append(t)
    print('tcp: listening on', port)
except OSError as e:
    print('tcp: could not listen:', e)
got = []
end = time.time() + 18
while time.time() < end and len(got) < len(socks):
    for s in select.select(socks, [], [], 0.5)[0]:
        c, _ = s.accept()
        c.settimeout(2)
        try:
            got.append(('unix' if s is a else 'tcp') + ':' + c.recv(100).decode())
        except OSError as e:
            got.append('error: ' + str(e))
print('received:', ' '.join(got) or 'nothing')
try:
    print('shm:', open('/dev/shm/armadin-' + run + '-note').read())
except OSError as e:
    print('shm:', e)
