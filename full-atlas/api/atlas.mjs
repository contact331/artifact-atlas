const origin = 'https://artifact-atlas-private-media.marquiseczk.workers.dev';
const forwards = ['content-type', 'content-range', 'content-length', 'accept-ranges', 'etag'];
const paths = /^(?:index\.html|(?:assets|audio|data|downloads|methodology|private_previews)\/[\w .()+,'-]+(?:\/[\w .()+,'-]+)*)$/;

export default {
  async fetch(request) {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
    const requestUrl = new URL(request.url);
    const path = requestUrl.searchParams.get('asset') || 'index.html';
    if (!paths.test(path) || path.split('/').some(part => part === '.' || part === '..')) {
      return new Response(null, { status: 404 });
    }
    const token = process.env.ATLAS_PRIVATE_ORIGIN;
    if (!token) return new Response('Atlas origin is unavailable.', { status: 503 });

    const endpoint = new URL(path.split('/').map(encodeURIComponent).join('/'), origin);
    const headers = new Headers({ 'Authorization': `Bearer ${token}` });
    const range = request.headers.get('range');
    if (range) headers.set('Range', range);
    try {
      const response = await fetch(endpoint, { method: request.method, redirect: 'error', headers });
      const outgoing = new Headers();
      for (const name of forwards) {
        const value = response.headers.get(name);
        if (value !== null) outgoing.set(name, value);
      }
      outgoing.set('Cache-Control', 'private, no-store');
      return new Response(response.body, { status: response.status, headers: outgoing });
    } catch {
      return new Response('Atlas origin is unavailable.', { status: 502 });
    }
  },
};
