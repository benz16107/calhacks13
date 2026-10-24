// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=55-163
// source=portal/src/apps/settings.tsx
// component=g-approw
// example=<label class="g-approw"><AppIcon id="shopper" size={44} /><span class="g-approw-text">...</span><Switch checked={on} onChange={setOn} label="Shopper" /></label>
import figma from 'figma'
const instance = figma.selectedInstance

const name = instance.getString('Name')
const description = instance.getString('Description')

export default {
  example: figma.tsx`<label class="g-approw"><AppIcon id="..." size={44} /><span class="g-approw-text"><span class="g-approw-name">${name}</span><span class="g-approw-desc">${description}</span></span><Switch checked={...} onChange={...} label="${name}" /></label>`,
  imports: ["import { AppIcon, Switch } from '../kit/ui.tsx'"],
  id: 'gurtos-app-row',
  metadata: { nestable: true },
}
