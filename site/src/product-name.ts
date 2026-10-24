// Markdown plugin: puts the configured product name (src/product.ts) into every page's prose.
// Code is left exactly as written.
import type { HastPluginDefinition } from 'satteri';
import { named } from './product.ts';

export const productName: HastPluginDefinition = {
  name: 'product-name',
  text(node, ctx) {
    for (let p = ctx.parent(node) as { tagName?: string; type: string } | undefined; p; p = ctx.parent(p as never) as typeof p) {
      if (p.tagName === 'code' || p.tagName === 'pre') return;
      if (p.type === 'root') break;
    }
    const value = named(node.value);
    if (value !== node.value) return { ...node, value };
  },
};
