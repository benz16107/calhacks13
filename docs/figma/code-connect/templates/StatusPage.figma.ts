// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=69-294
// source=portal/src/kit/ui.tsx
// component=StatusPage
// example=<StatusPage icon="object-select" title="Nothing needs you">Tasks that ask for an OK show here.</StatusPage>
import figma from 'figma'
const instance = figma.selectedInstance

const title = instance.getString('Title')
const body = instance.getString('Body')
const button = instance.getBoolean('Show button')
const icon = instance.getInstanceSwap('Icon')
let iconName = ''
if (icon && icon.type === 'INSTANCE') iconName = icon.executeTemplate().metadata?.props?.name ?? ''

export default {
  example: figma.tsx`<StatusPage icon="${iconName}" title="${title}"${button ? ' action={<Button onClick={...}>...</Button>}' : ''}>${body}</StatusPage>`,
  imports: ["import { StatusPage, Button } from '../kit/ui.tsx'"],
  id: 'gurtos-status-page',
  metadata: { nestable: false },
}
