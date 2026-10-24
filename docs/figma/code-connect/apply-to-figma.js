// Run through the Figma MCP's use_figma (or a plugin console) with MAP set to the contents of map.json.
// It writes each mapping into its Figma component: the kit's usage in the description and the source line as the
// documentation link, so Dev Mode shows the real code on any plan. Safe to run again: it replaces its own section.
const MARK = '\n\nCode (GurtOS kit): ';
const out = { updated: 0, missing: [] };
for (const m of MAP) {
  const node = await figma.getNodeByIdAsync(m.node);
  if (!node || !('documentationLinks' in node)) { out.missing.push(m.node + ' ' + m.component); continue; }
  const base = (node.description || '').split(MARK)[0].trim();
  const file = m.link.split('/blob/main/')[1];
  node.description = (base ? base : '') + MARK + m.example + '\nSource: ' + file.replace('#L', ', line ') + (m.component.startsWith('g-') ? ' (class ' + m.component + ')' : '');
  node.documentationLinks = [{ uri: m.link }];
  out.updated++;
}
return out;
