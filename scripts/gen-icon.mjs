// Generates a 512x512 RGBA PNG (indigo→slate gradient + white dot) with no
// dependencies, then `tauri icon` expands it into the full src-tauri/icons set.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function writePng(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

const SIZE = 512;
const px = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    const t = (x + y) / (2 * SIZE);
    px[i] = Math.round(79 + (15 - 79) * t); // indigo → slate
    px[i + 1] = Math.round(70 + (23 - 70) * t);
    px[i + 2] = Math.round(229 + (42 - 229) * t);
    px[i + 3] = 255;
    const dx = x - SIZE / 2;
    const dy = y - SIZE / 2;
    if (Math.sqrt(dx * dx + dy * dy) < SIZE * 0.28) {
      px[i] = 255;
      px[i + 1] = 255;
      px[i + 2] = 255;
    }
  }
}

mkdirSync("src-tauri", { recursive: true });
writeFileSync("src-tauri/app-icon.png", writePng(SIZE, px));
console.log("wrote src-tauri/app-icon.png");
