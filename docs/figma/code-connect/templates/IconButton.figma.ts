// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=49-131
// source=portal/src/kit/ui.tsx
// component=IconButton
// example=<IconButton icon="window-close" label="Close" onClick={close} />
import figma from 'figma'
const instance = figma.selectedInstance

const kind = instance.getEnum('Style', { Flat: 'flat', Default: 'default' })
const icon = instance.getInstanceSwap('Icon')
let iconName = ''
if (icon && icon.type === 'INSTANCE') iconName = icon.executeTemplate().metadata?.props?.name ?? ''

// label is required in code: name the action ("Close", "Pause task"), shown as the tooltip.
export default {
  example: figma.tsx`<IconButton icon="${iconName}" label="..."${kind === 'default' ? ' kind="default"' : ''} onClick={...} />`,
  imports: ["import { IconButton } from '../kit/ui.tsx'"],
  id: 'gurtos-icon-button',
  metadata: { nestable: true },
}
