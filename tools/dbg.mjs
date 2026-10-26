import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const kuromoji = require('kuromoji');
const t = await new Promise((res) => kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((e, t) => res(t)));
for (const s of ['君の言う通り', '傍にいる', '甘い蜜', '家に帰す']) console.log(s, t.tokenize(s).map((k) => `${k.surface_form}/${k.reading}/${k.basic_form}/${k.pos}`).join(' | '));
