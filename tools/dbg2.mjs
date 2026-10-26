import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const kuromoji = require('kuromoji');
const t = await new Promise((res) => kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((e, t) => res(t)));
for (const s of ['なんとか逃げ出せたが、', '逃げ出せる', '逃げ出す', '食べられる', '行ける', '読める']) console.log(s, t.tokenize(s).map((k) => `${k.surface_form}/${k.reading}/${k.basic_form}/${k.pos}/${k.pos_detail_1}/${k.conjugated_type}/${k.conjugated_form}`).join(' | '));
