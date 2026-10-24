// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=69-254
// source=portal/src/shell.tsx
// component=Banners
// example=<Banners /> on the desktop; <article class="g-notification"> in a track page
import figma from 'figma'
const instance = figma.selectedInstance

const app = instance.getString('App name')
const time = instance.getString('Time')
const title = instance.getString('Title')
const body = instance.getString('Body')
const actions = instance.getBoolean('Show actions')

// The desktop draws notifications from the box's live state (Banners in shell.tsx). A track page uses the same card.
export default {
  example: figma.html`<article class="g-notification"><div class="g-notification-head"><span class="g-notification-app">${app}</span><span class="g-notification-meta">${time}</span></div><div class="g-notification-title">${title}</div><div class="g-notification-body">${body}</div>${actions ? '<div class="g-notification-actions"><button class="g-btn">Deny</button><button class="g-btn g-btn-suggested">Approve</button></div>' : ''}</article>`,
  imports: [],
  id: 'gurtos-notification',
  metadata: { nestable: false },
}
