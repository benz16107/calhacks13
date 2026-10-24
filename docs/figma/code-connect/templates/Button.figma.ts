// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=49-118
// source=portal/src/kit/ui.tsx
// component=Button
// example=<Button kind="suggested" onClick={approve}>Approve $8.00</Button>
import figma from 'figma'
const instance = figma.selectedInstance

const label = instance.getString('Label')
const kind = instance.getEnum('Style', { Suggested: 'suggested', Default: 'default', Flat: 'flat', Destructive: 'destructive' })
const large = instance.getEnum('Size', { Regular: false, Large: true })
const icon = instance.getBoolean('Show icon') ? instance.getInstanceSwap('Icon') : null
let iconName
if (icon && icon.type === 'INSTANCE') iconName = icon.executeTemplate().metadata?.props?.name

export default {
  example: figma.tsx`<Button${kind !== 'default' ? figma.tsx` kind="${kind}"` : ''}${large ? ' large' : ''}${iconName ? figma.tsx` icon="${iconName}"` : ''} onClick={...}>${label}</Button>`,
  imports: ["import { Button } from '../kit/ui.tsx'"],
  id: 'gurtos-button',
  metadata: { nestable: true },
}
