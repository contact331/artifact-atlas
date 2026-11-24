import base from './atlas.mjs';
import previous from './quickpad.mjs';
const ig='https://www.instagram.com/marquise.delafressange/';
const future='https://www.youtube.com/@MarquiseDLF';
const imagined='https://www.youtube.com/channel/UC-UOmes8M5vUWZbOVGS_nnQ';
function patchJS(src){
  const edits=[
    ["url=safe(url);if(!url)return;const key=url;", "url=safe(url);if(!url)return;const social=host(url);if(/(^|\\.)instagram\\.com$/.test(social)){if(archived)return;url="+JSON.stringify(ig)+";label='Instagram profile';platform='Instagram';}else if(/(^|\\.)youtube\\.com$|^youtu\\.be$/.test(social)){if(archived)return;const isFuture=/\\/\\@MarquiseDLF(?:\\/|$)/i.test(new URL(url).pathname)||a.id==='ART-13';url=isFuture?"+JSON.stringify(future)+":"+JSON.stringify(imagined)+";label=isFuture?'Future Timeline Series':'The Imagined Life';platform='YouTube';}const key=url;"],
    ["return {id:a.id,title:a.identity.title,symbol:a.identity.symbol,color:a.identity.color_hex,", "if(a.id==='ART-12'){add("+JSON.stringify(ig)+",'Instagram profile','connected profile',false,'Instagram');add("+JSON.stringify(future)+",'Future Timeline Series','catalogue channel',false,'YouTube');add("+JSON.stringify(imagined)+",'The Imagined Life','connected channel',false,'YouTube');}return {id:a.id,title:a.identity.title,symbol:a.identity.symbol,color:a.identity.color_hex,"],
    [".filter(p=>p.url);", ".filter(p=>p.url&&!/(^|\\.)instagram\\.com$|(^|\\.)youtube\\.com$|^youtu\\.be$/.test(host(p.url)));"],
    ["a.style.setProperty('--qp-color',r.color||'#817e9b');","a.style.setProperty('--qp-color',/^(?:instagram\\.com|youtube\\.com)$/.test(host(group.url))?'#DB2777':(r.color||'#817e9b'));"],
    ['<path d="M13 4h7v7m0-7-9 9M10 5H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-5"/><path d="M8 9h3M8 14h3M8 17h7"/>','<rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.4"/>']
  ];
  for(const [a,b] of edits){if(src.split(a).length!==2)throw Error('T29 Quickpad source mismatch');src=src.replace(a,()=>b);}
  return src;
}
export default {async fetch(request){
 const u=new URL(request.url),asset=u.searchParams.get('asset');
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
 if(asset==='assets/quickpad.css')return previous.fetch(request);
 if(asset!=='assets/quickpad.js')return new Response(null,{status:404});
 const upstream=await base.fetch(new Request(u,{method:'GET',headers:request.headers}));
 if(!upstream.ok)return upstream;
 const original=await upstream.text();let body;
 try{body=patchJS(original);}catch(err){console.error(err.message);return previous.fetch(request);}
 return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':'application/javascript; charset=utf-8','Content-Length':String(Buffer.byteLength(body)),'Cache-Control':'private, no-store','X-Atlas-Release':'T29'}});
}};