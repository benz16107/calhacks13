// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=49-161
// source=portal/src/kit/kit.css
// component=g-field
// example=<input class="g-field" aria-label="Name" />
import figma from 'figma'
const instance = figma.selectedInstance

const value = instance.getString('Value')
const search = instance.getEnum('Kind', { Text: false, Search: true })

// The kit has no component for fields: they are plain inputs with the g-field class (34 px).
export default {
  example: search
    ? figma.tsx`<div class="g-search"><Icon name="system-search" /><input class="g-field" type="search" placeholder="${value}" aria-label="Search" /></div>`
    : figma.tsx`<input class="g-field" value="${value}" aria-label="..." />`,
  imports: search ? ["import { Icon } from '../kit/ui.tsx'"] : [],
  id: 'gurtos-text-field',
  metadata: { nestable: true },
}
