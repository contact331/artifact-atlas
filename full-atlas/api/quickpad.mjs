import base from './atlas.mjs';
import nav from './navigation.mjs';
function patchJS(src){
 const before="url=safe(url);if(!url)return;const key=url;";
 const after="url=safe(url);if(!url)return;const social=host(url);if(/(^|\\.)instagram\\.com$/.test(social)){if(archived)return;url='https://www.instagram.com/marquise.delafressange/';label='Instagram profile';platform='Instagram';}else if(/(^|\\.)youtube\\.com$|^youtu\\.be$/.test(social)){if(archived)return;url='https://www.youtube.com/@MarquiseDLF';label='YouTube channel';platform='YouTube';}const key=url;";
 if(!src.includes(before))throw Error('Unexpected Quickpad link source');
 src=src.replace(before,()=>after);
 const old='<path d="M13 4h7v7m0-7-9 9M10 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5"/><path d="M8 9h3M8 14h3M8 17h7"/>';
 const glyph='<rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.4"/>';
 if(!src.includes(old))throw Error('Unexpected Quickpad icon source');
 src=src.replace(old,glyph);
 src=src.replace(".filter(p=>p.url);", ".filter(p=>p.url&&!/(^|\\.)instagram\\.com$|(^|\\.)youtube\\.com$|^youtu\\.be$/.test(host(p.url)));");
 return src;
}
const css="\n/* T28: clean symmetric directory icon, preserve two-second orbit */\n.qp-icon svg{display:block;width:24px;height:24px;stroke-width:1.65}.qp-icon{box-sizing:border-box;display:grid;place-items:center;line-height:0}.qp-icon::after{inset:-2px;border-radius:12px}\n";
export default {async fetch(request){
 const u=new URL(request.url),asset=u.searchParams.get('asset');
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
 if(!['assets/quickpad.js','assets/quickpad.css'].includes(asset))return new Response(null,{status:404});
 const upstream=await (asset.endsWith('.js')?base:nav).fetch(new Request(u,{method:'GET',headers:request.headers}));
 if(!upstream.ok)return upstream;
 const original=await upstream.text();let body;
 try{body=asset.endsWith('.js')?patchJS(original):original+css;}catch(err){console.error(err.message);return new Response(original,{headers:{'Content-Type':upstream.headers.get('content-type')||'text/plain','Cache-Control':'private, no-store','X-Atlas-Patch':'failed'}});}
 return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':asset.endsWith('.js')?'application/javascript; charset=utf-8':'text/css; charset=utf-8','Content-Length':String(Buffer.byteLength(body)),'Cache-Control':'private, no-store','X-Atlas-Release':'T28'}});
}};