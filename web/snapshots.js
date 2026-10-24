// Rewind buffer and save states for the WebAssembly game.
//
// The engine calls Module.assistFrame() once per game tick (see engine/assist.cpp). At that moment the
// engine is running normally, nothing is suspended, so all game state is in linear memory and we can
// copy it out or copy an older image back in.
//
// Rewind: one snapshot per second for a minute. Each snapshot stores only the 4KB pages that changed
// since the previous one (the sprite sheets, tilesets and so on never change), so a minute costs
// tens of MB, not gigabytes. The screen surface is skipped: it is redrawn every tick anyway.
// Save states: a full image, gzip-compressed, in IndexedDB.
'use strict';

const PAGE = 4096;
const WORDS = PAGE / 4;

function createSnapshots(Module, { intervalMs = 1000, capacity = 61, onRestore }) {
	let base = null;      // full image of entries[0]
	let last = null;      // full image of the newest entry (to diff against)
	let lastAt = 0;
	let pending = null;   // restore to run at the next tick
	const entries = [];   // { t, thumb, ui, pages: Uint32Array, data: Uint8Array } (pages/data null for entries[0])

	const mem = () => Module.HEAPU8;

	function screenPages() {
		const p = Module._assist_screen_pixels(), n = Module._assist_screen_bytes();
		// only pages entirely inside the surface are skipped, so unrelated data sharing an edge page is kept
		return [Math.ceil(p / PAGE), Math.floor((p + n) / PAGE)];
	}

	function thumbnail() {
		const p = Module._assist_screen_pixels(), w = Module._assist_screen_width(), h = Module._assist_screen_height();
		if (!p || !w) return '';
		const src = new Uint8Array(mem().buffer, p, w * h * 4);
		const tw = 160, th = 120, img = new ImageData(tw, th);
		for (let y = 0; y < th; y++) {
			for (let x = 0; x < tw; x++) {
				const s = ((y * h / th | 0) * w + (x * w / tw | 0)) * 4, d = (y * tw + x) * 4;
				img.data[d] = src[s + 2]; img.data[d + 1] = src[s + 1]; img.data[d + 2] = src[s]; img.data[d + 3] = 255; // BGRA -> RGBA
			}
		}
		const c = document.createElement('canvas');
		c.width = tw; c.height = th;
		c.getContext('2d').putImageData(img, 0, 0);
		return c.toDataURL('image/jpeg', 0.6);
	}

	const topPages = () => Math.ceil(Module._assist_heap_top() / PAGE);

	// pages that differ between memory now and `prev` (a full image)
	function diff(prev, nPages) {
		const [skipLo, skipHi] = screenPages();
		const cur = new Uint32Array(mem().buffer, 0, nPages * WORDS);
		const old = new Uint32Array(prev.buffer, 0, Math.min(prev.length, nPages * PAGE) / 4);
		const changed = [];
		for (let p = 0; p < nPages; p++) {
			if (p >= skipLo && p < skipHi) continue;
			const o = p * WORDS;
			if (o + WORDS > old.length) { changed.push(p); continue; }
			for (let i = 0; i < WORDS; i++) {
				if (cur[o + i] !== old[o + i]) { changed.push(p); break; }
			}
		}
		return changed;
	}

	function takeSnapshot(ui) {
		const nPages = topPages();
		const m = mem();
		if (!last) {
			base = m.slice(0, nPages * PAGE);
			last = m.slice(0, nPages * PAGE);
			entries.push({ t: performance.now(), thumb: thumbnail(), ui, pages: null, data: null });
			return;
		}
		const changed = diff(last, nPages);
		const pages = Uint32Array.from(changed);
		const data = new Uint8Array(changed.length * PAGE);
		if (last.length < nPages * PAGE) { const g = new Uint8Array(nPages * PAGE); g.set(last); last = g; }
		changed.forEach((p, i) => {
			data.set(m.subarray(p * PAGE, (p + 1) * PAGE), i * PAGE);
			last.set(m.subarray(p * PAGE, (p + 1) * PAGE), p * PAGE);
		});
		entries.push({ t: performance.now(), thumb: thumbnail(), ui, pages, data });
		while (entries.length > capacity) {
			entries.shift();
			// fold the new oldest entry's delta into the base so it becomes a full image
			const e = entries[0];
			if (base.length < last.length) { const g = new Uint8Array(last.length); g.set(base); base = g; }
			e.pages.forEach((p, i) => base.set(e.data.subarray(i * PAGE, (i + 1) * PAGE), p * PAGE));
			e.pages = null; e.data = null;
		}
	}

	function applyImage(img) {
		const [skipLo, skipHi] = screenPages();
		const m = mem();
		const n = Math.min(img.length, m.length) / PAGE;
		for (let p = 0; p < n; p++) {
			if (p >= skipLo && p < skipHi) continue;
			m.set(img.subarray(p * PAGE, (p + 1) * PAGE), p * PAGE);
		}
	}

	function restoreIndex(index) {
		// base, then every delta up to `index`
		const img = base.slice();
		let out = img;
		for (let i = 1; i <= index; i++) {
			const e = entries[i];
			const need = (e.pages.length ? e.pages[e.pages.length - 1] + 1 : 0) * PAGE;  // pages are ascending
			if (need > out.length) { const g = new Uint8Array(need); g.set(out); out = g; }
			e.pages.forEach((p, k) => out.set(e.data.subarray(k * PAGE, (k + 1) * PAGE), p * PAGE));
		}
		applyImage(out);
		last = out;
		entries.length = index + 1;
		lastAt = performance.now();
		return entries[index].ui;
	}

	// called by the engine every tick
	function tick(getUi) {
		if (pending) {
			const job = pending; pending = null;
			job();
			return;
		}
		const now = performance.now();
		if (now - lastAt >= intervalMs) {
			lastAt = now;
			takeSnapshot(getUi());
			onRestore && onRestore.changed && onRestore.changed();
		}
	}

	return {
		tick,
		get length() { return entries.length; },
		// memory held by the rewind buffer, in bytes (for debugging)
		stats() { return { entries: entries.length, base: base ? base.length : 0, last: last ? last.length : 0, deltas: entries.reduce((a, e) => a + (e.data ? e.data.length : 0), 0) }; },
		ageSeconds(i) { return Math.round((performance.now() - entries[i].t) / 1000); },
		thumbAt(i) { return entries[i] && entries[i].thumb; },
		// index of the newest snapshot at least `seconds` old (or the oldest we have)
		indexSecondsAgo(seconds) {
			const target = performance.now() - seconds * 1000;
			for (let i = entries.length - 1; i >= 0; i--) if (entries[i].t <= target) return i;
			return 0;
		},
		rewindTo(index) {
			if (!entries[index]) return Promise.resolve(false);
			return new Promise((resolve) => {
				pending = () => { const ui = restoreIndex(index); onRestore.applied(ui); resolve(true); };
			});
		},
		clear() { entries.length = 0; base = last = null; lastAt = 0; },

		// ---- save states: full image, compressed -------------------------------------------
		async captureState(ui) {
			// taken at the next tick so the engine is at a safe point
			const raw = await new Promise((resolve) => {
				pending = () => {
					const nPages = topPages();
					resolve({ img: mem().slice(0, nPages * PAGE), thumb: thumbnail(), ui });
				};
			});
			const gz = await new Response(new Blob([raw.img]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
			return { data: gz, thumb: raw.thumb, ui, bytes: raw.img.length };
		},
		async loadState(state) {
			const img = new Uint8Array(await new Response(new Blob([state.data]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
			return new Promise((resolve) => {
				pending = () => {
					applyImage(img);
					// the old rewind timeline no longer applies: start a new one from this state
					entries.length = 0; base = null; last = null; lastAt = performance.now();
					takeSnapshot(state.ui);
					onRestore.applied(state.ui);
					resolve(true);
				};
			});
		},
	};
}

// ---- IndexedDB store for save states ----------------------------------------------------------
function openStateDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open('cave-story-assist', 1);
		req.onupgradeneeded = () => req.result.createObjectStore('states');
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
async function dbOp(mode, fn) {
	const db = await openStateDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction('states', mode);
		const r = fn(tx.objectStore('states'));
		tx.oncomplete = () => resolve(r && r.result);
		tx.onerror = () => reject(tx.error);
	});
}
const stateStore = {
	get: (slot) => dbOp('readonly', (s) => s.get(slot)),
	put: (slot, v) => dbOp('readwrite', (s) => s.put(v, slot)),
};
