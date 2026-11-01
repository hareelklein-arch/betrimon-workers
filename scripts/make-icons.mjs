import { deflateSync } from "zlib";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const GREEN = [0x1f, 0x6f, 0x4a, 0xff];
const CREAM = [0xf3, 0xef, 0xe6, 0xff];

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

function rgbaPng(width, height, rgba) {
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0;
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function setPixel(rgba, size, x, y, color) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= size || iy >= size) return;
  const i = (iy * size + ix) * 4;
  rgba[i] = color[0];
  rgba[i + 1] = color[1];
  rgba[i + 2] = color[2];
  rgba[i + 3] = color[3];
}

function fillRect(rgba, size, x0, y0, x1, y1, color) {
  const minX = Math.max(0, Math.floor(x0));
  const minY = Math.max(0, Math.floor(y0));
  const maxX = Math.min(size - 1, Math.ceil(x1));
  const maxY = Math.min(size - 1, Math.ceil(y1));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) setPixel(rgba, size, x, y, color);
  }
}

function fillCircle(rgba, size, cx, cy, r, color) {
  const minX = Math.max(0, Math.floor(cx - r));
  const minY = Math.max(0, Math.floor(cy - r));
  const maxX = Math.min(size - 1, Math.ceil(cx + r));
  const maxY = Math.min(size - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) setPixel(rgba, size, x, y, color);
    }
  }
}

function cubic(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function strokeCubic(rgba, size, x0, y0, x1, y1, x2, y2, x3, y3, width, color) {
  const steps = Math.max(48, Math.ceil(size * 1.5));
  const r = width / 2;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    fillCircle(rgba, size, cubic(x0, x1, x2, x3, t), cubic(y0, y1, y2, y3, t), r, color);
  }
}

function drawIcon(size, { pad = 0 } = {}) {
  const rgba = Buffer.alloc(size * size * 4, 0);
  fillRect(rgba, size, 0, 0, size, size, GREEN);
  const inner = size - pad * 2;
  const s = inner / 64;
  const o = pad;
  fillCircle(rgba, size, o + 24 * s, o + 24 * s, 5 * s, CREAM);
  fillCircle(rgba, size, o + 40 * s, o + 24 * s, 5 * s, CREAM);
  strokeCubic(rgba, size, o + 16 * s, o + 40 * s, o + 22 * s, o + 28 * s, o + 42 * s, o + 28 * s, o + 48 * s, o + 40 * s, 4 * s, CREAM);
  return rgbaPng(size, size, rgba);
}

writeFileSync(join(dir, "icon-192.png"), drawIcon(192));
writeFileSync(join(dir, "icon-512.png"), drawIcon(512));
writeFileSync(join(dir, "icon-512-maskable.png"), drawIcon(512, { pad: 80 }));
writeFileSync(join(dir, "apple-touch-icon.png"), drawIcon(180));
console.log("icons written");
