// Reads the stage table (95 records of 200 bytes at 0x937B0, the same layout NXEngine's
// extractor uses) from both Doukutsu.exe builds and writes { filename: { en, jp } } so
// the page can show Japanese stage names. Run: node extract-jp-stage-names.mjs <jp exe> <en exe> <out.json>
import fs from 'node:fs';
const [jpExe, enExe, out] = process.argv.slice(2);
const OFFSET = 0x937b0, COUNT = 95, SIZE = 200;
function read(exe, enc) {
	const buf = fs.readFileSync(exe), td = new TextDecoder(enc), recs = [];
	for (let i = 0; i < COUNT; i++) {
		const rec = buf.subarray(OFFSET + i * SIZE, OFFSET + (i + 1) * SIZE);
		const str = (a, n) => { const s = rec.subarray(a, a + n), z = s.indexOf(0); return td.decode(s.subarray(0, z < 0 ? n : z)); };
		recs.push({ file: str(32, 32), caption: str(165, 35) });
	}
	return recs;
}
const jp = read(jpExe, 'shift_jis'), en = read(enExe, 'windows-1252');
const result = {};
jp.forEach((r, i) => { if (r.file && en[i].file === r.file) result[r.file] = { jp: r.caption, en: en[i].caption }; });
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log(Object.keys(result).length, 'stages');
for (const [k, v] of Object.entries(result).slice(0, 6)) console.log(k, v.en, '|', v.jp);
