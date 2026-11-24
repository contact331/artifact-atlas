import base from './atlas.mjs';
import sidebar from './sidebar.mjs';
const css="\n/* T27 navigation simplification */\n.control-deck .search-field,.control-deck #filterPills,#researchMetrics{display:none!important}\n.control-deck .toolbar{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}\n.control-deck .filter-tray{justify-content:flex-end;margin-top:10px}\n.control-deck .atlas-gold-select{position:relative;isolation:isolate;min-width:0;border-radius:10px}\n.control-deck .atlas-gold-select select{width:100%;display:block;position:relative;z-index:1}\n.atlas-gold-select::after{content:'';position:absolute;z-index:2;inset:-1px;padding:1.5px;border-radius:11px;pointer-events:none;background:conic-gradient(from var(--qp-gold-angle),transparent 0deg 285deg,#8b591900 286deg,#b9772770 312deg,#ffcf69 345deg,#fff4bc 356deg,transparent 360deg);mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);mask-composite:exclude;animation:qp-gold-orbit 2s linear infinite;filter:drop-shadow(0 0 3px #f8bd4d)}\n.atlas-gold-select:nth-of-type(2)::after{animation-delay:-.67s}\n.atlas-gold-select:nth-of-type(3)::after{animation-delay:-1.33s}\n.brandmark{display:flex!important;flex-direction:column;align-items:center;justify-content:center;gap:3px}\n.brandmark span{display:block;line-height:.85}\n.brandmark i{position:static!important;flex:none;margin:0}\n@media(max-width:480px){.control-deck .toolbar{grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.control-deck .toolbar select{padding:0 5px;font-size:10px}}\n@media(prefers-reduced-motion:reduce){.atlas-gold-select::after{animation:none;--qp-gold-angle:45deg}}\n";
function patchHtml(src){
  src=src.replace('PRIVATE DATASET <span>·</span> SIGN-IN REQUIRED','PRIVATE DATASET');
  for(const id of ['domainFilter','projectFilter','sortFilter']){
    const pattern=new RegExp('<select id="'+id+'">[\\s\\S]*?<\\/select>');
    if(!pattern.test(src))throw Error('Expected Atlas filter missing: '+id);
    src=src.replace(pattern,m=>'<div class="atlas-gold-select">'+m+'</div>');
  }
  return src;
}
export default {async fetch(request){
 const url=new URL(request.url),asset=url.searchParams.get('asset')||'index.html';
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
 if(!['index.html','assets/app.js','assets/quickpad.css'].includes(asset))return new Response(null,{status:404});
 url.searchParams.set('asset',asset);
 const upstream=await (asset==='index.html'?base:sidebar).fetch(new Request(url,{method:'GET',headers:request.headers}));
 if(!upstream.ok)return upstream;
 const original=await upstream.text();let body=original;
 try{
  if(asset==='index.html')body=patchHtml(original);
  else if(asset==='assets/quickpad.css')body=original+css;
  else body=original.replace("if(e.key==='/'&&!e.altKey","if(EL.query.getClientRects().length&&e.key==='/'&&!e.altKey");
 }catch(err){console.error(err.message);return new Response(original,{headers:{'Content-Type':upstream.headers.get('content-type')||'text/plain','Cache-Control':'private, no-store','X-Atlas-Patch':'failed'}});}
 return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':asset==='index.html'?'text/html; charset=utf-8':asset.endsWith('.js')?'application/javascript; charset=utf-8':'text/css; charset=utf-8','Content-Length':String(Buffer.byteLength(body)),'Cache-Control':'private, no-store','X-Atlas-Release':'T27'}});
}};