// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=50-160
// source=portal/src/apps/settings.tsx
// component=g-sidebar-item
// example=<button class="g-sidebar-item" aria-current="page"><Icon name="emblem-system" />General</button>
import figma from 'figma'
const instance = figma.selectedInstance

const label = instance.getString('Label')
const current = instance.getEnum('State', { Selected: true, Default: false })
const icon = instance.getInstanceSwap('Icon')
let iconName = ''
if (icon && icon.type === 'INSTANCE') iconName = icon.executeTemplate().metadata?.props?.name ?? ''

export default {
  example: figma.tsx`<button type="button" class="g-sidebar-item"${current ? ' aria-current="page"' : ''} onClick={...}><Icon name="${iconName}" />${label}</button>`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'gurtos-sidebar-item',
  metadata: { nestable: true },
}
