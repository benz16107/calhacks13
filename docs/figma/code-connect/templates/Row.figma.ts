// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=50-147
// source=portal/src/kit/ui.tsx
// component=Row
// example=<SwitchRow icon="security-high" title="Ask before spending" sub="Over $5.00" checked={on} onChange={setOn} />
import figma from 'figma'
const instance = figma.selectedInstance

const title = instance.getString('Title')
const sub = instance.getBoolean('Show subtitle') ? instance.getString('Subtitle') : ''
const value = instance.getString('Value')
const trailing = instance.getEnum('Trailing', { Switch: 'switch', Combo: 'combo', Disclosure: 'disclosure', Value: 'value', Button: 'button' })
const icon = instance.getBoolean('Show icon') ? instance.getInstanceSwap('Icon') : null
let iconName
if (icon && icon.type === 'INSTANCE') iconName = icon.executeTemplate().metadata?.props?.name

const lead = figma.tsx`${iconName ? figma.tsx` icon="${iconName}"` : ''} title="${title}"${sub ? figma.tsx` sub="${sub}"` : ''}`
let example
if (trailing === 'switch') example = figma.tsx`<SwitchRow${lead} checked={...} onChange={(on) => ...} />`
else if (trailing === 'combo') example = figma.tsx`<ComboRow${lead} value="${value}" options={[["${value}", "${value}"]]} onChange={(v) => ...} />`
else if (trailing === 'disclosure') example = figma.tsx`<LinkRow${lead} onClick={...} />`
else if (trailing === 'value') example = figma.tsx`<LinkRow${lead} value="${value}" onClick={...} />`
else example = figma.tsx`<Row${lead}><Button onClick={...}>${value}</Button></Row>`

export default {
  example,
  imports: ["import { Row, SwitchRow, ComboRow, LinkRow, Button } from '../kit/ui.tsx'"],
  id: 'gurtos-row',
  metadata: { nestable: true },
}
