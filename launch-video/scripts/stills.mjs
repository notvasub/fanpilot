// Renders review stills into out/stills: node scripts/stills.mjs <compId> <frame,frame,...> [scale]
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';

const [comp = 'Main', framesArg = '0', scaleArg = '0.5'] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id: comp });
for (const fr of framesArg.split(',').map(Number)) {
  const output = path.resolve(`out/stills/${comp}-${String(fr).padStart(4, '0')}.jpg`);
  await renderStill({ serveUrl, composition, frame: fr, output, imageFormat: 'jpeg', scale: Number(scaleArg) });
  console.log(output);
}
