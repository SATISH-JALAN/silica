// Every figure by name. <Fig name="…"/> in the docs and the README exporter both read this map.
import * as architecture from "./architecture.mjs";
import * as concepts from "./concepts.mjs";
import * as contracts from "./contracts.mjs";
import * as more from "./more.mjs";

const all = { ...architecture, ...concepts, ...contracts, ...more };
for (const k of ["txt", "tag", "badge"]) delete all[k];

/** name → SVG string (memoised: each figure is pure). */
const cache = new Map();
export function figure(name) {
  if (!cache.has(name)) {
    const f = all[name];
    if (typeof f !== "function") throw new Error(`unknown figure: ${name}`);
    cache.set(name, f());
  }
  return cache.get(name);
}
export const names = Object.keys(all);
