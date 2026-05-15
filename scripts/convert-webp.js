const sharp = require('sharp');
const path = require('path');

const files = [
  'med.png',
  'cal.png',
  'hos.png',
  'alarm.png',
];

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

(async () => {
  for (const file of files) {
    const src = path.join(iconsDir, file);
    const dst = path.join(iconsDir, file.replace('.png', '.webp'));
    const info = await sharp(src).webp({ quality: 85, effort: 6 }).toFile(dst);
    const original = require('fs').statSync(src).size;
    const saved = original - info.size;
    console.log(
      `${file.padEnd(12)} ${original.toString().padStart(8)} → ${info.size.toString().padStart(8)} bytes  (−${saved} bytes, −${((saved / original) * 100).toFixed(1)}%)`
    );
  }
})();
