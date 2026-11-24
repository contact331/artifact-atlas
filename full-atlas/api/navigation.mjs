import previous from './chrome.mjs';
export default {async fetch(request){
  const u=new URL(request.url), asset=u.searchParams.get('asset')||'index.html';
  if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});
  if(!['index.html','assets/app.js','assets/quickpad.css'].includes(asset))return new Response(null,{status:404});
  u.searchParams.set('asset',asset);
  const upstream=await previous.fetch(new Request(u,{method:'GET',headers:request.headers}));
  if(!upstream.ok)return upstream;
  let body=await upstream.text();
  if(asset==='index.html'){
    body=body.replace(/<label class="search-field" for="search">[\s\S]*?<\/label>/,'<input id="search" type="hidden" value="">');
    body=body.replace(/<div class="research-metrics" id="researchMetrics">[\s\S]*?<\/div>/,'');
  }else if(asset==='assets/app.js'){
    body=body.replace(/EL\.pills\.innerHTML=quickOptions\[state\.view\]\.map\([^\n]*?\.join\(''\);/,"EL.pills.replaceChildren();");
  }else{
    body+='\n.brandmark i{display:block!important;position:static!important;width:26px;height:6px;flex:none;margin:0;border-radius:4px;background:#f1ccff;opacity:.75}.brandmark span{line-height:.85}.brandmark{gap:3px;justify-content:center;align-items:center}@media(max-width:560px){.brandmark i{height:4px;width:20px}}';
  }
  return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':upstream.headers.get('content-type')||'text/plain','Content-Length':String(Buffer.byteLength(body)),'Cache-Control':'private, no-store','X-Atlas-Release':'T27.1'}});
}};