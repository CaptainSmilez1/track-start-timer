// One-off icon generator: draws a filled rounded square (accent color)
// with a white circle in the middle, matching the app's START button.
// No dependencies — builds a PNG by hand using Node's built-in zlib.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makeIcon(size, { maskable = false } = {}) {
  const bg = [200, 69, 31]; // --accent (track theme)
  const fg = [255, 255, 255];
  const cx = size / 2, cy = size / 2;
  // Maskable icons need padding so the OS can safely crop to a circle/squircle.
  const circleR = size * (maskable ? 0.30 : 0.34);
  const cornerR = maskable ? 0 : size * 0.18;

  const raw = Buffer.alloc((size * 4 + 1) * size);
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter type: none
    for (let x = 0; x < size; x++) {
      const inCircle = (x - cx) ** 2 + (y - cy) ** 2 <= circleR * circleR;
      let inRound = true;
      if (!maskable) {
        // rounded-rect mask via distance-to-nearest-corner-center test
        const rx = Math.min(x, size - 1 - x);
        const ry = Math.min(y, size - 1 - y);
        if (rx < cornerR && ry < cornerR) {
          const dx = cornerR - rx, dy = cornerR - ry;
          inRound = dx * dx + dy * dy <= cornerR * cornerR;
        }
      }
      const color = inCircle ? fg : bg;
      if (inRound) {
        raw[p++] = color[0]; raw[p++] = color[1]; raw[p++] = color[2]; raw[p++] = 255;
      } else {
        raw[p++] = 0; raw[p++] = 0; raw[p++] = 0; raw[p++] = 0;
      }
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const idat = zlib.deflateSync(raw);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return png;
}

const outDir = path.join(__dirname, "..", "icons");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "icon-192.png"), makeIcon(192));
fs.writeFileSync(path.join(outDir, "icon-512.png"), makeIcon(512));
fs.writeFileSync(path.join(outDir, "icon-maskable-512.png"), makeIcon(512, { maskable: true }));
fs.writeFileSync(path.join(outDir, "apple-touch-icon.png"), makeIcon(180));
console.log("icons written to", outDir);
