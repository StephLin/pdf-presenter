import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const pkgPath = path.join(rootDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
const productName = pkg.name || 'pdf-presenter';
const version = pkg.version || '1.0.0';

const platform = process.platform;
const archMap = {
  x64: 'x64',
  arm64: 'arm64',
  ia32: 'x86',
};

// Resolve target release directory: check target-triple folder if --target was explicitly used,
// otherwise use default src-tauri/target/release
const targetTriple = process.env.CARGO_BUILD_TARGET || process.env.TAURI_ENV_TARGET_TRIPLE || '';
const arch = targetTriple.startsWith('x86_64')
  ? 'x64'
  : targetTriple.startsWith('aarch64')
    ? 'arm64'
    : targetTriple.startsWith('i686')
      ? 'x86'
      : archMap[process.arch] || process.arch;

const isWindows = platform === 'win32';
const binaryExt = isWindows ? '.exe' : '';
const binaryName = `${productName}${binaryExt}`;

const candidateDirs = [
  ...(targetTriple ? [path.join(rootDir, 'src-tauri', 'target', targetTriple, 'release')] : []),
  path.join(rootDir, 'src-tauri', 'target', 'release'),
];

const releaseDir = candidateDirs.find((dir) => fs.existsSync(path.join(dir, binaryName)));

if (!releaseDir) {
  console.error(
    `[package-portable] Release binary "${binaryName}" not found in: ${candidateDirs.join(', ')}`
  );
  process.exit(1);
}

const sourceBinaryPath = path.join(releaseDir, binaryName);
const portableBundleDir = path.join(releaseDir, 'bundle', 'portable');
fs.mkdirSync(portableBundleDir, { recursive: true });

const platformTag = isWindows ? '' : `_${platform}`;
const portableBaseName = `${productName}_${version}_${arch}${platformTag}-portable`;
const portableBinaryName = `${portableBaseName}${binaryExt}`;
const portableBinaryPath = path.join(portableBundleDir, portableBinaryName);
const portableZipPath = path.join(portableBundleDir, `${portableBaseName}.zip`);

// 1. Copy standalone portable executable
fs.copyFileSync(sourceBinaryPath, portableBinaryPath);
console.log(`[package-portable] Created portable executable: ${portableBinaryPath}`);

// 2. Create portable .zip archive containing the executable
try {
  if (fs.existsSync(portableZipPath)) {
    fs.unlinkSync(portableZipPath);
  }
  if (platform === 'linux') {
    execFileSync('zip', ['-j', portableZipPath, sourceBinaryPath], {
      stdio: 'inherit',
    });
  } else {
    // Use system bsdtar (built into Windows 10/11 and macOS) to create .zip archive
    execFileSync('tar', ['-a', '-c', '-f', portableZipPath, '-C', releaseDir, binaryName], {
      stdio: 'inherit',
    });
  }
  console.log(`[package-portable] Created portable ZIP archive: ${portableZipPath}`);
} catch {
  if (isWindows) {
    try {
      execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-ExecutionPolicy',
          'Bypass',
          '-Command',
          `Compress-Archive -Path "${sourceBinaryPath}" -DestinationPath "${portableZipPath}" -Force`,
        ],
        { stdio: 'inherit' }
      );
      console.log(`[package-portable] Created portable ZIP archive via Compress-Archive: ${portableZipPath}`);
    } catch (zipErr) {
      console.warn('[package-portable] Warning: Could not create portable ZIP archive:', zipErr);
    }
  } else {
    try {
      execFileSync('zip', ['-j', portableZipPath, sourceBinaryPath], {
        stdio: 'inherit',
      });
      console.log(`[package-portable] Created portable ZIP archive via zip: ${portableZipPath}`);
    } catch (zipErr) {
      console.warn('[package-portable] Warning: Could not create portable ZIP archive:', zipErr);
    }
  }
}
