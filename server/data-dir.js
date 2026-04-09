const path = require('path');
const fs = require('fs');

// Single source of truth for where JSON data files live.
// Defaults to server/data, but can be overridden via FRONTLINE_DATA_DIR so
// tests can point at a temp dir without polluting real data.
const DATA_DIR = process.env.FRONTLINE_DATA_DIR || path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function dataFile(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readJSON(name, fallback) {
  try {
    const f = dataFile(name);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (_) { /* ignore */ }
  return fallback;
}

function writeJSON(name, data) {
  fs.writeFileSync(dataFile(name), JSON.stringify(data, null, 2));
}

module.exports = { DATA_DIR, dataFile, readJSON, writeJSON };
