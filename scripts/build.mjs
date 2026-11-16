import { build } from 'esbuild';
import { readdirSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const scenariosDir = join(process.cwd(), 'src', 'scenarios');
const outDir = join(process.cwd(), 'dist');

mkdirSync(outDir, { recursive: true });

const entryPoints = readdirSync(scenariosDir)
  .filter((file) => file.endsWith('.ts'))
  .map((file) => join(scenariosDir, file));

if (entryPoints.length === 0) {
  console.error('No scenario entrypoints found in src/scenarios/');
  process.exit(1);
}

await build({
  entryPoints,
  outdir: outDir,
  bundle: true,
  platform: 'neutral',
  mainFields: ['module', 'main'],
  format: 'esm',
  target: 'es2020',
  sourcemap: true,
  external: ['k6', 'k6/*'],
  logLevel: 'info',
});

console.log(
  `Built ${entryPoints.length} scenario(s): ${entryPoints.map((p) => basename(p, '.ts')).join(', ')}`
);
