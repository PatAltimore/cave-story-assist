// Builds web/script-data.json: for every TSC script event in Cave Story, the English
// text ops (as the engine shows them) alongside the original Japanese ops, tokenized
// with kuromoji and glossed from JMdict. Run: node build-script-data.mjs <jp-data-dir> <en-data-dir>
//
//   JMdict: tools/cache/jm/jmdict-eng-*.json (jmdict-simplified, CC BY-SA 4.0, EDRDG)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const kuromoji = require('kuromoji');

const [jpDir, enDir, outFile = path.join(here, '../web/script-data.json')] = process.argv.slice(2);
if (!jpDir || !enDir) {
	console.error('usage: node build-script-data.mjs <jp data dir> <en data dir> [out.json]');
	process.exit(1);
}

// ---------------------------------------------------------------- TSC parsing

function decryptTsc(buf) {
	const key = buf[buf.length >> 1];
	const out = Buffer.from(buf);
	for (let i = 0; i < out.length; i++) if (i !== buf.length >> 1) out[i] = (buf[i] - key) & 0xff;
	return out;
}

// -> { eventNo: [ text ops ] }   (text ops keep '\n' line breaks, drop '\r')
function parseTsc(file, encoding) {
	const text = new TextDecoder(encoding).decode(decryptTsc(fs.readFileSync(file)));
	const events = {};
	const parts = text.split(/^#(\d{4})/m);
	for (let i = 1; i < parts.length; i += 2) {
		const ops = [];
		let body = parts[i + 1].replace(/^\r?\n/, '');
		let cur = '';
		const flush = () => {
			const t = cur.replace(/\r/g, '');
			if (t.replace(/\s/g, '')) ops.push(t.replace(/^\n+|\n+$/g, ''));
			cur = '';
		};
		for (let p = 0; p < body.length; ) {
			if (body[p] === '<' && /^<[A-Z+\-]{3}/.test(body.slice(p, p + 4))) {
				flush();
				p += 4;
				while (/^\d{4}(:\d{4})*/.test(body.slice(p, p + 30))) {
					p += body.slice(p).match(/^\d{4}(:\d{4})*/)[0].length;
				}
			} else cur += body[p++];
		}
		flush();
		if (ops.length) events[parts[i]] = ops;
	}
	return events;
}

// ---------------------------------------------------------------- dictionary

const jlpt = JSON.parse(fs.readFileSync(path.join(here, "cache/jlpt.json"), "utf8"));
const jmFile = fs.readdirSync(path.join(here, 'cache/jm')).find((f) => f.endsWith('.json'));
console.log('loading JMdict', jmFile);
const jm = JSON.parse(fs.readFileSync(path.join(here, 'cache/jm', jmFile), 'utf8'));
const jmIndex = new Map(); // form -> [entries]
for (const e of jm.words) {
	for (const list of [e.kanji, e.kana]) {
		for (const f of list) {
			if (!jmIndex.has(f.text)) jmIndex.set(f.text, []);
			jmIndex.get(f.text).push({ e, common: !!f.common });
		}
	}
}

const POS = {
	n: 'noun', 'adj-i': 'i-adj', 'adj-na': 'na-adj', 'adj-no': 'no-adj', adv: 'adverb', prt: 'particle', conj: 'conj',
	int: 'interj', pn: 'pronoun', exp: 'expr', aux: 'aux', 'aux-v': 'aux-v', 'aux-adj': 'aux-adj', ctr: 'counter',
	v1: 'verb (ru)', v5u: 'verb (u)', v5k: 'verb (ku)', v5g: 'verb (gu)', v5s: 'verb (su)', v5t: 'verb (tsu)',
	v5n: 'verb (nu)', v5b: 'verb (bu)', v5m: 'verb (mu)', v5r: 'verb (ru)', vs: 'suru verb', 'vs-i': 'suru verb', vk: 'kuru',
	'v5r-i': 'verb (ru)', 'v5k-s': 'verb (iku)', 'v5u-s': 'verb (u)', 'adv-to': 'adverb', pref: 'prefix', suf: 'suffix', num: 'number',
	'adj-pn': 'pre-noun adj', 'adj-f': 'noun-modifier', 'adj-ix': 'i-adj',
};
// kuromoji POS (Japanese) -> JMdict tags that count as a match
const KPOS = {
	'動詞': (t) => /^v/.test(t) && t !== 'vs-c', '名詞': (t) => /^(n|pn|vs|adj-no|adj-na|ctr|num|suf)/.test(t),
	'助詞': (t) => t === 'prt', '助動詞': (t) => /^aux/.test(t) || t === 'prt' || t === 'cop', '副詞': (t) => /^adv/.test(t),
	'形容詞': (t) => /^adj-i/.test(t), '接続詞': (t) => t === 'conj', '感動詞': (t) => t === 'int' || t === 'exp',
	'連体詞': (t) => t === 'adj-pn' || t === 'adj-f', '接頭詞': (t) => t === 'pref', '形容動詞': (t) => /^adj-na/.test(t),
};
function glossOf(e, n = 3) {
	return e.sense.slice(0, n).map((s) => s.gloss.slice(0, 2).map((g) => g.text).join(', ')).join('; ');
}
// readingHira: how the original text reads this word (from the tokenizer). Entries whose kana
// agree with it win, which sorts out homographs (今日 きょう / こんにち, 人気 にんき / ひとけ ...).
// Inflected words only compare the stem, since the tokenizer's reading is of the inflected form.
function lookup(forms, kpos, readingHira = '', surface = '') {
	const match = KPOS[kpos];
	const readsAs = (e) => {
		if (!readingHira) return true;
		// inflected: drop the okurigana tail (食べた -> たべ) and compare the stem
		const tail = surface && forms[0] !== surface ? (surface.match(/[぀-ヿー]*$/) || [''])[0].length : 0;
		const stem = tail && tail < readingHira.length ? readingHira.slice(0, readingHira.length - tail) : readingHira;
		return e.kana.some((k) => (tail ? k.text.startsWith(stem) : k.text === readingHira));
	};
	for (const f of forms) {
		if (!f || f === '*') continue;
		const cands = jmIndex.get(f);
		if (!cands) continue;
		const score = (c) => {
			const tags = c.e.sense.flatMap((s) => s.partOfSpeech);
			const m = match && tags.some(match) ? 0 : 1;
			const first = match && c.e.sense[0].partOfSpeech.some(match) ? 0 : 1;
			const rd = hasKanji(f) && !readsAs(c.e) ? 1 : 0;
			return rd * 8e6 + m * 4e6 + first * 2e6 + (c.common ? 0 : 1e6) + (c.e.id % 1e6) / 1e6;
		};
		const ranked = [...new Map(cands.map((c) => [c.e.id, c])).values()].sort((a, b) => score(a) - score(b));
		const hit = ranked[0];
		// a bare kana word with no entry of the right part of speech is more likely a
		// stray match (kanji homophone) than a real hit; better no gloss than a wrong one
		if (match && !/[一-鿿]/.test(f) && !hit.e.sense.some((s) => s.partOfSpeech.some(match))) continue;
		const pos = (e) => [...new Set(e.sense[0].partOfSpeech.map((p) => POS[p]).filter(Boolean))].join(', ');
		// other entries for the same spelling, so a wrong first pick can still be corrected by eye
		const alts = ranked.slice(1, 3)
			.filter((c) => !hasKanji(f) ? true : readsAs(c.e) || !readingHira)
			.map((c) => ({ g: glossOf(c.e, 2), p: pos(c.e), r: c.e.kana[0].text, ...(c.common ? { c: 1 } : {}) }));
		return { g: glossOf(hit.e), p: pos(hit.e), kana: hit.e.kana[0].text, common: hit.common, alts };
	}
	return null;
}

// ---------------------------------------------------------------- tokenizing

const kata2hira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const isKana = (c) => /[぀-ゟ゠-ヿー]/.test(c);
const hasKanji = (s) => /[一-鿿々]/.test(s);

// furigana for one token: strip matching kana at the start/end so only the kanji get ruby
function ruby(surface, readingHira) {
	if (!hasKanji(surface)) return null;
	let a = 0, b = surface.length, ra = 0, rb = readingHira.length;
	while (a < b && isKana(surface[a]) && kata2hira(surface[a]) === readingHira[ra]) { a++; ra++; }
	while (b > a && isKana(surface[b - 1]) && kata2hira(surface[b - 1]) === readingHira[rb - 1]) { b--; rb--; }
	return { pre: surface.slice(0, a), base: surface.slice(a, b), rt: readingHira.slice(ra, rb), post: surface.slice(b) };
}

const tokenizer = await new Promise((res, rej) =>
	kuromoji.builder({ dicPath: path.join(here, 'node_modules/kuromoji/dict') }).build((e, t) => (e ? rej(e) : res(t))));

const words = [];
const wordIds = new Map();
function wordId(tok) {
	const reading = tok.reading && tok.reading !== '*' ? kata2hira(tok.reading) : '';
	const base = tok.basic_form && tok.basic_form !== '*' ? tok.basic_form : tok.surface_form;
	const key = base + '|' + tok.pos + '|' + reading;
	if (wordIds.has(key)) return wordIds.get(key);
	const info = tok.pos === '記号' ? null : lookup([base, tok.surface_form], tok.pos, reading, tok.surface_form);
	const w = { b: base };
	if (info) {
		w.g = info.g; if (info.p) w.p = info.p; if (info.kana !== base) w.r = info.kana;
		if (info.common) w.c = 1;
		if (info.alts.length) w.a = info.alts;
	}
	// JLPT level (Tanos lists, via Bluskyo/JLPT_Vocabulary): prefer the entry whose reading matches
	const jl = jlpt[base] || (info && jlpt[info.kana]);
	if (jl) w.l = (jl.find((x) => info && x.reading === info.kana) || jl[0]).level;
	words.push(w);
	wordIds.set(key, words.length - 1);
	return words.length - 1;
}

// Longest-match pass (what hover dictionaries such as Yomitan and Meikipop do): the tokenizer splits
// compounds like 動き出す or 迷宮入り into pieces, so try to join runs of up to five tokens when the
// joined text, or its dictionary form, is a JMdict headword that contains kanji.
const CONTENT = new Set(['名詞', '動詞', '形容詞', '副詞', '連体詞', '接頭詞']);
function mergeCompounds(toks) {
	const out = [];
	for (let i = 0; i < toks.length; ) {
		let merged = null;
		for (let n = Math.min(5, toks.length - i); n >= 2 && !merged; n--) {
			const run = toks.slice(i, i + n);
			if (run.some((t) => t.pos === '記号' || /^[\s　]+$/.test(t.surface_form))) continue;
			if (!run.some((t) => CONTENT.has(t.pos))) continue;
			const surface = run.map((t) => t.surface_form).join('');
			if (!hasKanji(surface)) continue;
			const last = run[n - 1];
			const lastBase = last.basic_form && last.basic_form !== '*' ? last.basic_form : last.surface_form;
			const base = run.slice(0, -1).map((t) => t.surface_form).join('') + lastBase;
			if (!(jmIndex.has(surface) || jmIndex.has(base))) continue;
			if (run.some((t) => !t.reading || t.reading === '*')) continue;
			merged = {
				surface_form: surface,
				basic_form: jmIndex.has(base) ? base : surface,
				reading: run.map((t) => t.reading).join(''),
				pos: run[0].pos,
				len: n,
			};
		}
		out.push(merged || toks[i]);
		i += merged ? merged.len : 1;
	}
	return out;
}

// tokens: [surface, rubyReading|"", wordId]; "\n" is a bare string
function tokenize(text) {
	const out = [];
	text.split('\n').forEach((line, li) => {
		if (li) out.push('\n');
		for (const tok of mergeCompounds(tokenizer.tokenize(line))) {
			const reading = tok.reading && tok.reading !== '*' ? kata2hira(tok.reading) : '';
			const rb = reading ? ruby(tok.surface_form, reading) : null;
			const id = /^[\s　]+$/.test(tok.surface_form) || tok.pos === '記号' ? -1 : wordId(tok);
			if (rb) {
				if (rb.pre) out.push([rb.pre, '', id]);
				out.push([rb.base, rb.rt, id]);
				if (rb.post) out.push([rb.post, '', id]);
			} else out.push([tok.surface_form, '', id]);
		}
	});
	return out;
}

// ---------------------------------------------------------------- build

const norm = (s) => s.replace(/\s/g, '');
const files = fs.readdirSync(path.join(jpDir, 'Stage')).filter((f) => f.endsWith('.tsc')).map((f) => 'Stage/' + f);
for (const f of ['Head.tsc', 'ArmsItem.tsc', 'StageSelect.tsc']) files.push(f);

const result = {};
let nEvents = 0, aligned = 0, ops = 0;
for (const rel of files) {
	const jpPath = path.join(jpDir, rel), enPath = path.join(enDir, rel);
	if (!fs.existsSync(jpPath) || !fs.existsSync(enPath)) continue;
	const jp = parseTsc(jpPath, 'shift_jis');
	const en = parseTsc(enPath, 'windows-1252');
	const key = path.basename(rel, '.tsc');
	const events = {};
	for (const no of Object.keys(en)) {
		const enOps = en[no], jpOps = jp[no] || [];
		nEvents++;
		const same = enOps.length === jpOps.length;
		if (same) aligned++;
		ops += enOps.length;
		events[no] = { e: enOps.map(norm), t: enOps, ...(same ? {} : { x: 1 }), j: jpOps.map(tokenize) };
	}
	result[key] = events;
}

// the engine reports text exactly as the English script, so keep: e = normalized key, t = display text
fs.mkdirSync(path.dirname(outFile), { recursive: true });
const stagesFile = path.join(jpDir, "stage-names.json");
const stages = fs.existsSync(stagesFile) ? JSON.parse(fs.readFileSync(stagesFile, "utf8")) : {};
// tokenize the stage names too (the banner shown on entering a map goes into the page's history)
for (const st of Object.values(stages)) if (st.jp) st.t = tokenize(st.jp);
fs.writeFileSync(outFile, JSON.stringify({ words, scripts: result, stages }));
console.log(`events ${nEvents}, aligned ${aligned} (${((100 * aligned) / nEvents).toFixed(1)}%), ops ${ops}, words ${words.length}`);
console.log(`wrote ${outFile} (${(fs.statSync(outFile).size / 1e6).toFixed(2)} MB)`);
