// One-off generator for src/favicon.ico — draws a simple anti-aliased
// blue circle (matching the chat UI's #2196f3 accent) as a 32x32 32-bit
// ICO file. No external image libraries required.
const fs = require('fs');
const path = require('path');

const SIZE = 32;
const CENTER = SIZE / 2;
const RADIUS = 14;
const COLOR = { r: 0x21, g: 0x96, b: 0xf3 }; // #2196f3

function pixelAlpha(x, y) {
  // Sample center of pixel, distance from circle center.
  const dx = x + 0.5 - CENTER;
  const dy = y + 0.5 - CENTER;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= RADIUS - 1) return 255;
  if (dist >= RADIUS + 1) return 0;
  // Linear falloff across the 2px anti-aliasing band.
  return Math.round(255 * (1 - (dist - (RADIUS - 1)) / 2));
}

// BMP/ICO DIB rows are stored bottom-up.
const rowSize = SIZE * 4; // 32bpp, no padding needed (SIZE*4 is already a multiple of 4)
const pixelDataSize = rowSize * SIZE;
const pixelData = Buffer.alloc(pixelDataSize);

for (let row = 0; row < SIZE; row++) {
  const y = SIZE - 1 - row; // bottom-up
  for (let x = 0; x < SIZE; x++) {
    const alpha = pixelAlpha(x, y);
    const offset = row * rowSize + x * 4;
    // BGRA byte order
    pixelData[offset + 0] = COLOR.b;
    pixelData[offset + 1] = COLOR.g;
    pixelData[offset + 2] = COLOR.r;
    pixelData[offset + 3] = alpha;
  }
}

// AND mask: 1 bpp, each row padded to a 4-byte boundary. All zero since
// the 32bpp image already carries a real alpha channel.
const andMaskRowBytes = Math.ceil(SIZE / 8 / 4) * 4;
const andMask = Buffer.alloc(andMaskRowBytes * SIZE, 0);

// BITMAPINFOHEADER (40 bytes). Height is doubled per the ICO spec (XOR + AND).
const dibHeader = Buffer.alloc(40);
dibHeader.writeUInt32LE(40, 0); // header size
dibHeader.writeInt32LE(SIZE, 4); // width
dibHeader.writeInt32LE(SIZE * 2, 8); // height (XOR + AND)
dibHeader.writeUInt16LE(1, 12); // planes
dibHeader.writeUInt16LE(32, 14); // bit count
dibHeader.writeUInt32LE(0, 16); // compression: BI_RGB
dibHeader.writeUInt32LE(pixelDataSize + andMask.length, 20); // image size
dibHeader.writeInt32LE(0, 24); // x pixels per meter
dibHeader.writeInt32LE(0, 28); // y pixels per meter
dibHeader.writeUInt32LE(0, 32); // colors used
dibHeader.writeUInt32LE(0, 36); // important colors

const imageData = Buffer.concat([dibHeader, pixelData, andMask]);

// ICONDIR (6 bytes)
const iconDir = Buffer.alloc(6);
iconDir.writeUInt16LE(0, 0); // reserved
iconDir.writeUInt16LE(1, 2); // type: icon
iconDir.writeUInt16LE(1, 4); // count

// ICONDIRENTRY (16 bytes)
const entry = Buffer.alloc(16);
entry.writeUInt8(SIZE, 0); // width
entry.writeUInt8(SIZE, 1); // height
entry.writeUInt8(0, 2); // color count
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bit count
entry.writeUInt32LE(imageData.length, 8); // bytes in resource
entry.writeUInt32LE(iconDir.length + entry.length, 12); // offset

const ico = Buffer.concat([iconDir, entry, imageData]);

const outPath = path.join(__dirname, '..', 'src', 'favicon.ico');
fs.writeFileSync(outPath, ico);
console.log(`Wrote ${ico.length} bytes to ${outPath}`);
