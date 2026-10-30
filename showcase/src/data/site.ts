// Links used on more than one page. Change a link here and every page follows.
export const LINKS = {
  repo: 'https://github.com/benz16107/gurtos',
  site: 'https://gurtos.com', // the product landing page, editions and downloads
  docs: 'https://gurtos.com/docs',
  devpost: '', // set once the Devpost page exists
  deck: 'https://www.figma.com/slides/SBrJtJiY20k88X3IGzKwZW',
  figmaDesign: 'https://www.figma.com/design/oppzH621OOOMA31rgLbxbM',
  figmaBoard: 'https://www.figma.com/board/KvHiDv5HIJuGYOZDDkp8VG',
  figmaMake: 'https://www.figma.com/make/PuKKW48akjbEKogpI59pdL',
  protoPhone: 'https://www.figma.com/proto/oppzH621OOOMA31rgLbxbM/?node-id=23-304&starting-point-node-id=23%3A304',
  protoServer: 'https://www.figma.com/proto/oppzH621OOOMA31rgLbxbM/?node-id=24-454&starting-point-node-id=24%3A454',
  manaChat: 'https://www.mana.space/shared-chats/x5CqxyjcOgVCAyrvUBqK2LNRcMJ2/001792810018092cc50381027f1410c8fcb',
  manaPage: 'https://www.mana.space/home/x5CqxyjcOgVCAyrvUBqK2LNRcMJ2/documents/cal-hacks-13-a-computer-where-ai-agents-work-safely',
  manaApp: 'https://www.mana.space/home/x5CqxyjcOgVCAyrvUBqK2LNRcMJ2/apps/box-status',
};

export const repoFile = (path: string) => `${LINKS.repo}/blob/main/${path}`;
export const repoTree = (path: string) => `${LINKS.repo}/tree/main/${path}`;
