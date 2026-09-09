// Windows fallback for this host's native fs.cpSync exit during Sites packaging.
// Preload only for the official Sites packager, preserving its path/tree checks.
const fs = require('node:fs');
const path = require('node:path');
fs.cpSync = function copyRegularTree(source, target) {
  const stat = fs.lstatSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });
    for (const entry of fs.readdirSync(source)) copyRegularTree(path.join(source, entry), path.join(target, entry));
  } else if (stat.isFile()) fs.copyFileSync(source, target);
  else throw new Error('Only regular build files may be copied.');
};
