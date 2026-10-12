// Renders the app's raster icons (public/icons/icon-192.png, icon-512.png)
// deterministically from a description of the same board mark icon.svg
// draws, with no image library: RGBA pixels -> zlib -> PNG chunks. Same
// input, same bytes, every build.
import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../public/icons/", import.meta.url));

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    let c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const WOOD = [0xdc, 0xb9, 0x77];
const WOOD_EDGE = [0x6b, 0x4a, 0x22];
const LINE = [0x3a, 0x2c, 0x15];
const BLACK = [0x17, 0x14, 0x0f];
const WHITE = [0xf6, 0xf2, 0xea];

/** The icon at `size` pixels: a wood square with a 5x5 grid, one black and one white stone. */
export function renderIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const unit = size / 64;
  const grid = [14, 23, 32, 41, 50].map((v) => v * unit);
  const lineHalf = Math.max(1, 0.7 * unit);
  const stones = [{ cx: 23 * unit, cy: 23 * unit, color: BLACK }, { cx: 41 * unit, cy: 41 * unit, color: WHITE }];
  const radius = 6.4 * unit;
  const edge = 2 * unit;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let color = WOOD;
      if (px < edge || py < edge || px > size - edge || py > size - edge) color = WOOD_EDGE;
      const onLine = grid.some((g) => Math.abs(px - g) <= lineHalf) && py >= grid[0] && py <= grid[4];
      const onRow = grid.some((g) => Math.abs(py - g) <= lineHalf) && px >= grid[0] && px <= grid[4];
      if (onLine || onRow) color = LINE;
      for (const stone of stones) {
        if (Math.hypot(px - stone.cx, py - stone.cy) <= radius) color = stone.color;
      }
      const offset = (y * size + x) * 4;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

await mkdir(OUT, { recursive: true });
for (const size of [192, 512]) {
  await writeFile(`${OUT}icon-${size}.png`, renderIcon(size));
}
console.log(`Rendered icon-192.png and icon-512.png into ${OUT}`);
