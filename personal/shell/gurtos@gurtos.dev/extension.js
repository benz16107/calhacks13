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

import {counts, dollars, failure, isRunning, needsReview, plan, quietAt} from './logic.js';

Gio._promisify(Soup.Session.prototype, 'send_and_read_async');
Gio._promisify(Soup.Session.prototype, 'send_async');
Gio._promisify(Gio.DataInputStream.prototype, 'read_line_async');

const BOX = 'http://127.0.0.1:7700';
const UI = '/opt/box/personal/box-ui.py';
const ui = (...args) => Util.spawn([UI, ...args]);
const SHOWN = 3; // rows per popover section; the rest are one click away in the GurtOS app
const VOICE = '/opt/box/personal/voice.py'; // "Talk to your computer": press once to listen, press again to stop
const VOICE_STATE = `${GLib.get_user_runtime_dir()}/gurtos-voice`; // voice.py writes "listening <pid>" here while it hears you
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

// ---------- the top-bar item (Figma "GurtOS Personal OS", screen 2) ----------

const ago = iso => {
    try {
        return GLib.DateTime.new_from_iso8601(iso, null).to_local().format('%H:%M');
    } catch (e) {
        return '';
    }
};

/** A labelled switch with a subtitle, for the popover and the Agents menu. */
function switchRow(title, subtitle, on, onToggle) {
    const item = new PopupMenu.PopupSwitchMenuItem(title, on);
    if (subtitle) {
        const col = new St.BoxLayout({vertical: true, x_expand: true, y_align: Clutter.ActorAlign.CENTER});
        item.label.get_parent().remove_child(item.label);
        col.add_child(item.label);
        const sub = new St.Label({text: subtitle, style_class: 'gurtos-subtitle'});
        sub.clutter_text.set({line_wrap: true, ellipsize: 0});
        col.add_child(sub);
        item.insert_child_at_index(col, 0);
    }
    item.connect('toggled', (_i, v) => onToggle(v));
    return item;
}

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init(ext) {
        super._init(0.5, 'GurtOS');
        this.ext = ext;
        this.menu.box.add_style_class_name('gurtos-menu');
        const box = new St.BoxLayout({style_class: 'panel-status-menu-box gurtos-panel'});
        this.needsBox = new St.BoxLayout({style_class: 'gurtos-needs', visible: false});
        this.needs = new St.Label({style_class: 'gurtos-badge', y_align: Clutter.ActorAlign.CENTER});
        this.needsBox.add_child(this.needs);
        this.needsBox.add_child(new St.Label({text: 'needs you', y_align: Clutter.ActorAlign.CENTER}));
        this.mic = new St.BoxLayout({style_class: 'gurtos-listening', visible: false});
        this.micLabel = new St.Label({y_align: Clutter.ActorAlign.CENTER});
        this.mic.add_child(new St.Icon({icon_name: 'audio-input-microphone-symbolic', style_class: 'system-status-icon'}));
        this.mic.add_child(this.micLabel);
        box.add_child(this.mic);
        this.runBox = new St.BoxLayout({style_class: 'gurtos-runs'});
        this.runIcon = new St.Icon({icon_name: 'media-playback-start-symbolic', style_class: 'system-status-icon gurtos-run-icon'});
        this.runningLabel = new St.Label({style_class: 'gurtos-running', y_align: Clutter.ActorAlign.CENTER});
        this.runBox.add_child(this.runIcon);
        this.runBox.add_child(this.runningLabel);
        box.add_child(this.needsBox);
        box.add_child(this.runBox);
        this.add_child(box);
        this.rebuild();
    }

    update() {
        const {tasks, pending, online} = this.ext;
        const c = counts(tasks, pending);
        const off = online === false;
        this.needs.text = String(c.needsYou);
        this.needsBox.visible = !off && c.needsYou > 0;
        const paused = !!this.ext.settings?.paused;
        this.runningLabel.text = off ? 'Offline' : paused ? 'Paused' : c.running ? `${c.running} running` : 'Agents';
        this.runIcon.icon_name = off ? 'network-offline-symbolic' : paused ? 'media-playback-pause-symbolic'
            : c.running ? 'media-playback-start-symbolic' : 'gurtos-tasks-symbolic';
        this.runBox.visible = off || !c.needsYou || c.running > 0 || paused;
        this.rebuild(); // kept current, so the menu opens on what is true now
    }

    heading(section, text) {
        section.addMenuItem(new PopupMenu.PopupMenuItem(text.toUpperCase(), {reactive: false, style_class: 'gurtos-heading'}));
    }

    /** One section of the popover: at most 3 rows, then "Show all N in GurtOS". */
    list(section, title, items, row) {
        if (!items.length)
            return;
        this.heading(section, items.length > SHOWN ? `${title} · ${items.length}` : title);
        for (const x of items.slice(0, SHOWN))
            section.addMenuItem(row(x));
        if (items.length > SHOWN) {
            const more = new PopupMenu.PopupMenuItem(`Show all ${items.length} in GurtOS`, {style_class: 'gurtos-more'});
            more.connect('activate', () => ui('app'));
            section.addMenuItem(more);
        }
    }

    rebuild() {
        const {tasks, pending, online, settings} = this.ext;
        const off = online === false;
        this.menu.removeAll();
        const c = counts(tasks, pending);
        const titles = Object.fromEntries(tasks.map(t => [t.id, t]));
        // Header: Agents, and what needs you and what runs.
        const head = new PopupMenu.PopupBaseMenuItem({activate: false, hover: false, can_focus: false, style_class: 'gurtos-head'});
        const badge = new St.Bin({style_class: 'gurtos-head-badge', child: new St.Icon({icon_name: 'gurtos-tasks-symbolic', icon_size: 16})});
        head.add_child(badge);
        const hcol = new St.BoxLayout({vertical: true});
        hcol.add_child(new St.Label({text: 'Agents', style_class: 'gurtos-head-title'}));
        const reviews = tasks.filter(needsReview);
        const parts = [c.needsYou ? `${c.needsYou} need${c.needsYou === 1 ? 's' : ''} you` : null, `${c.running} running`,
            reviews.length ? `${reviews.length} to review` : null].filter(Boolean);
        hcol.add_child(new St.Label({text: off ? 'Offline' : parts.join(' · '), style_class: 'gurtos-subtitle'}));
        head.add_child(hcol);
        this.menu.addMenuItem(head);

        // The lists scroll inside a capped height, so the actions below never leave the screen.
        const holder = new PopupMenu.PopupMenuSection();
        const section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(holder);
        holder.addMenuItem(section);
        holder.box.remove_child(section.actor);
        const scroll = new St.ScrollView({hscrollbar_policy: St.PolicyType.NEVER, vscrollbar_policy: St.PolicyType.AUTOMATIC, overlay_scrollbars: true});
        const mon = Main.layoutManager.primaryMonitor;
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        if (mon)
            scroll.style = `max-height: ${Math.max(200, Math.floor((mon.height / scale) * 0.8) - 330)}px;`;
        scroll.set_child(section.actor);
        holder.box.add_child(scroll);
        if (off) {
            const row = new PopupMenu.PopupBaseMenuItem({activate: false, hover: false, can_focus: false, style_class: 'gurtos-offline'});
            const l = new St.Label({text: "GurtOS isn't answering. Your files are unchanged. Retrying…", style_class: 'gurtos-subtitle', x_expand: true});
            l.clutter_text.set({line_wrap: true, ellipsize: 0});
            row.add_child(l);
            section.addMenuItem(row);
        } else {
            this.list(section, 'Needs you', pending, a => this.approvalCard(a, titles[a.task]));
            this.list(section, 'Ready to review', reviews, t => this.taskRow(t, (t.folders ?? [t.folder]).filter(Boolean).map(f => GLib.path_get_basename(f)).join(', '), () => ui('app', `task/${t.id}`)));
            this.list(section, 'Running', tasks.filter(isRunning), t => this.taskRow(t, t.step ?? '', () => ui('app', `task/${t.id}`), true));
        }
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        if (settings && 'paused' in settings) {
            const pause = switchRow('Pause all agents', 'Running tasks stop where they are', !!settings.paused, v => this.ext.patch({paused: v}));
            pause.setSensitive(!off);
            this.menu.addMenuItem(pause);
        }
        this.menu.addAction('Talk to your computer', () => Util.spawn([VOICE]));
        this.menu.addAction('New task…', () => ui('ask')).setSensitive(!off);
        this.menu.addAction('Open GurtOS', () => ui('app'));
        this.menu.addAction('GurtOS Settings', () => ui('settings'));
    }

    taskRow(t, detail, open, working = false) {
        const item = new PopupMenu.PopupBaseMenuItem({style_class: 'gurtos-task'});
        item.add_child(new St.Icon({icon_name: working ? 'view-list-bullet-symbolic' : 'folder-symbolic', style_class: 'gurtos-task-icon'}));
        const col = new St.BoxLayout({vertical: true, x_expand: true});
        const line = new St.BoxLayout();
        const title = new St.Label({text: t.title, style_class: 'gurtos-task-title', x_expand: true});
        title.clutter_text.ellipsize = 3; // one line; the GurtOS app has the whole name
        line.add_child(title);
        if (detail) {
            const d = new St.Label({text: detail, style_class: 'gurtos-subtitle gurtos-detail'});
            d.clutter_text.ellipsize = 3;
            line.add_child(d);
        }
        col.add_child(line);
        if (working) // the box has no step count, so a working bar rather than a percentage
            col.add_child(new St.Widget({style_class: 'gurtos-working'}));
        item.add_child(col);
        item.connect('activate', open);
        return item;
    }

    approvalCard(a, task) {
        const item = new PopupMenu.PopupBaseMenuItem({activate: false, hover: false, can_focus: false, style_class: 'gurtos-approval'});
        const card = new St.BoxLayout({vertical: true, x_expand: true, style_class: 'gurtos-approval-card'});
        const top = new St.BoxLayout({style_class: 'gurtos-approval-top'});
        top.add_child(new St.Icon({icon_name: a.costCents ? 'gurtos-money-symbolic' : 'dialog-question-symbolic', fallback_icon_name: 'dialog-question-symbolic', style_class: 'gurtos-approval-icon'}));
        const tcol = new St.BoxLayout({vertical: true, x_expand: true});
        const tcol2 = new St.Label({text: task?.title ?? 'A task', style_class: 'gurtos-approval-title'});
        tcol2.clutter_text.ellipsize = 3;
        tcol.add_child(tcol2);
        tcol.add_child(new St.Label({text: [a.payee, task ? `asked ${ago(task.updatedAt)}` : null].filter(Boolean).join(' · '), style_class: 'gurtos-subtitle'}));
        top.add_child(tcol);
        card.add_child(top);
        const q = new St.Label({text: a.question, style_class: 'gurtos-approval-question'});
        q.clutter_text.set({line_wrap: true, ellipsize: 0});
        card.add_child(q);
        const buttons = new St.BoxLayout({style_class: 'gurtos-approval-buttons', x_expand: true});
        const deny = new St.Button({label: 'Deny', style_class: 'button gurtos-deny', can_focus: true, x_expand: true});
        const approve = new St.Button({label: a.costCents ? `Approve ${dollars(a.costCents)}` : 'Approve', style_class: 'button gurtos-approve', can_focus: true, x_expand: true});
        deny.connect('clicked', () => this.ext.answer(a.id, false));
        approve.connect('clicked', () => this.ext.answer(a.id, true));
        buttons.add_child(deny);
        buttons.add_child(approve);
        card.add_child(buttons);
        item.add_child(card);
        return item;
    }
});

// ---------- Quick Settings: the Agents tile (screen 3) ----------

const AgentsToggle = GObject.registerClass(
class AgentsToggle extends QuickMenuToggle {
    _init(ext) {
        super._init({title: 'Agents', iconName: 'gurtos-tasks-symbolic', toggleMode: false});
        this.ext = ext;
        this.menu.setHeader('gurtos-tasks-symbolic', 'Agents', 'GurtOS');
        this.connect('clicked', () => ui('app', 'tasks'));
    }

    update() {
        const {tasks, pending, settings} = this.ext;
        const c = counts(tasks, pending);
        const quiet = !!settings?.quietHours?.enabled;
        this.checked = c.running > 0 || c.needsYou > 0; // on while agents run
        this.subtitle = this.ext.online === false ? 'Offline' : c.needsYou ? `${c.needsYou} need${c.needsYou === 1 ? 's' : ''} you` : settings?.paused ? 'Paused'
            : c.running ? `${c.running} running` : quiet ? 'Quiet hours' : 'Nothing running';
        this.menu.removeAll();
        if (settings && 'paused' in settings)
            this.menu.addMenuItem(switchRow('Pause all agents', 'Running tasks stop where they are', !!settings.paused, v => this.ext.patch({paused: v})));
        const q = settings?.quietHours ?? {};
        this.menu.addMenuItem(switchRow('Quiet hours', quiet ? `Until ${q.to ?? '07:00'}. Requests wait without a sound` : `${q.from ?? '22:00'} to ${q.to ?? '07:00'}. Requests wait without a sound`,
            quiet, v => this.ext.patch({quietHours: {enabled: v}})));
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        for (const [label, n, amber, open] of [['Needs you', c.needsYou, true, () => ui('app', 'tasks')], ['Running', c.running, false, () => ui('app', 'tasks')]]) {
            const item = new PopupMenu.PopupMenuItem(label);
            const count = new St.Label({text: String(n), style_class: amber && n ? 'gurtos-badge' : 'gurtos-subtitle', y_align: Clutter.ActorAlign.CENTER});
            item.add_child(new St.Widget({x_expand: true}));
            item.add_child(count);
            item.connect('activate', open);
            this.menu.addMenuItem(item);
        }
        this.menu.addAction('Talk to your computer', () => Util.spawn([VOICE]));
        this.menu.addAction('GurtOS Settings', () => ui('settings'));
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
        this.quiet = new Set(); // notification keys seen without a banner (at login, or inside a grouped one)
        this.primed = false;
        this.started = new Date().toISOString().slice(0, 19);
        this.box = new Box();
        this.indicator = new Indicator(this);
        Main.panel.addToStatusArea(this.uuid, this.indicator);
        // A red mic and "Listening…" for as long as voice.py holds the microphone, so it is never silent.
        this.voiceFile = Gio.File.new_for_path(VOICE_STATE);
        this.voiceMonitor = this.voiceFile.monitor_file(Gio.FileMonitorFlags.NONE, null);
        this.voiceMonitor.connect('changed', () => this.showVoice());
        this.showVoice();
        this.agents = new AgentsIndicator(this);
        Main.panel.statusArea.quickSettings.addExternalIndicator(this.agents);
        // Enabled on the lock screen too, so an approval that arrives while locked reaches its notification list.
        // The top-bar item and the tile only show in the unlocked session; answering needs an unlock.
        this.modeId = Main.sessionMode.connect('updated', () => this.showForMode());
        this.showForMode();
        this.start();
    }

    showVoice() {
        let state = '';
        try {
            state = decoder.decode(this.voiceFile.load_contents(null)[1]).split(' ')[0];
        } catch (e) {} // no file: not listening
        const words = {listening: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking…'};
        this.indicator.mic.visible = state in words;
        this.indicator.micLabel.text = words[state] ?? '';
    }

    showForMode() {
        const unlocked = !Main.sessionMode.isLocked;
        this.indicator.visible = unlocked && !this.notOwner;
        this.agents.toggle.visible = unlocked && !this.notOwner;
        this.lockNotice();
    }

    /** The lock screen (screen 6): each approval as a card in GNOME's lock-screen notification list. Deny works
     *  while locked; "Unlock to approve" asks for the password first, because approving can spend money, and the
     *  approval goes through once the screen is unlocked. GNOME gives notifications no buttons there, so GurtOS adds
     *  its own cards to that list. */
    lockNotice() {
        const box = Main.screenShield?._dialog?._notificationsBox;
        this.lockCards?.destroy();
        this.lockCards = null;
        if (!Main.sessionMode.isLocked || this.notOwner) {
            if (this.approveAfterUnlock && !Main.sessionMode.isLocked) {
                const id = this.approveAfterUnlock;
                this.approveAfterUnlock = null;
                const a = this.pending.find(x => x.id === id);
                const title = (this.tasks.find(t => t.id === a?.task)?.title ?? 'The task').replace(/\.$/, '');
                this.answer(id, true).then(ok => ok && this.notice(`Approved: ${title}`, 'It carries on now.'));
            }
            return;
        }
        if (!box?._notificationBox) // the lock screen builds its dialog a moment after locking
            return GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => (Main.sessionMode.isLocked && this.lockNotice(), GLib.SOURCE_REMOVE));
        if (!this.pending.length)
            return box._updateVisibility?.();
        const titles = Object.fromEntries(this.tasks.map(t => [t.id, t.title]));
        this.lockCards = new St.BoxLayout({vertical: true, style_class: 'gurtos-lock'});
        for (const a of this.pending.slice(0, 2)) {
            const card = new St.BoxLayout({vertical: true, style_class: 'gurtos-lock-card'});
            const src = new St.BoxLayout({style_class: 'gurtos-lock-source'});
            src.add_child(new St.Icon({gicon: this.icon, icon_size: 16}));
            src.add_child(new St.Label({text: 'GurtOS', style_class: 'gurtos-subtitle'}));
            card.add_child(src);
            const lt = new St.Label({text: `${(titles[a.task] ?? 'A task').replace(/\.$/, '')} needs you`, style_class: 'gurtos-approval-title'});
            lt.clutter_text.ellipsize = 3;
            card.add_child(lt);
            const q = new St.Label({text: a.question, style_class: 'gurtos-approval-question'});
            q.clutter_text.set({line_wrap: true, ellipsize: 0});
            card.add_child(q);
            const buttons = new St.BoxLayout({style_class: 'gurtos-approval-buttons', x_expand: true});
            const deny = new St.Button({label: 'Deny', style_class: 'button gurtos-deny', can_focus: true, x_expand: true});
            const unlock = new St.Button({style_class: 'button gurtos-approve', can_focus: true, x_expand: true,
                child: new St.BoxLayout({x_align: Clutter.ActorAlign.CENTER, style_class: 'gurtos-unlock'})});
            unlock.child.add_child(new St.Icon({icon_name: 'system-lock-screen-symbolic', icon_size: 14}));
            unlock.child.add_child(new St.Label({text: 'Unlock to approve'}));
            deny.connect('clicked', () => this.answer(a.id, false));
            unlock.connect('clicked', () => {
                this.approveAfterUnlock = a.id;
                Main.screenShield._dialog?._showPrompt?.();
            });
            buttons.add_child(deny);
            buttons.add_child(unlock);
            card.add_child(buttons);
            this.lockCards.add_child(card);
        }
        const hint = new St.Label({text: 'Deny works from the lock screen. Approving can spend money, so it asks for your password first.',
            style_class: 'gurtos-lock-hint'});
        hint.clutter_text.set({line_wrap: true, ellipsize: 0});
        this.lockCards.add_child(hint);
        box._notificationBox.insert_child_at_index(this.lockCards, 0);
        box._updateVisibility?.();
    }

    disable() {
        Main.sessionMode.disconnect(this.modeId);
        this.voiceMonitor.cancel();
        this.box.destroy();
        if (this.timer)
            GLib.source_remove(this.timer);
        if (this.reviewTimer)
            GLib.source_remove(this.reviewTimer);
        for (const n of this.shown.values())
            n.destroy();
        this.source?.destroy();
        this.lockCards?.destroy();
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
        this.agents?.toggle.update();
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
        let ok = true;
        try {
            await this.box.api('POST', `/api/approvals/${encodeURIComponent(id)}`, {approved, by: `desktop:${GLib.get_user_name()}`});
        } catch (e) {
            ok = false;
            this.notice('GurtOS did not take your answer', e.message);
        }
        this.changed();
        return ok;
    }

    async patch(change) {
        try {
            this.settings = await this.box.api('PATCH', '/api/settings', change);
        } catch (e) {
            this.notice('GurtOS did not save that', e.message);
        }
        this.indicator?.update();
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
        return n;
    }

    notice(title, body) {
        this.post(null, {title, body, urgency: MessageTray.Urgency.NORMAL});
    }

    postReviews() {
        const keys = (this.reviewQueue ?? []).filter(k => this.quiet.has(k)); // still waiting for review
        this.reviewQueue = [];
        const tasks = Object.fromEntries(this.tasks.map(t => [t.id, t]));
        if (keys.length > 1) {
            this.groupNote?.destroy();
            this.groupNote = this.post(null, {
                title: `${keys.length} tasks finished`,
                body: 'Review them in GurtOS. Nothing in your folders has changed yet.',
                urgency: MessageTray.Urgency.NORMAL,
                actions: [['Open GurtOS', () => ui('app')]],
                open: () => ui('app'),
            });
        } else if (keys.length === 1 && tasks[keys[0].slice(7)]) {
            const t = tasks[keys[0].slice(7)];
            this.quiet.delete(keys[0]);
            this.post(keys[0], {
                title: `${t.title.replace(/\.$/, '')} is done`,
                body: 'Nothing in your folders has changed yet. Review its changes, then keep or undo them.',
                urgency: MessageTray.Urgency.NORMAL,
                actions: [['Review changes', () => ui('app', `task/${t.id}`)]],
                open: () => ui('app', `task/${t.id}`),
            });
        }
    }

    notifyChanges() {
        // What is already there at login was seen before: it shows in the top bar and the popover, not as banners again.
        const first = !this.primed;
        this.primed = true;
        const {close, post} = plan(new Set([...this.shown.keys(), ...this.quiet]), this.tasks, this.pending);
        for (const key of close) {
            this.shown.get(key)?.destroy();
            this.quiet.delete(key);
        }
        const tasks = Object.fromEntries(this.tasks.map(t => [t.id, t]));
        const approvals = Object.fromEntries(this.pending.map(a => [a.id, a]));
        const quiet = quietAt(this.settings, GLib.DateTime.new_now_local().format('%H:%M'));
        const reviews = post.filter(k => k.startsWith('review:'));
        for (const key of post.filter(k => k.startsWith('approval:'))) {
            const a = approvals[key.slice(9)];
            const title = (tasks[a.task]?.title ?? 'A task').replace(/\.$/, '');
            const q = a.question.trim();
            // Critical: the task waits for you, so the banner stays. Quiet hours or login: it waits in the list, no banner.
            this.post(key, {
                title: `${title} needs you`,
                body: `${q}${/[.?!]$/.test(q) ? '' : '.'} Your other agents keep working.`,
                urgency: quiet || first ? MessageTray.Urgency.LOW : MessageTray.Urgency.CRITICAL,
                actions: [['Deny', () => this.answer(a.id, false)], [a.costCents ? `Approve ${dollars(a.costCents)}` : 'Approve', () => this.answer(a.id, true)]],
                open: () => ui('app', `task/${a.task}`),
            });
        }
        if (first) {
            for (const key of reviews)
                this.quiet.add(key);
        } else if (reviews.length) {
            // Tasks often finish a moment apart: wait 3 s, then one banner for the lot, or the task's own for one.
            for (const key of reviews)
                this.quiet.add(key);
            this.reviewQueue = [...(this.reviewQueue ?? []), ...reviews];
            this.reviewTimer ??= GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
                this.reviewTimer = null;
                this.postReviews();
                return GLib.SOURCE_REMOVE;
            });
        }
        for (const t of this.tasks) { // a task that failed since this login, once
            if (t.state !== 'failed' || t.updatedAt < this.started || this.toldFailed.has(t.id))
                continue;
            this.toldFailed.add(t.id);
            const why = failure(t.error);
            this.post(null, {
                title: `${t.title.replace(/\.$/, '')} ${why.key ? 'could not start' : 'could not finish'}`,
                body: why.text,
                urgency: MessageTray.Urgency.NORMAL,
                actions: [[why.key ? 'Open Settings' : 'Open in GurtOS', () => (why.key ? ui('settings', 'agents') : ui('app', `task/${t.id}`))]],
            });
        }
    }
}
