const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const outputDir = path.join(__dirname, "..", "public", "assets");
const width = 600;
const height = 800;

fs.mkdirSync(outputDir, { recursive: true });

const crcTable = new Uint32Array(256).map((_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function makeImage(draw) {
  const pixels = Buffer.alloc(width * height * 4);

  const api = {
    pixel(x, y, color, alpha = 1) {
      const px = Math.round(x);
      const py = Math.round(y);
      if (px < 0 || py < 0 || px >= width || py >= height) {
        return;
      }
      const index = (py * width + px) * 4;
      const sourceAlpha = Math.max(0, Math.min(1, alpha));
      const targetAlpha = 1 - sourceAlpha;
      pixels[index] = color[0] * sourceAlpha + pixels[index] * targetAlpha;
      pixels[index + 1] = color[1] * sourceAlpha + pixels[index + 1] * targetAlpha;
      pixels[index + 2] = color[2] * sourceAlpha + pixels[index + 2] * targetAlpha;
      pixels[index + 3] = 255;
    },
    rect(x, y, rectWidth, rectHeight, color, alpha = 1) {
      for (let py = y; py < y + rectHeight; py += 1) {
        for (let px = x; px < x + rectWidth; px += 1) {
          this.pixel(px, py, color, alpha);
        }
      }
    },
    circle(cx, cy, radius, color, alpha = 1) {
      const startX = Math.floor(cx - radius);
      const endX = Math.ceil(cx + radius);
      const startY = Math.floor(cy - radius);
      const endY = Math.ceil(cy + radius);
      for (let py = startY; py <= endY; py += 1) {
        for (let px = startX; px <= endX; px += 1) {
          const dx = px - cx;
          const dy = py - cy;
          if (dx * dx + dy * dy <= radius * radius) {
            this.pixel(px, py, color, alpha);
          }
        }
      }
    },
    line(x1, y1, x2, y2, color, thickness = 2, alpha = 1) {
      const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        this.circle(x, y, thickness, color, alpha);
      }
    },
    gradient(top, bottom) {
      for (let y = 0; y < height; y += 1) {
        const t = y / (height - 1);
        const color = [
          Math.round(top[0] + (bottom[0] - top[0]) * t),
          Math.round(top[1] + (bottom[1] - top[1]) * t),
          Math.round(top[2] + (bottom[2] - top[2]) * t)
        ];
        for (let x = 0; x < width; x += 1) {
          this.pixel(x, y, color);
        }
      }
    }
  };

  draw(api);

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function random(seed) {
  let value = seed;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = Math.imul(value ^ (value >>> 15), 1 | value);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const posters = [
  {
    file: "stellar-voyage.png",
    draw(api) {
      const rand = random(9);
      api.gradient([16, 24, 64], [8, 13, 33]);
      for (let i = 0; i < 150; i += 1) {
        api.circle(rand() * width, rand() * 520, rand() * 2 + 0.6, [255, 255, 255], rand() * 0.8);
      }
      api.circle(395, 315, 128, [31, 156, 172], 1);
      api.circle(350, 270, 36, [248, 250, 252], 0.32);
      api.circle(442, 354, 74, [17, 24, 39], 0.28);
      api.line(80, 615, 520, 450, [251, 146, 60], 5, 0.9);
      api.line(105, 647, 520, 500, [94, 234, 212], 3, 0.75);
      api.circle(120, 626, 32, [248, 250, 252], 0.95);
      api.rect(0, 650, 600, 150, [7, 10, 25], 0.72);
    }
  },
  {
    file: "metro-hearts.png",
    draw(api) {
      api.gradient([252, 211, 77], [190, 24, 93]);
      api.circle(470, 130, 86, [255, 247, 237], 0.56);
      for (let i = 0; i < 9; i += 1) {
        const x = 20 + i * 68;
        const h = 190 + (i % 3) * 54;
        api.rect(x, 430 - h, 48, h + 250, [49, 46, 129], 0.68);
        for (let y = 270; y < 520; y += 42) {
          api.rect(x + 12, y, 9, 18, [254, 243, 199], 0.7);
          api.rect(x + 29, y + 10, 8, 18, [254, 243, 199], 0.52);
        }
      }
      api.line(120, 780, 290, 475, [255, 255, 255], 8, 0.52);
      api.line(480, 780, 310, 475, [255, 255, 255], 8, 0.52);
      api.circle(270, 252, 46, [244, 63, 94], 0.9);
      api.circle(330, 252, 46, [244, 63, 94], 0.9);
      api.line(225, 280, 300, 382, [244, 63, 94], 24, 0.9);
      api.line(375, 280, 300, 382, [244, 63, 94], 24, 0.9);
    }
  },
  {
    file: "jungle-quest.png",
    draw(api) {
      const rand = random(27);
      api.gradient([20, 83, 45], [132, 204, 22]);
      api.circle(480, 145, 82, [254, 240, 138], 0.88);
      for (let i = 0; i < 42; i += 1) {
        const x = rand() * width;
        const y = rand() * 610;
        const r = rand() * 46 + 26;
        api.circle(x, y, r, [21, 128, 61], 0.42);
        api.circle(x + 20, y + 12, r * 0.66, [5, 150, 105], 0.36);
      }
      api.line(105, 800, 270, 455, [120, 53, 15], 34, 0.7);
      api.line(495, 800, 330, 455, [120, 53, 15], 34, 0.7);
      api.line(300, 455, 300, 800, [253, 186, 116], 24, 0.5);
      api.rect(0, 690, 600, 110, [21, 83, 45], 0.66);
      api.circle(155, 300, 30, [251, 191, 36], 0.88);
      api.line(160, 332, 160, 430, [87, 83, 78], 7, 0.95);
      api.line(160, 356, 208, 410, [87, 83, 78], 5, 0.95);
    }
  },
  {
    file: "case-47.png",
    draw(api) {
      const rand = random(47);
      api.gradient([30, 41, 59], [88, 28, 135]);
      api.rect(0, 0, width, height, [15, 23, 42], 0.28);
      for (let i = 0; i < 22; i += 1) {
        const y = 80 + i * 28;
        api.line(0, y, 600, y + rand() * 52 - 26, [148, 163, 184], 1, 0.12);
      }
      api.circle(310, 310, 124, [226, 232, 240], 0.12);
      api.circle(310, 310, 92, [15, 23, 42], 0.72);
      api.line(372, 386, 515, 550, [226, 232, 240], 16, 0.36);
      api.line(110, 590, 490, 590, [248, 113, 113], 3, 0.88);
      api.line(135, 632, 470, 632, [45, 212, 191], 3, 0.66);
      api.rect(0, 690, 600, 110, [2, 6, 23], 0.72);
    }
  }
];

for (const poster of posters) {
  const output = path.join(outputDir, poster.file);
  fs.writeFileSync(output, makeImage(poster.draw));
  console.log(`Generated ${output}`);
}
