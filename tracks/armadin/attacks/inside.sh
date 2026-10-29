# Armadin: probes run from inside a task, as its own user. Each output line is "<probe>: <what happened>".
# Usage: sh inside.sh <another task's id> <a port in 8800-8899 that is not a proxy> <run id>
H=${BOX_SOCKET%/tasks/*} # BOX_HOME: every task can learn it from its own socket's path or its working folder
say() { echo "$1: $2"; }

# The box's own doors.
r=$(curl -sS -m 3 --unix-socket "$H/api.sock" http://box/api/approvals 2>&1); say api-socket "curl exit=$? ${r:-(no answer)}"
say tasks-dir "$(ls "$H/tasks" 2>&1 | head -1)"
r=$(curl -sS -m 3 --unix-socket "$H/tasks/$1/broker.sock" http://b/task 2>&1); say other-broker "curl exit=$? ${r:-(no answer)}"
for f in log.jsonl settings.json setup.json devices.json owner.json business.json permissions.json tripwire.key vault.env vault-meta.json links.json apps.json; do
  [ -e "$H/$f" ] || continue
  if head -c1 "$H/$f" >/dev/null 2>&1; then say state-file "READ $f"; else say state-file "denied $f"; fi
done

# What other tasks have open: /proc/net is per network namespace, and every task shares the host's.
n=$(awk -v me="$(id -u)" 'FNR>1 && $8>=30000 && $8<=39999 && $8!=me {c++} END {print c+0}' /proc/net/tcp /proc/net/tcp6)
say proc-net "$n TCP sockets of other task users; abstract names seen: $(grep -o '@armadin-[0-9a-f]*' /proc/net/unix | sort -u | tr '\n' ' ')"

# Privileges.
say sudo "$(sudo -n true 2>&1 | head -1)"
say su "$(timeout 3 su -c true root </dev/null 2>&1 | tail -1)"
say crontab "$(crontab -l 2>&1 | head -1)"
say keyring "$(python3 -c "import ctypes,os;libc=ctypes.CDLL(None,use_errno=True);n={'x86_64':248,'aarch64':217}[os.uname().machine];r=libc.syscall(n,b'user',b'armadin',b'v',1,-2);print('add_key', r, os.strerror(ctypes.get_errno()) if r<0 else 'made a key')" 2>&1)"
say userns "$(timeout 3 unshare -Ur sh -c 'id -u; echo x > /proc/self/setgroups' 2>&1 | tr '\n' ' ')"

# Root services that listen on abstract Unix sockets (no file, so no permission check): a stock Ubuntu Server has two.
for s in /org/kernel/linux/storage/multipathd ISCSIADM_ABSTRACT_NAMESPACE; do
  say abstract "$s $(python3 -c "import socket,sys;s=socket.socket(socket.AF_UNIX);s.settimeout(2);s.connect('\0'+sys.argv[1]);print('connected')" "$s" 2>&1 | tail -1)"
done

# The lock the box takes before it publishes its SpacetimeDB module. Taken and let go at once, so no other run waits.
say lock "$(timeout 3 flock -n -x -o /run/lock/box-spacetime-cli.lock -c 'echo took it' 2>&1; echo "exit=$?")"

# A listener on 127.0.0.1 in the proxy's port range that is not a proxy: straight there, around the proxy.
printf "direct-$3" | timeout 3 nc -w1 127.0.0.1 "$2" >/dev/null 2>&1; say direct "nc exit=$?"
