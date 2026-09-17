import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
// Simulate the interval after deletion records arrive but before owned assets load.
const result = await build({
  stdin: { contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import Home from './app/page'; export const render = () => renderToStaticMarkup(React.createElement(Home));`, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'cjs', platform: 'node', jsx: 'automatic',
  loader: { '.css': 'empty' },
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'empty-owned-assets', setup(builder) {
    builder.onLoad({filter:/app[\\/]page\.tsx$/}, ({path}) => ({ loader:'tsx', contents: readFileSync(path,'utf8')
      .replace('useState(artworks)', 'useState([])')
      .replace('const visibleFrameOptions = [...visibleCabinetFrames, ...visibleScreenFrames];', 'const visibleFrameOptions = [];') }));
  }}],
});
const module = {exports:{}};
new Function('require','module','exports',result.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
const markup = module.exports.render();
assert.ok(markup.includes('请选择图案'));
assert.ok(markup.includes('请选择框架'));
assert.ok(!markup.includes('src="undefined"'));
assert.ok(markup.includes('所选图案、框架与场景参考'));
console.log('PASS: empty or not-yet-loaded owned artwork and frame catalogs render without resurrecting defaults or crashing.');
