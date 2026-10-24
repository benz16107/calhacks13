// The Live window: the queue board, the agents, the meters, who is viewing what, and the fleet. Built from app/.
import fs from 'node:fs';

const app = new URL('./app/', import.meta.url).pathname;
export const page = () => fs.readFileSync(`${app}index.html`, 'utf8');
/** The built bundle (app/live.js, committed so the box needs no build step). */
export const bundle = () => fs.readFileSync(`${app}live.js`);
