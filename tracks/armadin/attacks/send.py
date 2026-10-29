# Armadin: the other task sends to the listener. Usage: python3 send.py <run id> <tcp port>
import socket, sys, time
run, port = sys.argv[1], int(sys.argv[2])
def retry(what, fn, tries):
    err = None
    for _ in range(tries):
        try:
            fn()
            return print(what + ': sent')
        except OSError as e:
            err = e
            time.sleep(0.25)
    print(what + ':', err)
def unix():
    s = socket.socket(socket.AF_UNIX)
    s.connect('\0armadin-' + run)
    s.sendall(b'secret-from-the-other-task')
def tcp():
    s = socket.create_connection(('127.0.0.1', port), 2)
    s.sendall(b'tcp-from-the-other-task')
retry('unix', unix, 40)  # the listener may still be starting
retry('tcp', tcp, 4)
