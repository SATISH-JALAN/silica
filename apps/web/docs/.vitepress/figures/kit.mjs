// A small SVG diagram kit. Every function returns an SVG string, so the same figures render inline in the
// docs (through the <Fig> component) and as the README's PNGs (rendered by the exporter). Colours are CSS
// classes resolved by figures.css, so one drawing serves both the dark docs and a light README variant.

/** Escape text for SVG. */
export const e = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const lines = (sub) => (sub === undefined || sub === null ? [] : Array.isArray(sub) ? sub : [sub]);

/** The whole figure: a fixed grid that scales to the column. */
export function svg({ title, width, height, body, minWidth = 600 }) {
  return (
    `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${e(title)}" class="dg-svg" ` +
    `style="min-width:${Math.min(minWidth, width)}px" xmlns="http://www.w3.org/2000/svg"><title>${e(title)}</title>${body}</svg>`
  );
}

/** A box with a title and up to three sub-lines, centred. */
export function node(x, y, w, h, title, sub, tone = "plain", { mono = false, r = 10, align = "middle" } = {}) {
  const ls = lines(sub);
  const total = 16 + ls.length * 15;
  const top = y + h / 2 - total / 2 + 12;
  const tx = align === "start" ? x + 14 : x + w / 2;
  return (
    `<g class="dg-node dg-${tone}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>` +
    `<text x="${tx}" y="${top}" text-anchor="${align}" class="dg-title${mono ? " dg-mono" : ""}">${e(title)}</text>` +
    ls.map((l, i) => `<text x="${tx}" y="${top + 17 + i * 15}" text-anchor="${align}" class="dg-sub">${e(l)}</text>`).join("") +
    `</g>`
  );
}

/** A pill-shaped state, for state machines. */
export const state = (x, y, w, h, title, sub, tone = "plain") => node(x, y, w, h, title, sub, tone, { r: h / 2 });

/** A filled dot (start) or ringed dot (end) for a state machine. */
export const terminal = (cx, cy, end = false) =>
  end
    ? `<g class="dg-term"><circle cx="${cx}" cy="${cy}" r="9" class="dg-term-ring"/><circle cx="${cx}" cy="${cy}" r="5"/></g>`
    : `<g class="dg-term"><circle cx="${cx}" cy="${cy}" r="7"/></g>`;

/** A decision diamond with a short question. */
export function decision(cx, cy, w, h, title, sub) {
  return (
    `<g class="dg-node dg-decision"><polygon points="${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}"/>` +
    `<text x="${cx}" y="${sub ? cy - 2 : cy + 4}" text-anchor="middle" class="dg-title">${e(title)}</text>` +
    (sub ? `<text x="${cx}" y="${cy + 13}" text-anchor="middle" class="dg-sub">${e(sub)}</text>` : "") +
    `</g>`
  );
}

/** A dashed boundary around a group, labelled at its top left. */
export const zone = (x, y, w, h, label, tone = "plain", { bottom = false, right = false } = {}) =>
  `<g class="dg-zone dg-${tone}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14"/>` +
  `<text x="${right ? x + w - 14 : x + 14}" y="${bottom ? y + h - 11 : y + 20}" text-anchor="${right ? "end" : "start"}" class="dg-zone-label">${e(label)}</text></g>`;

function head([x1, y1], [x2, y2], size = 7) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p = (da) => [x2 - size * Math.cos(a - da), y2 - size * Math.sin(a - da)];
  const [l, r] = [p(0.45), p(-0.45)];
  return `${x2},${y2} ${l[0].toFixed(1)},${l[1].toFixed(1)} ${r[0].toFixed(1)},${r[1].toFixed(1)}`;
}

/** An arrow along a polyline; the head is drawn from the last segment, so no SVG markers or ids are needed. */
export function edge(points, { label, at, dashed, both, tone, anchor = "middle", sub, noHead } = {}) {
  const d = points.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ");
  let pos = at;
  if (label && !pos) {
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      const [a, b] = [points[i - 1], points[i]];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len > best) {
        best = len;
        pos = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 7];
      }
    }
  }
  const n = points.length;
  return (
    `<g class="dg-edge${tone ? ` dg-edge-${tone}` : ""}"><path d="${d}"${dashed ? ' class="dg-dashed"' : ""}/>` +
    (noHead ? "" : `<polygon points="${head(points[n - 2], points[n - 1])}"/>`) +
    (both ? `<polygon points="${head(points[1], points[0])}"/>` : "") +
    (label && pos ? `<text x="${pos[0]}" y="${pos[1]}" text-anchor="${anchor}" class="dg-elabel">${e(label)}</text>` : "") +
    (sub && pos ? `<text x="${pos[0]}" y="${pos[1] + 14}" text-anchor="${anchor}" class="dg-elabel dg-elabel-sub">${e(sub)}</text>` : "") +
    `</g>`
  );
}

/** Free text. kind: sub | title | mono | label | elabel | big */
export const txt = (x, y, s, { anchor = "start", kind = "sub" } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" class="dg-${kind}">${e(s)}</text>`;

/** A numbered circle, for step callouts. */
export const badge = (x, y, n, tone = "accent") =>
  `<g class="dg-badge dg-badge-${tone}"><circle cx="${x}" cy="${y}" r="10"/><text x="${x}" y="${y + 4}" text-anchor="middle">${e(n)}</text></g>`;

/** A small rounded tag, e.g. a role name on an edge. */
export function tag(x, y, s, tone = "accent", { anchor = "middle" } = {}) {
  const w = s.length * 6.4 + 16;
  const x0 = anchor === "middle" ? x - w / 2 : anchor === "end" ? x - w : x;
  return (
    `<g class="dg-tag dg-${tone}"><rect x="${x0}" y="${y - 11}" width="${w}" height="20" rx="10"/>` +
    `<text x="${x0 + w / 2}" y="${y + 3}" text-anchor="middle">${e(s)}</text></g>`
  );
}

/** A table-like card: header plus rows of [left, right] (an Envio entity, a contract surface). */
export function card(x, y, w, titleText, rows, tone = "plain", { rowH = 19, mono = true } = {}) {
  const h = 34 + rows.length * rowH + 8;
  let out = `<g class="dg-node dg-${tone}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>`;
  out += `<text x="${x + 14}" y="${y + 22}" class="dg-title">${e(titleText)}</text>`;
  out += `<line x1="${x}" y1="${y + 33}" x2="${x + w}" y2="${y + 33}" class="dg-rule"/>`;
  rows.forEach((r, i) => {
    const [a, b] = Array.isArray(r) ? r : [r, ""];
    const ty = y + 33 + 16 + i * rowH;
    out += `<text x="${x + 14}" y="${ty}" class="dg-sub${mono ? " dg-mono" : ""}">${e(a)}</text>`;
    if (b) out += `<text x="${x + w - 14}" y="${ty}" text-anchor="end" class="dg-sub dg-dim">${e(b)}</text>`;
  });
  return out + `</g>`;
}
export const cardHeight = (n, rowH = 19) => 34 + n * rowH + 8;

/* ---------------------------------------------------------------------------------------------------- */
/* Sequence diagrams: actors across the top, messages down the page, laid out from data.                 */

const HEAD = 56;
const ROW = 46;
const NOTE = 38;

/**
 * steps:
 *   { from, to, label, detail?, dashed?, tone? }    a message (from === to draws a self-loop)
 *   { note, over: id | [id, id], tone? }           a note across one or more lifelines
 *   { section: "Issue", tone? }                    a labelled band that runs until the next section
 */
export function sequence({ title, actors, steps, col = 150, numbered = false, width: minW = 640 }) {
  const width = Math.max(minW, actors.length * col + 24);
  const gap = (width - 24) / actors.length;
  const X = (id) => {
    const i = actors.findIndex((a) => a.id === id);
    if (i < 0) throw new Error(`sequence: unknown actor ${id}`);
    return 12 + gap * i + gap / 2;
  };
  let y = HEAD + 26;
  const rows = steps.map((s) => {
    const top = y;
    const self = "from" in s && s.from === s.to;
    y += "section" in s ? 30 : "note" in s ? NOTE + 10 : self ? ROW + 14 + (s.detail ? 6 : 0) : ROW + (s.detail ? 10 : 0);
    return { s, top };
  });
  const height = y + 12;

  // section bands sit behind everything
  let bands = "";
  const secs = rows.filter((r) => "section" in r.s);
  secs.forEach((r, i) => {
    const end = i + 1 < secs.length ? secs[i + 1].top - 6 : height - 8;
    bands +=
      `<g class="dg-band dg-${r.s.tone ?? "accent"}"><rect x="6" y="${r.top}" width="${width - 12}" height="${end - r.top}" rx="10"/>` +
      `<text x="20" y="${r.top + 19}" class="dg-zone-label">${e(r.s.section)}</text></g>`;
  });

  let out = bands;
  for (const a of actors) {
    out += `<line x1="${X(a.id)}" y1="${HEAD}" x2="${X(a.id)}" y2="${height - 8}" class="dg-lifeline"/>`;
    out +=
      `<g class="dg-node dg-${a.tone ?? "plain"}"><rect x="${X(a.id) - gap / 2 + 8}" y="6" width="${gap - 16}" height="${HEAD - 10}" rx="10"/>` +
      `<text x="${X(a.id)}" y="${a.sub ? 27 : 34}" text-anchor="middle" class="dg-title${a.mono ? " dg-mono" : ""}">${e(a.label)}</text>` +
      (a.sub ? `<text x="${X(a.id)}" y="${43}" text-anchor="middle" class="dg-sub">${e(a.sub)}</text>` : "") +
      `</g>`;
  }
  let n = 0;
  for (const { s, top } of rows) {
    if ("section" in s) continue;
    if ("note" in s) {
      const [a, b] = Array.isArray(s.over) ? s.over : [s.over, s.over];
      const mid = (X(a) + X(b)) / 2;
      const half = Math.max((Math.abs(X(b) - X(a)) + gap) / 2 - 16, (s.note.length * 6.1) / 2 + 18);
      const x1 = Math.max(8, Math.min(mid - half, width - 8 - 2 * half));
      out +=
        `<g class="dg-node dg-${s.tone ?? "muted"}"><rect x="${x1}" y="${top}" width="${2 * half}" height="${NOTE}" rx="8"/>` +
        `<text x="${x1 + half}" y="${top + NOTE / 2 + 4}" text-anchor="middle" class="dg-sub">${e(s.note)}</text></g>`;
      continue;
    }
    n++;
    const x1 = X(s.from);
    const x2 = X(s.to);
    const cls = `dg-edge${s.tone ? ` dg-edge-${s.tone}` : ""}`;
    const num = numbered ? `${n}  ` : "";
    if (x1 === x2) {
      const yy = top + 12;
      const k = s.from === actors.at(-1).id ? -1 : 1;
      const anchor = k > 0 ? "start" : "end";
      out +=
        `<g class="${cls}"><path d="M${x1},${yy} H${x1 + k * 30} V${yy + 22} H${x1 + k * 4}"${s.dashed ? ' class="dg-dashed"' : ""}/>` +
        `<polygon points="${x1 + k * 2},${yy + 22} ${x1 + k * 9},${yy + 18.5} ${x1 + k * 9},${yy + 25.5}"/>` +
        `<text x="${x1 + k * 38}" y="${yy + 9}" text-anchor="${anchor}" class="dg-elabel">${e(num + s.label)}</text>` +
        (s.detail ? `<text x="${x1 + k * 38}" y="${yy + 24}" text-anchor="${anchor}" class="dg-elabel dg-elabel-sub">${e(s.detail)}</text>` : "") +
        `</g>`;
      continue;
    }
    const dir = x2 > x1 ? 1 : -1;
    const yy = top + 26;
    out +=
      `<g class="${cls}"><path d="M${x1},${yy} H${x2 - dir * 2}"${s.dashed ? ' class="dg-dashed"' : ""}/>` +
      `<polygon points="${x2},${yy} ${x2 - dir * 8},${yy - 4} ${x2 - dir * 8},${yy + 4}"/>` +
      `<text x="${(x1 + x2) / 2}" y="${yy - 8}" text-anchor="middle" class="dg-elabel">${e(num + s.label)}</text>` +
      (s.detail ? `<text x="${(x1 + x2) / 2}" y="${yy + 16}" text-anchor="middle" class="dg-elabel dg-elabel-sub">${e(s.detail)}</text>` : "") +
      `</g>`;
  }
  return svg({ title, width, height, body: out, minWidth: Math.min(width, 620) });
}

/* ---------------------------------------------------------------------------------------------------- */
/* Charts                                                                                                */

const fmt = (v, d) => (d === undefined ? String(v) : v.toFixed(d));

/** Vertical bars with value labels. bars: [{ label, value, tone?, note? }] */
export function bars({ title, items, max, unit = "", yLabel, decimals, width = 720, height = 300, ticks = 4, valueFmt }) {
  const L = 64, R = 20, T = 40, B = 46;
  const pw = width - L - R, ph = height - T - B;
  const step = pw / items.length;
  const bw = Math.min(64, step * 0.56);
  let out = `<text x="${L}" y="22" class="dg-chart-title">${e(title)}</text>`;
  for (let i = 0; i <= ticks; i++) {
    const v = (max / ticks) * i;
    const y = T + ph - (ph * i) / ticks;
    out += `<line x1="${L}" y1="${y}" x2="${width - R}" y2="${y}" class="dg-grid"/>`;
    out += `<text x="${L - 10}" y="${y + 4}" text-anchor="end" class="dg-axis">${e(valueFmt ? valueFmt(v) : fmt(v, decimals) + unit)}</text>`;
  }
  if (yLabel) out += `<text transform="translate(16 ${T + ph / 2}) rotate(-90)" text-anchor="middle" class="dg-axis">${e(yLabel)}</text>`;
  items.forEach((it, i) => {
    const cx = L + step * i + step / 2;
    const h = (ph * it.value) / max;
    const y = T + ph - h;
    if (it.value > 0) out += `<rect x="${cx - bw / 2}" y="${y}" width="${bw}" height="${h}" rx="5" class="dg-bar dg-bar-${it.tone ?? "accent"}"/>`;
    out += `<text x="${cx}" y="${it.value > 0 ? y - 8 : T + ph - 8}" text-anchor="middle" class="dg-bar-value">${e(it.text ?? (valueFmt ? valueFmt(it.value) : fmt(it.value, decimals) + unit))}</text>`;
    out += `<text x="${cx}" y="${T + ph + 20}" text-anchor="middle" class="dg-axis-label">${e(it.label)}</text>`;
    if (it.note) out += `<text x="${cx}" y="${T + ph + 36}" text-anchor="middle" class="dg-axis">${e(it.note)}</text>`;
  });
  out += `<line x1="${L}" y1="${T + ph}" x2="${width - R}" y2="${T + ph}" class="dg-axis-line"/>`;
  return svg({ title, width, height, body: out, minWidth: 520 });
}

/** A line with points and labels. points: [{ label, value, note? }] */
export function lineChart({ title, points, min, max, ticks = 4, decimals = 2, prefix = "", width = 720, height = 300, highlight }) {
  const L = 64, R = 28, T = 40, B = 46;
  const pw = width - L - R, ph = height - T - B;
  const inset = 44;
  const step = (pw - 2 * inset) / (points.length - 1 || 1);
  const Y = (v) => T + ph - ((v - min) / (max - min)) * ph;
  let out = `<text x="${L}" y="22" class="dg-chart-title">${e(title)}</text>`;
  for (let i = 0; i <= ticks; i++) {
    const v = min + ((max - min) / ticks) * i;
    out += `<line x1="${L}" y1="${Y(v)}" x2="${width - R}" y2="${Y(v)}" class="dg-grid"/>`;
    out += `<text x="${L - 10}" y="${Y(v) + 4}" text-anchor="end" class="dg-axis">${e(prefix + v.toFixed(decimals))}</text>`;
  }
  const pts = points.map((p, i) => [L + inset + step * i, Y(p.value)]);
  const area = `M${pts[0][0]},${T + ph} ` + pts.map((p) => `L${p[0]},${p[1]}`).join(" ") + ` L${pts.at(-1)[0]},${T + ph} Z`;
  out += `<path d="${area}" class="dg-area"/>`;
  out += `<path d="${pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join(" ")}" class="dg-line"/>`;
  points.forEach((p, i) => {
    const [x, y] = pts[i];
    out += `<circle cx="${x}" cy="${y}" r="${highlight === i ? 6 : 4.5}" class="dg-point${highlight === i ? " dg-point-hot" : ""}"/>`;
    out += `<text x="${x}" y="${y - 12}" text-anchor="middle" class="dg-bar-value">${e(prefix + p.value.toFixed(decimals))}</text>`;
    out += `<text x="${x}" y="${T + ph + 20}" text-anchor="middle" class="dg-axis-label">${e(p.label)}</text>`;
    if (p.note) out += `<text x="${x}" y="${T + ph + 36}" text-anchor="middle" class="dg-axis">${e(p.note)}</text>`;
  });
  return svg({ title, width, height, body: out, minWidth: 520 });
}

/** A proportion bar (in place of a pie): parts: [{ label, value, tone, text? }] */
export function split({ title, parts, width = 720, total, unit = "", decimals = 2, caption }) {
  const L = 24, R = 24, T = 44, H = 34;
  const pw = width - L - R;
  const sum = total ?? parts.reduce((a, p) => a + p.value, 0);
  let out = `<text x="${L}" y="24" class="dg-chart-title">${e(title)}</text>`;
  let x = L;
  parts.forEach((p, i) => {
    const w = Math.max(3, (pw * p.value) / sum);
    const r = i === 0 || i === parts.length - 1 ? 8 : 0;
    out += `<rect x="${x}" y="${T}" width="${w}" height="${H}" rx="${r}" class="dg-bar dg-bar-${p.tone}"/>`;
    x += w;
  });
  // legend rows
  parts.forEach((p, i) => {
    const y = T + H + 32 + i * 26;
    const pct = ((100 * p.value) / sum).toFixed(1);
    out += `<rect x="${L}" y="${y - 11}" width="12" height="12" rx="3" class="dg-bar dg-bar-${p.tone}"/>`;
    out += `<text x="${L + 22}" y="${y}" class="dg-axis-label">${e(p.label)}</text>`;
    out += `<text x="${width - R}" y="${y}" text-anchor="end" class="dg-bar-value">${e(p.text ?? unit + p.value.toFixed(decimals))}<tspan class="dg-axis">  ·  ${pct}%</tspan></text>`;
  });
  const height = T + H + 32 + parts.length * 26 + (caption ? 14 : 0);
  if (caption) out += `<text x="${L}" y="${height - 8}" class="dg-axis">${e(caption)}</text>`;
  return svg({ title, width, height, body: out, minWidth: 520 });
}
