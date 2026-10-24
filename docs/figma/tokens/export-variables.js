// Exports every local variable in the open Figma file as JSON: collections, modes, and each variable's value in
// every mode. Colours become #RRGGBB, or #RRGGBBAA when not opaque. Aliases are resolved, and the alias name is kept.
// Run it through the Figma MCP's use_figma (it returns the object), or paste it into a plugin console and copy the
// logged JSON. Save the result as docs/figma/tokens/figma-variables.json.
const hex2 = (n) => Math.round(n * 255).toString(16).padStart(2, '0').toUpperCase();
const hex = (c) => '#' + hex2(c.r) + hex2(c.g) + hex2(c.b) + (c.a !== undefined && Math.round(c.a * 255) !== 255 ? hex2(c.a) : '');
const vars = await figma.variables.getLocalVariablesAsync();
const byId = Object.fromEntries(vars.map((v) => [v.id, v]));
const cols = await figma.variables.getLocalVariableCollectionsAsync();
const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const resolve = (v, modeId, seen = 0) => {
  const raw = v.valuesByMode[modeId] ?? Object.values(v.valuesByMode)[0];
  if (raw && typeof raw === 'object' && raw.type === 'VARIABLE_ALIAS') {
    const t = byId[raw.id];
    if (!t || seen > 10) return { value: null, alias: raw.id };
    const tCol = cols.find((c) => c.id === t.variableCollectionId);
    // Follow the alias into the mode with the same name, else the target collection's default mode.
    const modeName = cols.find((c) => c.id === v.variableCollectionId).modes.find((x) => x.modeId === modeId)?.name;
    const tMode = tCol.modes.find((m) => m.name === modeName)?.modeId ?? tCol.defaultModeId;
    return { value: resolve(t, tMode, seen + 1).value, alias: t.name };
  }
  if (v.resolvedType === 'COLOR') return { value: hex(raw) };
  return { value: raw };
};
const out = { file: figma.root.name, collections: {} };
for (const c of [...cols].sort((a, b) => a.name.localeCompare(b.name))) {
  const variables = {};
  for (const v of vars.filter((x) => x.variableCollectionId === c.id).sort((a, b) => a.name.localeCompare(b.name))) {
    const values = {};
    for (const m of c.modes) {
      const r = resolve(v, m.modeId);
      values[m.name] = r.alias ? { alias: r.alias, value: r.value } : r.value;
    }
    variables[v.name] = { type: v.resolvedType, scopes: [...v.scopes].sort(), values: sortKeys(values) };
  }
  out.collections[c.name] = { id: c.id, modes: c.modes.map((m) => m.name), variables };
}
if (typeof console !== 'undefined') console.log(JSON.stringify(out, null, 2));
return out;
