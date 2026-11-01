import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
const indexHtmlPath = path.join(rootDir, 'index.html');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const version = pkg.version;

if (!version || typeof version !== 'string') {
  console.error('[sync-version] Invalid or missing "version" in package.json');
  process.exit(1);
}

const appTitle = `PDF Presenter v${version}`;

// 1. Sync src-tauri/tauri.conf.json (version + main window title)
if (fs.existsSync(tauriConfPath)) {
  const tauriConfRaw = fs.readFileSync(tauriConfPath, 'utf-8');
  const tauriConf = JSON.parse(tauriConfRaw);
  let changed = false;

  if (tauriConf.version !== version) {
    tauriConf.version = version;
    changed = true;
  }

  if (Array.isArray(tauriConf.app?.windows) && tauriConf.app.windows.length > 0) {
    if (tauriConf.app.windows[0].title !== appTitle) {
      tauriConf.app.windows[0].title = appTitle;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf-8');
    console.log(`[sync-version] Updated src-tauri/tauri.conf.json -> ${appTitle}`);
  }
}

// 2. Sync src-tauri/Cargo.toml [package] version
if (fs.existsSync(cargoTomlPath)) {
  const cargoToml = fs.readFileSync(cargoTomlPath, 'utf-8');
  const updatedCargoToml = cargoToml.replace(
    /(^\[package\][\s\S]*?^version\s*=\s*)"[^"]*"/m,
    `$1"${version}"`
  );
  if (updatedCargoToml !== cargoToml) {
    fs.writeFileSync(cargoTomlPath, updatedCargoToml, 'utf-8');
    console.log(`[sync-version] Updated src-tauri/Cargo.toml version -> ${version}`);
  }
}

// 3. Sync index.html <title>
if (fs.existsSync(indexHtmlPath)) {
  const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');
  const updatedHtml = indexHtml.replace(
    /<title>.*?<\/title>/,
    `<title>${appTitle}</title>`
  );
  if (updatedHtml !== indexHtml) {
    fs.writeFileSync(indexHtmlPath, updatedHtml, 'utf-8');
    console.log(`[sync-version] Updated index.html title -> ${appTitle}`);
  }
}

console.log(`[sync-version] Version synchronized: ${appTitle}`);
