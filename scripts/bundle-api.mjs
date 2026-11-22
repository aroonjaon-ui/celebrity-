import { build } from 'esbuild';

await build({
  entryPoints: ['scripts/api-handler.ts'],
  outfile: 'api/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node20'],
  packages: 'external',
  logLevel: 'info',
});
