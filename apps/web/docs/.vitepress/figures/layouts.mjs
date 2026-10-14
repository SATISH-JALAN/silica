// Reusable layouts built on the kit: a left-to-right chain, a "who calls what" table, a timeline.
import { node, edge, tag, txt, svg, e } from "./kit.mjs";

/**
 * Nodes in rows of `perRow`, snaking: left→right, then down, then right→left. items: [{ title, sub, tone, mono }]
 * labels: optional edge labels, labels[i] sits on the edge from item i to item i + 1.
 */
export function chain({ title, items, perRow = items.length, w = 150, h = 64, gx = 46, gy = 56, labels = [], pad = 16, snake = true, width }) {
  const rowsN = Math.ceil(items.length / perRow);
  const W = width ?? pad * 2 + perRow * w + (perRow - 1) * gx;
  const offset = (W - (perRow * w + (perRow - 1) * gx)) / 2;
  const pos = items.map((_, i) => {
    const r = Math.floor(i / perRow);
    let c = i % perRow;
    if (snake && r % 2 === 1) c = perRow - 1 - c;
    return { x: offset + c * (w + gx), y: pad + r * (h + gy), r };
  });
  let out = "";
  items.forEach((it, i) => {
    if (i === 0) return;
    const a = pos[i - 1], b = pos[i];
    const L = labels[i - 1];
    const lab = typeof L === "string" ? { label: L } : L ?? {};
    if (a.r === b.r) {
      const dir = b.x > a.x ? 1 : -1;
      const y = a.y + h / 2;
      const x1 = dir > 0 ? a.x + w : a.x;
      const x2 = dir > 0 ? b.x : b.x + w;
      out += edge([[x1, y], [x2, y]], { ...lab, at: lab.label ? [(x1 + x2) / 2, y - 8] : undefined });
    } else {
      const x = a.x + w / 2;
      out += edge([[x, a.y + h], [x, b.y]], { ...lab, at: lab.label ? [x + 8, (a.y + h + b.y) / 2 + 4] : undefined, anchor: "start" });
    }
  });
  items.forEach((it, i) => (out += node(pos[i].x, pos[i].y, w, h, it.title, it.sub, it.tone ?? "plain", { mono: it.mono })));
  const H = pad * 2 + rowsN * h + (rowsN - 1) * gy;
  return { body: out, width: W, height: H, pos, svg: () => svg({ title, width: W, height: H, body: out }) };
}

/**
 * Who calls what: callers on the left (consecutive rows from the same caller share one tall box), a role or
 * function tag on each edge, targets on the right.
 * rows: [{ from, fromSub?, fromTone?, label, labelTone?, to, toSub?, toTone?, dashed? }]
 */
export function callTable({ title, rows, width = 800, leftW = 190, rightW = 300, rowH = 46, gap = 8, top = 12, tagX }) {
  const xR = width - 16 - rightW;
  const groups = [];
  rows.forEach((r, i) => {
    const g = groups.at(-1);
    if (g && g.from === r.from) g.end = i;
    else groups.push({ from: r.from, sub: r.fromSub, tone: r.fromTone, start: i, end: i });
  });
  const yOf = (i) => top + i * rowH;
  let out = "";
  rows.forEach((r, i) => {
    const y = yOf(i) + (rowH - gap) / 2;
    out += edge([[16 + leftW, y], [xR, y]], { dashed: r.dashed, tone: r.edgeTone });
    if (r.label) out += tag(tagX ?? (16 + leftW + xR) / 2, y, r.label, r.labelTone ?? "accent");
    out += node(xR, yOf(i), rightW, rowH - gap, r.to, r.toSub, r.toTone ?? "plain", { mono: true, align: "start" });
  });
  groups.forEach((g) => {
    const y = yOf(g.start);
    const h = yOf(g.end) + rowH - gap - y;
    out += node(16, y, leftW, h, g.from, g.sub, g.tone ?? "plain");
  });
  const height = top * 2 + rows.length * rowH - gap;
  return svg({ title, width, height, body: out });
}

/**
 * A time axis with tracks. tracks: [{ label, segments: [{ from, to, tone, label }], points: [{ at, tone, label, sub }] }]
 * times are numbers on one scale; fmtTick formats the axis.
 */
export function timeline({ title, start, end, ticks, fmtTick, tracks, width = 800, labelW = 130, trackH = 74, heading }) {
  const L = 16 + labelW, R = width - 28;
  const X = (t) => L + ((t - start) / (end - start)) * (R - L);
  const top = heading ? 40 : 16;
  let out = heading ? `<text x="16" y="22" class="dg-chart-title">${e(heading)}</text>` : "";
  const axisY = top + tracks.length * trackH + 8;
  for (const t of ticks) {
    out += `<line x1="${X(t)}" y1="${top}" x2="${X(t)}" y2="${axisY}" class="dg-grid"/>`;
    out += `<text x="${X(t)}" y="${axisY + 18}" text-anchor="middle" class="dg-axis">${e(fmtTick(t))}</text>`;
  }
  out += `<line x1="${L}" y1="${axisY}" x2="${R}" y2="${axisY}" class="dg-axis-line"/>`;
  tracks.forEach((tr, i) => {
    const y = top + i * trackH + trackH / 2 + 6;
    out += `<text x="16" y="${y + 4}" class="dg-label">${e(tr.label.toUpperCase())}</text>`;
    for (const s of tr.segments ?? []) {
      out += `<line x1="${X(s.from) + 5}" y1="${y}" x2="${X(s.to) - 5}" y2="${y}" class="dg-track dg-track-${s.tone ?? "accent"}"/>`;
      if (s.label) out += `<text x="${(X(s.from) + X(s.to)) / 2}" y="${y - 14}" text-anchor="middle" class="dg-elabel">${e(s.label)}</text>`;
      if (s.sub) out += `<text x="${(X(s.from) + X(s.to)) / 2}" y="${y + 24}" text-anchor="middle" class="dg-axis">${e(s.sub)}</text>`;
    }
    for (const p of tr.points ?? []) {
      out += `<circle cx="${X(p.at)}" cy="${y}" r="7" class="dg-dot-${p.tone ?? "accent"}"/>`;
      if (p.label) out += `<text x="${X(p.at)}" y="${y - 14}" text-anchor="${p.anchor ?? "middle"}" class="dg-elabel">${e(p.label)}</text>`;
      if (p.sub) out += `<text x="${X(p.at)}" y="${y + 24}" text-anchor="${p.anchor ?? "middle"}" class="dg-axis">${e(p.sub)}</text>`;
    }
  });
  const height = axisY + 32;
  return svg({ title, width, height, body: out, minWidth: 560 });
}
export { txt };
