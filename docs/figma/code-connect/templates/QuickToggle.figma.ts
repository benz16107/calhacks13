// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=69-315
// source=portal/src/shell.tsx
// component=Tile
// example=<Tile icon="night-light" label="Quiet hours" on={on} onClick={toggle} />
import figma from 'figma'
const instance = figma.selectedInstance

const label = instance.getString('Label')
const sub = instance.getString('Subtitle')
const on = instance.getEnum('State', { On: 'true', Off: 'false' })
const icon = instance.getInstanceSwap('Icon')
let iconName = ''
if (icon && icon.type === 'INSTANCE') iconName = icon.executeTemplate().metadata?.props?.name ?? ''

// Tile is internal to Control Center in shell.tsx.
export default {
  example: figma.tsx`<Tile icon="${iconName}" label="${label}" sub="${sub}" on={${on}} onClick={...} />`,
  imports: [],
  id: 'gurtos-quick-toggle',
  metadata: { nestable: true },
}
