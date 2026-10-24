// The product's name lives here. The docs' prose is written with the name below (WRITTEN). To rename the product,
// change NAME: every page's titles, headings, text, OpenGraph images and llms.txt follow at build time.
// Two places hold the name as literal text and need a hand edit: openapi/box-api.yaml and the screenshots.
export const NAME = 'GurtOS';

/** The word the docs are written with. Leave it alone when renaming; change NAME instead. */
const WRITTEN = 'GurtOS';

export const DESCRIPTION = `${NAME} is an operating system for computers where AI agents do real work. Each task runs as its own Linux user, in its own copy of your files, without your keys.`;

const pattern = new RegExp(`\\b${WRITTEN}\\b`, 'g');

/** Swap the written name for NAME in a piece of prose. */
export const named = (text: string) => (NAME === WRITTEN ? text : text.replace(pattern, NAME));
