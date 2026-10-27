import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import JSZip from 'jszip';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, 'dist');
const srcDir = join(__dirname, 'src');

console.log('🚀 Building openlearn-plugin-lti13...');

// 1. Clean dist
rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

// 2. Build backend server
await esbuild.build({
  entryPoints: [join(srcDir, 'index.ts')],
  outfile: join(distDir, 'index.js'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node18',
  sourcemap: 'inline',
  external: [
    '@openlearn/plugin-sdk',
    'better-sqlite3'
  ],
});
console.log('✅ Server entrypoint bundled to dist/index.js');

// 3. 前端入口已移除：原 src/frontend.tsx 是一个「导出 React 组件、没有 activate」的
//    管理面板，在当前插件契约下根本无法加载 —— 沙箱加载器要求 default export 是
//    { activate, deactivate }，且不透明源 iframe 里没有 React（详见下方 README 说明）。
//    保留这段「if existsSync」的兼容分支，方便后续若平台支持远程可见 UI 时再加回来。
const frontendEntry = join(srcDir, 'frontend.tsx');
let hasFrontend = false;
if (existsSync(frontendEntry)) {
  await esbuild.build({
    entryPoints: [frontendEntry],
    outfile: join(distDir, 'frontend.js'),
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    sourcemap: 'inline',
    external: ['react', 'react-dom', 'lucide-react'],
  });
  hasFrontend = true;
  console.warn(
    '⚠️  Frontend entry found. 注意：远程插件的前端必须 default export { activate, deactivate }，' +
      '且不能 import react —— 否则宿主加载器会报 missing activate function。',
  );
}

// 4. Copy manifest.json
const manifestPath = join(__dirname, 'manifest.json');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  writeFileSync(join(distDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  console.log('✅ Copied manifest.json to dist/');
}

// 5. Package as ZIP
const zip = new JSZip();
function addDirToZip(dir, zipFolder) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      addDirToZip(fullPath, zipFolder.folder(entry));
    } else {
      zipFolder.file(entry, readFileSync(fullPath));
    }
  }
}

addDirToZip(distDir, zip);
const zipBuffer = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
});

const zipFileName = 'openlearn-plugin-lti13.zip';
writeFileSync(join(__dirname, zipFileName), zipBuffer);
console.log(`📦 Successfully packaged distributable: ${zipFileName} (${(zipBuffer.length / 1024).toFixed(1)} KB)`);
