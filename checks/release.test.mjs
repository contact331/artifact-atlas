import {createHash} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import worker from '../worker/media.mjs';
import {tracks} from '../worker/manifest.mjs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('site/index.html');
const context = {window: {}};
runInNewContext(read('site/assets/catalogue.js'), context);
const {artifacts, mediaBase} = context.window.ATLAS_CATALOGUE;

test('public file inventory and manifest agree', () => {
  assert.deepEqual(readdirSync(new URL('../site', import.meta.url)).sort(), ['assets', 'index.html']);
  assert.deepEqual(readdirSync(new URL('../site/assets', import.meta.url)).sort(), ['app.js', 'audio.js', 'catalogue.js', 'styles.css']);
  assert.equal(artifacts.length, 21);
  const keys = ['v1/intro.mp3'];
  for (const record of artifacts) {
    assert.match(record.id, /^ART-\d{2}$/);
    assert.match(record.color, /^#[\dA-F]{6}$/i);
    assert.equal(record.themes.length, 4);
    assert(record.themes.every(theme => theme.title && theme.description));
    assert(record.summary && record.method && record.links.length > 0);
    assert(record.links.every(link => new URL(link.url).protocol === 'https:'));
    keys.push('v1/' + record.id + '.mp3', ...record.themes.map((_, n) => `v1/${record.id}-theme-0${n + 1}.mp3`));
  }
  assert.deepEqual(Object.keys(tracks).sort(), keys.sort());
  assert(Object.values(tracks).every(t => t.bytes > 0 && /^[a-f0-9]{64}$/.test(t.sha256)));
  for (const path of ['site/index.html', 'site/assets/catalogue.js', 'site/assets/app.js', 'site/assets/audio.js']) {
    assert(!/private_previews|data:audio|BEGIN PRIVATE KEY|source_manifest|chat_primary_windows|chat_edges|artifact-atlas-tts-private/.test(read(path)), path);
  }
});

test('public grid and inspector start with the frozen slots and collapsed sections', () => {
  class Node {
    dataset = {};
    classList = {toggle() {}};
    value = '';
    addEventListener() {}
    insertAdjacentHTML() {}
    setAttribute() {}
  }
  const nodes = new Map();
  const query = selector => {
    if (/^#[\w-]+$/.test(selector)) assert(html.includes(`id="${selector.slice(1)}"`), selector);
    if (!nodes.has(selector)) nodes.set(selector, new Node());
    return nodes.get(selector);
  };
  const document = {
    querySelector: query, querySelectorAll: () => [], addEventListener() {}, body: new Node(),
  };
  runInNewContext(read('site/assets/app.js'), {
    document, URL, URLSearchParams, location: {hash: '#view=records&a=ART-12'},
    window: {...context.window, initAtlasAudio: () => ({sync() {}}), addEventListener() {}},
    requestAnimationFrame() {},
  });
  const render = nodes.get('#lattice').innerHTML;
  assert.equal((render.match(/class="cube-cluster"/g) || []).length, artifacts.length);
  const cluster = render.match(/<div class="cube-cluster"[^>]+>[\s\S]+?<\/div>/)[0];
  assert.equal([...cluster.matchAll(/--mini-position:(\d)/g)].map(match => match[1]).join(''), '01234567');
  assert.match(cluster, /--mini-position:0" data-atlas-audio=/);
  assert.match(cluster, /--mini-position:2" data-popup="section-2"/);
  assert.match(cluster, /--mini-position:5" data-popup="section-5"/);
  assert.match(cluster, /mcube--blank" style="--mini-position:7"/);
  const inspector = nodes.get('#inspectorContent').innerHTML;
  assert.match(inspector, /short-form publishing/);
  assert.equal((inspector.match(/<details /g) || []).length, 6);
  assert.doesNotMatch(inspector, /<details [^>]*\bopen\b/);
});

test('public Worker serves byte ranges and denies unlisted paths', async () => {
  const data = new Uint8Array(tracks['v1/intro.mp3'].bytes);
  const object = {size: data.length, httpEtag: '"example"'};
  globalThis.caches = {default: {match: async () => undefined, put: async () => {}}};
  const env = {MEDIA: {
    head: async () => object,
    get: async (_key, options) => ({...object, body: options?.range
      ? data.slice(options.range.offset, options.range.offset + options.range.length) : data}),
  }};
  const cf = {waitUntil() {}};
  const serve = (path, options) => worker.fetch(new Request(new URL(path, mediaBase), options), env, cf);
  assert.equal((await serve('/v1/ART-06.mp3')).status, 404);
  assert.equal((await serve('/v1/constructor')).status, 404);
  assert.equal((await serve('/v1/intro.mp3', {method: 'POST'})).status, 405);
  const head = await serve('/v1/intro.mp3', {method: 'HEAD'});
  assert.equal(head.headers.get('Content-Length'), String(data.length));
  assert.equal(head.headers.get('Content-Type'), 'audio/mpeg');
  const range = await serve('/v1/intro.mp3', {headers: {Range: 'bytes=0-1023'}});
  assert.equal(range.status, 206);
  assert.equal(range.headers.get('Content-Range'), `bytes 0-1023/${data.length}`);
  assert.equal((await range.arrayBuffer()).byteLength, 1024);
  const suffix = await serve('/v1/intro.mp3', {headers: {Range: 'bytes=-32'}});
  assert.equal(suffix.status, 206);
  assert.equal((await suffix.arrayBuffer()).byteLength, 32);
  assert.equal((await serve('/v1/intro.mp3', {headers: {Range: 'bytes=999999-'}})).status, 416);
  const full = await serve('/v1/intro.mp3');
  assert.equal(full.status, 200);
  assert.equal(createHash('sha256').update(Buffer.from(await full.arrayBuffer())).digest('hex'),
               createHash('sha256').update(data).digest('hex'));
});
