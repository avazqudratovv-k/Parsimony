import { MONO, SERIF, tokens } from "../theme";

/** Everything printed on the month-end receipt, already in the person's language. */
export type ReceiptModel = {
  heading: [string, string];
  rows: [string, string][];
  totalsTitle: string;
  totals: [string, string][];
  vs: [string, string] | null;
  closed: string;
};

const W = 300, PAD_X = 20, PAD_TOP = 22, PAD_BOTTOM = 26, LINE = 20, TOOTH = 12, TOOTH_H = 8;
const GREEN = "#1F6F5C";

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  return out;
}

/** Draws the receipt (paper colour in light and dark alike, torn bottom) and returns it as a PNG. */
export async function receiptToPng(m: ReceiptModel, scale = 3): Promise<Blob> {
  const p = tokens.light;
  await Promise.all([
    document.fonts.load('400 13px "IBM Plex Mono"'), document.fonts.load('500 15px "IBM Plex Mono"'),
    document.fonts.load('italic 500 22px "Newsreader"'),
  ]).catch(() => undefined);
  const icon = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/icon.svg";
  });

  const inner = W - PAD_X * 2;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = `400 13px ${MONO}`;
  const rowLines = (label: string, value: string) => {
    const room = inner - measure.measureText(value).width - 12;
    return wrap(measure, label, Math.max(room, 60)).length;
  };
  // First pass: how tall is it?
  let h = PAD_TOP + 40 + 8 + 24 + LINE * 2 + 25;
  h += m.rows.reduce((n, [a, b]) => n + rowLines(a, b) * LINE, 0) + 25;
  h += 18 + m.totals.length * 24 + 25;
  if (m.vs) h += rowLines(m.vs[0], m.vs[1]) * LINE;
  h += 8 + LINE + PAD_BOTTOM;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = Math.ceil(h) * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Paper with a zigzag bottom edge.
  ctx.fillStyle = p.paper;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W, 0);
  ctx.lineTo(W, h - TOOTH_H);
  for (let x = W; x > 0; x -= TOOTH) {
    ctx.lineTo(x - TOOTH / 2, h);
    ctx.lineTo(Math.max(x - TOOTH, 0), h - TOOTH_H);
  }
  ctx.closePath();
  ctx.fill();

  let y = PAD_TOP;
  // Logo row, centred.
  ctx.font = `italic 500 22px ${SERIF}`;
  ctx.textBaseline = "alphabetic";
  const word = "Parsimony";
  const wordW = ctx.measureText(word).width, dotW = ctx.measureText(".").width;
  const total = 40 + 8 + wordW + dotW;
  const x0 = (W - total) / 2;
  if (icon) ctx.drawImage(icon, x0, y, 40, 40);
  ctx.fillStyle = p.paperInk;
  ctx.fillText(word, x0 + 48, y + 28);
  ctx.fillStyle = GREEN;
  ctx.fillText(".", x0 + 48 + wordW, y + 28);
  y += 40 + 8;

  ctx.font = `400 13px ${MONO}`;
  ctx.textAlign = "center";
  ctx.fillStyle = p.paperInk;
  y += 24; ctx.fillText(m.heading[0], W / 2, y - 6);
  y += 0; ctx.fillText(m.heading[1], W / 2, y + LINE - 6);
  y += LINE;

  const dash = () => {
    y += 12;
    ctx.strokeStyle = p.paperLine; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(PAD_X, y); ctx.lineTo(W - PAD_X, y); ctx.stroke();
    ctx.setLineDash([]);
    y += 13;
  };
  const row = (label: string, value: string, big = false) => {
    ctx.font = `${big ? 500 : 400} ${big ? 15 : 13}px ${MONO}`;
    ctx.fillStyle = p.paperInk;
    const lineH = big ? 24 : LINE;
    const room = inner - ctx.measureText(value).width - 12;
    const parts = wrap(ctx, label, Math.max(room, 60));
    parts.forEach((part, i) => {
      ctx.textAlign = "left";
      ctx.fillText(part, PAD_X, y + lineH * (i + 1) - 6);
      if (i === 0) { ctx.textAlign = "right"; ctx.fillText(value, W - PAD_X, y + lineH - 6); }
    });
    y += lineH * parts.length;
  };

  dash();
  m.rows.forEach(([a, b]) => row(a, b));
  dash();
  ctx.font = `400 11px ${MONO}`;
  ctx.textAlign = "left";
  ctx.fillStyle = p.paperMuted;
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "1.1px";
  ctx.fillText(m.totalsTitle, PAD_X, y + 12);
  if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "0px";
  y += 18;
  m.totals.forEach(([a, b]) => row(a, b, true));
  dash();
  if (m.vs) row(m.vs[0], m.vs[1]);
  y += 8;
  ctx.font = `400 11px ${MONO}`;
  ctx.textAlign = "center";
  ctx.fillStyle = p.paperMuted;
  ctx.fillText(m.closed, W / 2, y + 14);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("png"))), "image/png"));
}
