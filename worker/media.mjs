import {tracks} from './manifest.mjs';

function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  if (!match[1]) {
    const length = Math.min(size, Number(match[2]));
    return length > 0 ? {offset: size - length, length} : null;
  }
  const offset = Number(match[1]);
  const end = match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return offset <= end ? {offset, length: end - offset + 1} : null;
}

export default {
  async fetch(request, env, context) {
    const url = new URL(request.url);
    const key = url.pathname.slice(1);
    const track = tracks[key];
    if (!Object.hasOwn(tracks, key)) return new Response('Not found', {status: 404});

    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Range, ETag',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': 'audio/mpeg',
      'X-Content-Type-Options': 'nosniff',
    });
    if (request.method === 'OPTIONS') {
      headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Range, If-Range');
      return new Response(null, {status: 204, headers});
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', {status: 405, headers: {Allow: 'GET, HEAD, OPTIONS'}});
    }
    const cacheKey = new Request(url.origin + url.pathname);
    headers.set('Content-Length', track.bytes);
    if (request.method === 'HEAD') {
      const object = await env.MEDIA.head(key);
      if (!object || object.size !== track.bytes) return new Response('Not found', {status: 404});
      headers.set('ETag', object.httpEtag);
      return new Response(null, {headers});
    }

    const requested = request.headers.get('Range');
    if (!requested) {
      const cached = await caches.default.match(cacheKey);
      if (cached) return cached;
    }
    const range = requested ? parseRange(requested, track.bytes) : undefined;
    if (requested && !range) {
      return new Response(null, {status: 416, headers: {'Content-Range': `bytes */${track.bytes}`}});
    }
    const object = await env.MEDIA.get(key, range ? {range} : undefined);
    if (!object || object.size !== track.bytes) return new Response('Not found', {status: 404});
    headers.set('ETag', object.httpEtag);
    if (range) {
      headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${track.bytes}`);
      headers.set('Content-Length', range.length);
    }
    const response = new Response(object.body, {status: range ? 206 : 200, headers});
    if (!range) context.waitUntil(caches.default.put(cacheKey, response.clone()).catch(() => {}));
    return response;
  },
};
