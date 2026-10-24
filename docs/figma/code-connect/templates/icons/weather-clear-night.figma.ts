// url=https://www.figma.com/design/oppzH621OOOMA31rgLbxbM/GurtOS?node-id=47-3521
// source=portal/src/kit/ui.tsx
// component=Icon
import figma from 'figma'

export default {
  example: figma.tsx`<Icon name="weather-clear-night" />`,
  imports: ["import { Icon } from '../kit/ui.tsx'"],
  id: 'icon-weather-clear-night',
  metadata: { nestable: true, props: { name: 'weather-clear-night' } },
}
