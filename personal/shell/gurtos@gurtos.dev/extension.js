// GurtOS in GNOME Shell: a top-bar item (what runs, what needs you, Approve and Deny), an Agents tile in Quick
// Settings, and approvals as Shell notifications. It talks to the box's local API (127.0.0.1:7700) and follows its
// action log over Server-Sent Events; events only mean "something changed", then it reads tasks and approvals.
// It ships in the GurtOS session's Shell mode, so it is always on and cannot be switched off by accident.
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import Soup from 'gi://Soup?version=3.0';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import {QuickMenuToggle, SystemIndicator} from 'resource:///org/gnome/shell/ui/quickSettings.js';

import {counts, dollars, headerCaps, isRunning, needsReview, noModelKey, plan, quietAt} from './logic.js';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async');
Gio._promisify(Soup.Session.prototype, 'send_async');
Gio._promisify(Gio.DataInputStream.prototype, 'read_line_async');

const BOX = 'http://127.0.0.1:7700';
const UI = '/opt/box/personal/box-ui.py';
const ui = (...args) => Util.spawn([UI, ...args]);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

class Box {
    constructor() {
        this.session = new Soup.Session({timeout: 10});
        this.cancel = new Gio.Cancellable();
    }

    async api(method, path, body) {
        const msg = Soup.Message.new(method, BOX + path);
        msg.request_headers.append('accept', 'application/json');
        if (body !== undefined)
            msg.set_request_body_from_bytes('application/json', new GLib.Bytes(encoder.encode(JSON.stringify(body))));
        const bytes = await this.session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, this.cancel);
        const text = decoder.decode(bytes.get_data() ?? new Uint8Array());
        const out = text ? JSON.parse(text) : null;
        if (msg.get_status() >= 400)
            throw new Error(out?.error ?? `GurtOS answered ${msg.get_status()}`);
        return out;
    }

    /** Follow the action log forever, calling onEvent for each event; reconnect from the last id it saw. */
    async follow(onEvent, onOffline) {
        let after = 0;
        while (!this.cancel.is_cancelled()) {
            try {
                const stream = new Soup.Session(); // no timeout: the stream stays open, with a beat every 25 s
                const input = await stream.send_async(Soup.Message.new('GET', `${BOX}/api/log/stream?after=${after}`), GLib.PRIORITY_DEFAULT, this.cancel);
                const lines = new Gio.DataInputStream({base_stream: input});
                onEvent(null);
                for (;;) {
                    const [line] = await lines.read_line_async(GLib.PRIORITY_DEFAULT, this.cancel);
                    if (line === null)
                        break;
                    const s = decoder.decode(line);
                    if (s.startsWith('id: '))
                        after = Number(s.slice(4));
                    else if (s.startsWith('data: '))
                        onEvent(s);
                }
            } catch (e) {
                if (this.cancel.is_cancelled())
                    return;
            }
            onOffline();
            await new Promise(resolve => GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => resolve() ?? GLib.SOURCE_REMOVE));
        }
    }

    destroy() {
        this.cancel.cancel();
        this.session.abort();
    }
}

// ---------- the top-bar item ----------

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init(ext) {
        super._init(0.5, 'GurtOS');
        this.ext = ext;
        const box = new St.BoxLayout({style_class: 'panel-status-menu-box gurtos-panel'});
        box.add_child(new St.Icon({gicon: ext.icon, style_class: 'system-status-icon'}));
        this.needs = new St.Label({style_class: 'gurtos-badge', y_align: Clutter.ActorAlign.CENTER, visible: false});
        this.runningLabel = new St.Label({style_class: 'gurtos-running', y_align: Clutter.ActorAlign.CENTER, visible: false});
        box.add_child(this.needs);
        box.add_child(this.runningLabel);
        this.add_child(box);
        this.rebuild();
    }

    update() {
        const {tasks, pending, online} = this.ext;
        const c = counts(tasks, pending);
        this.needs.text = String(c.needsYou);
        this.needs.visible = c.needsYou > 0;
        this.runningLabel.text = online === false ? 'offline' : `${c.running} running`;
        this.runningLabel.visible = online === false || c.running > 0;
        this.rebuild(); // kept current, so the menu opens on what is true now
    }

    heading(text) {
        const item = new PopupMenu.PopupMenuItem(text, {reactive: false, style_class: 'gurtos-heading'});
        this.menu.addMenuItem(item);
    }

    rebuild() {
        const {tasks, pending, online, settings} = this.ext;
        this.menu.removeAll();
        const titles = Object.fromEntries(tasks.map(t => [t.id, t.title]));
        if (online === false)
            this.heading("GurtOS isn't answering. Retrying…");
        if (pending.length) {
            this.heading(`Needs your OK, ${pending.length}`);
            for (const a of pending)
                this.menu.addMenuItem(this.approvalRow(a, titles[a.task] ?? 'A task'));
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }
        const reviews = tasks.filter(needsReview);
        if (reviews.length) {
            this.heading(`Ready to review, ${reviews.length}`);
            for (const t of reviews)
                this.menu.addAction(`${t.title} · ${(t.folders ?? [t.folder]).filter(Boolean).map(f => GLib.path_get_basename(f)).join(', ')}`, () => ui('review', t.id));
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }
        const running = tasks.filter(isRunning);
        if (running.length) {
            this.heading(`Running, ${running.length}`);
            for (const t of running)
                this.menu.addAction(`${t.title} · ${t.step ?? t.state}`, () => ui('app', `task/${t.id}`));
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        } else if (!pending.length && !reviews.length && online !== false) {
            this.heading('No agents are working');
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        }
        if (settings && 'paused' in settings) { // the box's pause switch, once the core has one
            const pause = new PopupMenu.PopupSwitchMenuItem('Pause all agents', !!settings.paused);
            pause.connect('toggled', (_i, on) => this.ext.patch({paused: on}));
            this.menu.addMenuItem(pause);
        }
        this.menu.addAction('Ask an Agent…', () => ui('ask'));
        this.menu.addAction('Open GurtOS', () => ui('app'));
        this.menu.addAction('GurtOS Settings', () => ui('settings'));
    }

    approvalRow(a, title) {
        const item = new PopupMenu.PopupBaseMenuItem({activate: false, hover: false, can_focus: false, style_class: 'gurtos-approval'});
        const col = new St.BoxLayout({vertical: true, x_expand: true});
        col.add_child(new St.Label({text: title, style_class: 'gurtos-approval-title'}));
        const q = new St.Label({text: a.question, style_class: 'gurtos-approval-question'});
        q.clutter_text.line_wrap = true;
        col.add_child(q);
        const buttons = new St.BoxLayout({style_class: 'gurtos-approval-buttons', x_align: Clutter.ActorAlign.END});
        const deny = new St.Button({label: 'Deny', style_class: 'button', can_focus: true});
        const approve = new St.Button({label: a.costCents ? `Approve ${dollars(a.costCents)}` : 'Approve', style_class: 'button default', can_focus: true});
        deny.connect('clicked', () => this.ext.answer(a.id, false));
        approve.connect('clicked', () => this.ext.answer(a.id, true));
        buttons.add_child(deny);
        buttons.add_child(approve);
        col.add_child(buttons);
        item.add_child(col);
        return item;
    }
});

// ---------- Quick Settings: the Agents tile ----------

const AgentsToggle = GObject.registerClass(
class AgentsToggle extends QuickMenuToggle {
    _init(ext) {
        super._init({title: 'Agents', gicon: ext.icon, toggleMode: true});
        this.ext = ext;
        this.menu.setHeader(ext.icon, 'Agents', 'GurtOS');
        this.quiet = new PopupMenu.PopupSwitchMenuItem('Quiet hours', false);
        this.quiet.connect('toggled', (_i, on) => ext.patch({quietHours: {enabled: on}}));
        this.menu.addMenuItem(this.quiet);
        this.pause = new PopupMenu.PopupSwitchMenuItem('Pause all agents', false);
        this.pause.connect('toggled', (_i, on) => ext.patch({paused: on}));
        this.menu.addMenuItem(this.pause);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addAction('GurtOS Settings', () => ui('settings'));
        // The tile itself: on means agents may interrupt you; off is quiet hours.
        this.connect('clicked', () => ext.patch({quietHours: {enabled: !this.checked}}));
    }

    update() {
        const {tasks, pending, settings} = this.ext;
        const c = counts(tasks, pending);
        const quiet = !!settings?.quietHours?.enabled;
        this.checked = !quiet;
        this.subtitle = quiet ? 'Quiet hours' : c.needsYou ? `${c.needsYou} need${c.needsYou === 1 ? 's' : ''} you` : `${c.running} running`;
        this.quiet.setToggleState(quiet);
        this.pause.visible = !!settings && 'paused' in settings;
        this.pause.setToggleState(!!settings?.paused);
    }
});

const AgentsIndicator = GObject.registerClass(
class AgentsIndicator extends SystemIndicator {
    _init(ext) {
        super._init();
        this.toggle = new AgentsToggle(ext);
        this.quickSettingsItems.push(this.toggle);
    }
});

// ---------- the extension ----------

export default class GurtOS extends Extension {
    enable() {
        this.icon = Gio.icon_new_for_string(`${this.path}/icons/gurtos-symbolic.svg`);
        this.tasks = [];
        this.pending = [];
        this.settings = null;
        this.online = null;
        this.shown = new Map(); // notification key -> Notification
        this.toldFailed = new Set();
        this.started = new Date().toISOString().slice(0, 19);
        this.box = new Box();
        this.indicator = new Indicator(this);
        Main.panel.addToStatusArea(this.uuid, this.indicator);
        this.agents = new AgentsIndicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this.agents);
        // Enabled on the lock screen too, so an approval that arrives while locked reaches its notification list.
        // The top-bar item and the tile only show in the unlocked session; answering needs an unlock.
        this.modeId = Main.sessionMode.connect('updated', () => this.showForMode());
        this.showForMode();
        this.start();
    }

    showForMode() {
        const unlocked = !Main.sessionMode.isLocked;
        this.indicator.visible = unlocked && !this.notOwner;
        this.agents.toggle.visible = unlocked && !this.notOwner;
        this.lockNotice();
    }

    /** GNOME shows no actions on the lock screen and hides private details, so while locked one plain notice says how
     *  many requests wait, without their titles. It goes away on unlock. */
    lockNotice() {
        const waiting = Main.sessionMode.isLocked && !this.notOwner ? this.pending.length : 0;
        if (!waiting) {
            this.lockNote?.destroy();
            this.lockNote = null;
            return;
        }
        const title = `${waiting} agent request${waiting === 1 ? ' needs' : 's need'} your OK`;
        if (this.lockNote?.title === title)
            return;
        this.lockNote?.destroy();
        if (!this.lockSource) {
            this.lockSource = new MessageTray.Source({title: 'GurtOS', icon: this.icon});
            this.lockSource.connect('destroy', () => (this.lockSource = null));
            Main.messageTray.add(this.lockSource);
        }
        this.lockNote = new MessageTray.Notification({source: this.lockSource, title, body: 'Unlock to approve or deny. Other agents keep working.',
            urgency: MessageTray.Urgency.CRITICAL, privacyScope: MessageTray.PrivacyScope.SYSTEM});
        this.lockNote.connect('destroy', n => this.lockNote === n && (this.lockNote = null));
        this.lockSource.addNotification(this.lockNote);
    }

    disable() {
        Main.sessionMode.disconnect(this.modeId);
        this.box.destroy();
        if (this.timer)
            GLib.source_remove(this.timer);
        for (const n of this.shown.values())
            n.destroy();
        this.source?.destroy();
        this.lockSource?.destroy();
        this.indicator.destroy();
        this.agents.quickSettingsItems.forEach(i => i.destroy());
        this.agents.destroy();
        this.indicator = this.agents = this.box = this.source = this.timer = null;
        this.shown = null;
    }

    async start() {
        try { // approvals belong to the computer's owner; other accounts see nothing
            const owner = await this.box.api('GET', '/api/owner');
            if (owner && owner.user !== GLib.get_user_name()) {
                this.notOwner = true;
                return this.showForMode();
            }
        } catch (e) {}
        this.box.follow(() => this.changed(), () => this.offline());
    }

    changed() {
        if (this.timer)
            return;
        this.timer = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 250, () => {
            this.timer = null;
            this.refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    offline() {
        this.online = false;
        this.indicator?.update();
    }

    async refresh() {
        try {
            [this.tasks, this.pending, this.settings] = await Promise.all([
                this.box.api('GET', '/api/tasks'), this.box.api('GET', '/api/approvals?state=pending'), this.box.api('GET', '/api/settings')]);
        } catch (e) {
            return this.offline();
        }
        if (!this.indicator)
            return;
        this.online = true;
        this.notifyChanges();
        this.lockNotice();
        this.indicator.update();
        this.agents.toggle.update();
    }

    async answer(id, approved) {
        try {
            await this.box.api('POST', `/api/approvals/${encodeURIComponent(id)}`, {approved, by: `desktop:${GLib.get_user_name()}`});
        } catch (e) {
            this.notice('GurtOS did not take your answer', e.message);
        }
        this.changed();
    }

    async patch(change) {
        try {
            this.settings = await this.box.api('PATCH', '/api/settings', change);
        } catch (e) {
            this.notice('GurtOS did not save that', e.message);
        }
        this.agents?.toggle.update();
    }

    // ---------- notifications ----------

    getSource() {
        if (!this.source) {
            this.source = new MessageTray.Source({title: 'GurtOS', icon: this.icon});
            this.source.connect('destroy', () => (this.source = null));
            Main.messageTray.add(this.source);
        }
        return this.source;
    }

    post(key, {title, body, urgency, actions = [], open}) {
        const n = new MessageTray.Notification({source: this.getSource(), title, body, urgency, resident: urgency === MessageTray.Urgency.CRITICAL});
        for (const [label, cb] of actions)
            n.addAction(label, cb);
        if (open)
            n.connect('activated', open);
        if (key) {
            n.connect('destroy', () => this.shown?.get(key) === n && this.shown.delete(key));
            this.shown.set(key, n);
        }
        this.getSource().addNotification(n);
    }

    notice(title, body) {
        this.post(null, {title, body, urgency: MessageTray.Urgency.NORMAL});
    }

    notifyChanges() {
        const {close, post} = plan(new Set(this.shown.keys()), this.tasks, this.pending);
        for (const key of close)
            this.shown.get(key)?.destroy();
        const tasks = Object.fromEntries(this.tasks.map(t => [t.id, t]));
        const approvals = Object.fromEntries(this.pending.map(a => [a.id, a]));
        const quiet = quietAt(this.settings, GLib.DateTime.new_now_local().format('%H:%M'));
        for (const key of post) {
            const [kind, id] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)];
            if (kind === 'approval') {
                const a = approvals[id];
                const title = (tasks[a.task]?.title ?? 'A task').replace(/\.$/, '');
                const q = a.question.trim();
                // Critical: the task waits for you, so the banner stays. Quiet hours: it waits in the list, no banner.
                this.post(key, {
                    title: headerCaps(`${title} needs your OK`),
                    body: `${q}${/[.?!]$/.test(q) ? '' : '.'} Your other agents keep working.`,
                    urgency: quiet ? MessageTray.Urgency.LOW : MessageTray.Urgency.CRITICAL,
                    actions: [['Deny', () => this.answer(a.id, false)], [a.costCents ? `Approve ${dollars(a.costCents)}` : 'Approve', () => this.answer(a.id, true)]],
                    open: () => ui('app', `task/${a.task}`),
                });
            } else {
                const t = tasks[id];
                this.post(key, {
                    title: headerCaps(`${t.title.replace(/\.$/, '')} is done`),
                    body: 'Nothing in your folders has changed yet. Review its changes, then keep or undo them.',
                    urgency: MessageTray.Urgency.NORMAL,
                    actions: [['Review changes', () => ui('review', t.id)]],
                    open: () => ui('review', t.id),
                });
            }
        }
        for (const t of this.tasks) { // a task that failed since this login, once
            if (t.state !== 'failed' || t.updatedAt < this.started || this.toldFailed.has(t.id))
                continue;
            this.toldFailed.add(t.id);
            const setup = noModelKey(t.error);
            this.post(null, {
                title: headerCaps(`${t.title.replace(/\.$/, '')} ${setup ? 'could not start' : 'could not finish'}`),
                body: setup ? 'Add a model key (Anthropic or Factory) in GurtOS Setup.' : (t.error || 'It stopped with an error.'),
                urgency: MessageTray.Urgency.NORMAL,
                actions: [[setup ? 'Open GurtOS Setup' : 'Open in GurtOS', () => (setup ? ui('setup') : ui('app', `task/${t.id}`))]],
            });
        }
    }
}
