/* Shared renderer for the Atlas chambers. */
(()=>{'use strict';
const lattice=document.querySelector('#lattice');if(!lattice)return;
const canvas=document.createElement('canvas');canvas.id='atlas-living-canvas';canvas.setAttribute('aria-hidden','true');document.body.append(canvas);
const toggle=document.createElement('button');toggle.type='button';toggle.className='utility-button atlas-living-toggle';document.querySelector('.head-actions')?.prepend(toggle);
const isFirefox = /Firefox\//i.test(navigator.userAgent);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let ctx = null, mode = 'none', gl, program, u;
let paused = reduceMotion, motionChosen = false, pixelRatioCap = 1.5;
let usesSoftwareRendering = false;
let ok = false, dirty = true, last = 0, frames = 0, drawn = 0;
let requested = 0, loading = 0, failed = 0, drag = null, suppress = null;
let frameRequest = 0, scrollWake = 0, animateVisible = false;
const band={top:0,left:0,height:0,width:0,dpr:0};
const layout={top:0,left:0,bottom:0,right:0,dirty:true};
const drawAhead=180;
const scrollIdleDelay=100;
let scrolling = false;
let rotationTime = null;
const entries=new Map(),active=new Map(),queue=new Set();const vs="#version 300 es\nin vec3 p;in vec3 n;in vec4 c;uniform float ay,ax,scale,aspect;uniform vec2 offset;out vec3 N;out vec3 P;out vec3 C;void main(){float cy=cos(ay),sy=sin(ay),cx=cos(ax),sx=sin(ax);mat3 Y=mat3(cy,0.,-sy,0.,1.,0.,sy,0.,cy);mat3 X=mat3(1.,0.,0.,0.,cx,sx,0.,-sx,cx);vec3 q=X*Y*p;N=X*Y*n;P=q;C=c.rgb;float perspective=1./(1.-q.z*.12);gl_Position=vec4(q.x*scale*perspective/aspect+offset.x,q.y*scale*perspective+offset.y,-q.z*.35,1.);}",fs="#version 300 es\nprecision highp float;in vec3 N;in vec3 P;in vec3 C;out vec4 frag;void main(){vec3 n=normalize(N);vec3 l=normalize(vec3(-.6,.8,1.1));vec3 v=normalize(vec3(0.,0.,4.)-P);vec3 h=normalize(l+v);float diff=max(dot(n,l),0.);float rim=pow(1.-max(dot(n,v),0.),2.2);float sp=pow(max(dot(n,h),0.),38.);float strip=pow(max(dot(n,normalize(vec3(.85,.30,.85))),0.),13.);vec3 col=C*(.35+.75*diff)+vec3(.9,.95,1.)*sp*.56+vec3(.50,.65,.85)*rim*.16+vec3(1.,.89,.69)*strip*.22;frag=vec4(clamp(col,0.,1.),1.);}";
function get(id){if(!entries.has(id))entries.set(id,{angle:.22+Number(id.slice(-2))*.17,tilt:.15,state:'idle',raw:null,gpu:null});return entries.get(id)}
function init(){try{gl=canvas.getContext('webgl2',{
  alpha:true,
  antialias:true,
  premultipliedAlpha:false,
  powerPreference:'low-power'
});if(!gl)throw Error('WebGL2 unavailable');function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);u=Object.fromEntries(['ay','ax','scale','aspect','offset'].map(k=>[k,gl.getUniformLocation(program,k)]));gl.enable(gl.DEPTH_TEST);gl.enable(gl.SCISSOR_TEST);ok=true;mode='webgl2';canvas.hidden=false;toggle.disabled=false;rotationTime=null;configureMotion();return true}catch(e){ctx=canvas.getContext('2d');if(ctx){ok=true;mode='cpu';canvas.hidden=false;toggle.disabled=false;rotationTime=null;configureMotion();return true}ok=false;mode='none';canvas.hidden=true;toggle.textContent='3D unavailable';toggle.disabled=true;return false}}
function decode(raw){const a=new Uint8Array(raw),d=new DataView(raw);if(d.getUint32(0,true)!==0x46546c67||d.getUint32(4,true)!==2||d.getUint32(8,true)!==a.length)throw Error('Bad GLB');const n=d.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(a.slice(20,20+n))),start=28+n,p=j.meshes[0].primitives[0];if(mode==='cpu'){function acc(i){const ac=j.accessors[i],bv=j.bufferViews[ac.bufferView],o=start+(bv.byteOffset||0)+(ac.byteOffset||0),k={SCALAR:1,VEC3:3,VEC4:4}[ac.type],T={5125:Uint32Array,5126:Float32Array,5121:Uint8Array,5123:Uint16Array}[ac.componentType];return new T(raw,o,ac.count*k)}return{p:acc(p.attributes.POSITION),n:acc(p.attributes.NORMAL),c:acc(p.attributes.COLOR_0),ix:acc(p.indices)}}const pa=j.accessors[p.attributes.POSITION],pb=j.bufferViews[pa.bufferView],positions=new Float32Array(raw,start+(pb.byteOffset||0)+(pa.byteOffset||0),pa.count*3);const vao=gl.createVertexArray(),buffers=[];gl.bindVertexArray(vao);for(const [attr,name,size] of [['POSITION','p',3],['NORMAL','n',3],['COLOR_0','c',4]]){const ac=j.accessors[p.attributes[attr]],bv=j.bufferViews[ac.bufferView],b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,a.subarray(start+(bv.byteOffset||0),start+(bv.byteOffset||0)+bv.byteLength),gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,ac.componentType,!!ac.normalized,bv.byteStride||0,ac.byteOffset||0)}const ac=j.accessors[p.indices],bv=j.bufferViews[ac.bufferView],b=gl.createBuffer();buffers.push(b);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,a.subarray(start+(bv.byteOffset||0),start+(bv.byteOffset||0)+bv.byteLength),gl.STATIC_DRAW);gl.bindVertexArray(null);return{p:positions,vao,buffers,count:ac.count,type:ac.componentType,offset:ac.byteOffset||0}}
const io=new IntersectionObserver(es=>{for(const it of es){const id=it.target.dataset.record,a=active.get(id);if(!a||a.node!==it.target)continue;a.near=it.isIntersecting;if(a.near&&['idle','cached'].includes(get(id).state))queue.add(id);else if(!a.near)queue.delete(id)}pump();invalidate();},{rootMargin:drawAhead+'px 0px'});
function sync(){io.disconnect();active.clear();queue.clear();for(const node of lattice.querySelectorAll('.cube--artifact[data-record]')){const id=node.dataset.record,area=node.querySelector('.cube-center');if(!area||!/^ART-(0[1-9]|[1-6][0-9]|7[01])$/.test(id))continue;active.set(id,{node,area,near:false});get(id);io.observe(node)}invalidateLayout()}
function pump(){if(!ok)return;while(loading<3&&queue.size){const id=queue.values().next().value;queue.delete(id);const e=get(id);if(!active.get(id)?.near||!['idle','cached'].includes(e.state))continue;e.state='loading';loading++;(async()=>{try{if(!e.raw){requested++;const res=await fetch('/living/v1/'+id+'.glb');if(!res.ok)throw Error('HTTP '+res.status);e.raw=await res.arrayBuffer()}if(!ok){e.state='cached';return}e.gpu=decode(e.raw);e.gpu.fitPoints=uniquePositions(e.gpu.p);e.state='ready'}catch(err){e.state='failed';failed++}finally{loading--;invalidate();pump()}})()}}
canvas.addEventListener('webglcontextlost',ev=>{ev.preventDefault();ok=false;canvas.hidden=true;for(const e of entries.values()){e.gpu=null;e.state=e.raw?'cached':'idle'}for(const a of active.values())a.node.classList.remove('atlas-living-ready');dirty=true});canvas.addEventListener('webglcontextrestored',()=>{if(init()){for(const [id,a] of active)if(a.near)queue.add(id);pump();invalidate()}});
function configureMotion() {
  const driverInfo = mode === 'webgl2' ? gl.getExtension('WEBGL_debug_renderer_info') : null;
  const driver = driverInfo ? gl.getParameter(driverInfo.UNMASKED_RENDERER_WEBGL) : '';
  usesSoftwareRendering = mode === 'cpu' || /swiftshader|llvmpipe|softpipe|software rasterizer|basic render|\bwarp\b/i.test(driver);
  pixelRatioCap = usesSoftwareRendering ? 1 : 1.5;
  if (!motionChosen) paused = reduceMotion || usesSoftwareRendering;
  setPause();
}

function setPause() {
  toggle.textContent = paused ? '3D · rotate' : '3D · pause';
  toggle.setAttribute('aria-label',paused ? 'Start 3D rotation' : 'Pause 3D rotation');
  toggle.setAttribute('aria-pressed',String(!paused));
  invalidate();
}

toggle.onclick = () => {
  motionChosen = true;
  paused = !paused;
  rotationTime = null;
  setPause();
};
lattice.addEventListener('pointerdown',ev=>{const node=ev.target.closest('.cube--artifact[data-record]');if(!node||!ok||get(node.dataset.record).state!=='ready'||ev.button!==0)return;drag={node,id:node.dataset.record,x:ev.clientX,y:ev.clientY,px:ev.clientX,py:ev.clientY,pid:ev.pointerId,moved:false};suppress=null},{passive:true});window.addEventListener('pointermove',ev=>{if(!drag||ev.pointerId!==drag.pid)return;const p=drag;if(!p.moved){const dx=ev.clientX-p.x,dy=ev.clientY-p.y;if(ev.pointerType==='touch'&&Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>7){drag=null;return}if(Math.hypot(dx,dy)<8)return;p.moved=true;try{p.node.setPointerCapture(ev.pointerId)}catch{}}const e=get(p.id);e.angle+=(ev.clientX-p.px)*.015;e.tilt=Math.max(-.7,Math.min(.7,e.tilt+(ev.clientY-p.py)*.012));p.px=ev.clientX;p.py=ev.clientY;invalidate()},{passive:true});function end(ev){if(drag&&ev.pointerId===drag.pid){if(drag.moved)suppress={node:drag.node,time:performance.now()};drag=null;rotationTime=null;invalidate()}}window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);lattice.addEventListener('click',ev=>{if(suppress&&performance.now()-suppress.time<500&&ev.target.closest('.cube--artifact')===suppress.node){ev.preventDefault();ev.stopImmediatePropagation();suppress=null}},true);
function scheduleFrame() {
  if (ok && !document.hidden && !frameRequest) frameRequest = requestAnimationFrame(frame);
}

function invalidate() {
  dirty = true;
  scheduleFrame();
}

function invalidateLayout() {
  layout.dirty = true;
  invalidate();
}

window.addEventListener('scroll', () => {
  scrolling = true;
  rotationTime = null;
  scheduleFrame();
  clearTimeout(scrollWake);
  // Recompute visibility even when the last scroll stayed inside the canvas
  // band and did not trigger an intersection change.
  scrollWake = setTimeout(() => {
    scrolling = false;
    invalidate();
  },scrollIdleDelay);
}, {passive:true});
window.addEventListener('resize', invalidateLayout);
document.addEventListener('visibilitychange', () => {
  rotationTime = null;
  invalidateLayout();
});
const layoutObserver = new ResizeObserver(invalidateLayout);
layoutObserver.observe(lattice);
if (lattice.parentElement) layoutObserver.observe(lattice.parentElement);
new MutationObserver(sync).observe(lattice,{childList:true});

// Keep the canvas in the same scrolling coordinate space as the chambers.
// Its backing surface only covers the viewport and a small vertical buffer.
function updateBand(scrollTop, scrollLeft, viewportHeight, viewportWidth, dpr) {
  if (layout.dirty) {
    const rect = lattice.getBoundingClientRect();
    layout.top = Math.max(0, Math.floor(rect.top + scrollTop));
    layout.bottom = Math.max(layout.top, Math.floor(rect.bottom + scrollTop));
    layout.left = Math.max(0, Math.floor(rect.left + scrollLeft));
    layout.right = Math.max(layout.left, Math.ceil(rect.right + scrollLeft));
    layout.dirty = false;
  }
  const height = active.size ? Math.min(viewportHeight + 2 * drawAhead, layout.bottom - layout.top) : 0;
  const left = height ? Math.max(layout.left,Math.floor(scrollLeft)) : 0;
  const width = height ? Math.max(0,Math.min(layout.right,Math.ceil(scrollLeft + viewportWidth)) - left) : 0;
  const visibleTop = Math.max(layout.top, scrollTop);
  const visibleBottom = Math.min(layout.bottom, scrollTop + viewportHeight);
  const coversView = band.top <= visibleTop && band.top + band.height >= visibleBottom;
  const insideLattice = band.top >= layout.top && band.top + height <= layout.bottom;
  const sameSurface = band.left === left && band.width === width && band.height === height && band.dpr === dpr;
  if (sameSurface && coversView && insideLattice) return false;
  const top = height ? Math.max(layout.top, Math.min(Math.floor(scrollTop) - drawAhead, layout.bottom - height)) : 0;
  if (sameSurface && band.top === top) return false;
  if (band.top !== top) canvas.style.top = top + 'px';
  if (band.left !== left) canvas.style.left = left + 'px';
  if (band.height !== height) canvas.style.height = height + 'px';
  if (band.width !== width) canvas.style.width = width + 'px';
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  Object.assign(band,{top,left,height,width,dpr});
  return true;
}

function clearCanvas() {
  if (mode === 'cpu') {
    ctx.setTransform(band.dpr,0,0,band.dpr,0,0);
    ctx.clearRect(0,0,band.width,band.height);
  } else {
    gl.scissor(0,0,canvas.width,canvas.height);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }
}
// T44: fit actual projected silhouette, not merely the model origin.
function projectedFit(p,angle,tilt,aspect){const cy=Math.cos(angle),sy=Math.sin(angle),cx=Math.cos(tilt),sx=Math.sin(tilt);let l=Infinity,r=-Infinity,b=Infinity,t=-Infinity;for(let i=0;i<p.length;i+=3){const x=cy*p[i]+sy*p[i+2],z=-sy*p[i]+cy*p[i+2],y=cx*p[i+1]-sx*z,w=sx*p[i+1]+cx*z,d=1/(1-w*.12),px=x*d,py=y*d;l=Math.min(l,px);r=Math.max(r,px);b=Math.min(b,py);t=Math.max(t,py)}const scale=Math.min(.86,1.84*aspect/Math.max(r-l,1e-6),1.84/Math.max(t-b,1e-6));return{scale,ox:-(l+r)*.5*scale/aspect,oy:-(b+t)*.5*scale,spanX:(r-l)*scale/aspect,spanY:(t-b)*scale}};
function uniquePositions(positions) {
  // Hard edges create repeated positions with different normals or colors.
  // A repeated position cannot change the bounds of a projected silhouette.
  const seen = new Set();
  const points = [];
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const key = x + ',' + y + ',' + z;
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(x,y,z);
  }
  return points.length < positions.length ? Float32Array.from(points) : positions;
}

function drawCPU(target, model, rect, mesh, fit) {
  const cosY = Math.cos(model.angle), sinY = Math.sin(model.angle);
  const cosX = Math.cos(model.tilt), sinX = Math.sin(model.tilt);
  const points = mesh.projectedPoints ??= new Float64Array(mesh.p.length);
  const normals = mesh.rotatedNormals ??= new Float64Array(mesh.n.length);
  const depths = mesh.faceDepths ??= new Float64Array(mesh.ix.length / 3);
  const faces = mesh.visibleFaces ??= [];
  const scale = rect.height * fit.scale * .5;
  const centerX = rect.left + rect.width * (1 + fit.ox) * .5;
  const centerY = rect.top + rect.height * (1 - fit.oy) * .5;

  for (let i = 0; i < mesh.p.length; i += 3) {
    const x = mesh.p[i], y = mesh.p[i + 1], z = mesh.p[i + 2];
    const depth = -sinY * x + cosY * z;
    const rotatedZ = sinX * y + cosX * depth;
    const perspective = scale / (1 - rotatedZ * .12);
    points[i] = centerX + (cosY * x + sinY * z) * perspective;
    points[i + 1] = centerY - (cosX * y - sinX * depth) * perspective;
    points[i + 2] = rotatedZ;

    const nx = mesh.n[i], ny = mesh.n[i + 1], nz = mesh.n[i + 2];
    const normalDepth = -sinY * nx + cosY * nz;
    normals[i] = cosY * nx + sinY * nz;
    normals[i + 1] = cosX * ny - sinX * normalDepth;
    normals[i + 2] = sinX * ny + cosX * normalDepth;
  }

  faces.length = 0;
  for (let face = 0; face < depths.length; face++) {
    const offset = face * 3;
    const a = mesh.ix[offset] * 3, b = mesh.ix[offset + 1] * 3, c = mesh.ix[offset + 2] * 3;
    const facing = (points[b] - points[a]) * (points[c + 1] - points[a + 1])
      - (points[b + 1] - points[a + 1]) * (points[c] - points[a]);
    if (facing >= 0) continue;
    depths[face] = (points[a + 2] + points[b + 2] + points[c + 2]) / 3;
    faces.push(face);
  }
  faces.sort((a,b) => depths[a] - depths[b]);

  target.save();
  target.beginPath();
  target.rect(rect.left,rect.top,rect.width,rect.height);
  target.clip();
  target.lineWidth = .55;
  for (const face of faces) {
    const offset = face * 3;
    const ia = mesh.ix[offset], ib = mesh.ix[offset + 1], ic = mesh.ix[offset + 2];
    const a = ia * 3, b = ib * 3, c = ic * 3;
    let nx = (normals[a] + normals[b] + normals[c]) / 3;
    let ny = (normals[a + 1] + normals[b + 1] + normals[c + 1]) / 3;
    let nz = (normals[a + 2] + normals[b + 2] + normals[c + 2]) / 3;
    const length = Math.hypot(nx,ny,nz) || 1;
    nx /= length;
    ny /= length;
    nz /= length;
    const diffuse = .35 + .75 * Math.max(0,-.40*nx + .54*ny + .74*nz);
    const shine = Math.pow(Math.max(0,-.21*nx + .28*ny + .936*nz),36) * .56
      + Math.pow(1 - Math.max(0,nz),2.2) * .10
      + Math.pow(Math.max(0,.686*nx + .242*ny + .686*nz),13) * .15;
    const channel = index => Math.min(255,Math.round(
      (mesh.c[ia*4 + index] + mesh.c[ib*4 + index] + mesh.c[ic*4 + index]) / 3 * diffuse + 255 * shine
    ));
    const color = `rgb(${channel(0)},${channel(1)},${channel(2)})`;
    target.fillStyle = color;
    target.strokeStyle = color;
    target.beginPath();
    target.moveTo(points[a],points[a + 1]);
    target.lineTo(points[b],points[b + 1]);
    target.lineTo(points[c],points[c + 1]);
    target.closePath();
    target.fill();
    target.stroke();
  }
  target.restore();
}

const cpuSurfaces = new Map();
const cpuCacheLimit = 8;

function drawCachedCPU(entry, rect, fit) {
  let cache = cpuSurfaces.get(entry);
  if (!cache) {
    const surface = document.createElement('canvas');
    const context = surface.getContext('2d');
    if (!context) {
      drawCPU(ctx,entry,rect,entry.gpu,fit);
      return;
    }
    cache = {surface,context};
    if (cpuSurfaces.size >= cpuCacheLimit) cpuSurfaces.delete(cpuSurfaces.keys().next().value);
  }
  // Keep the last few visible models. Scrolling and dragging one model can
  // reuse all other unchanged CPU-rendered poses.
  cpuSurfaces.delete(entry);
  cpuSurfaces.set(entry,cache);
  if (cache.mesh !== entry.gpu || cache.fit !== fit || cache.width !== rect.width || cache.height !== rect.height) {
    const width = Math.ceil(rect.width), height = Math.ceil(rect.height);
    if (cache.surface.width !== width) cache.surface.width = width;
    if (cache.surface.height !== height) cache.surface.height = height;
    cache.context.setTransform(1,0,0,1,0,0);
    cache.context.clearRect(0,0,width,height);
    drawCPU(cache.context,entry,{left:0,top:0,width:rect.width,height:rect.height},entry.gpu,fit);
    Object.assign(cache,{mesh:entry.gpu,fit,width:rect.width,height:rect.height});
  }
  ctx.drawImage(cache.surface,0,0,rect.width,rect.height,rect.left,rect.top,rect.width,rect.height);
}

const modalSelector = 'dialog[open],#mcubeOverlay:not([hidden]),body.inspector-open,.atlas-full-pdf-overlay,#atlasT20DossierOverlay';
let modal = Boolean(document.querySelector(modalSelector));

function syncModal() {
  const open = Boolean(document.querySelector(modalSelector));
  if (modal === open) return;
  modal = open;
  rotationTime = null;
  invalidate();
}

new MutationObserver(syncModal).observe(document.body,{childList:true,attributes:true,attributeFilter:['class']});
new MutationObserver(syncModal).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','hidden']});

function fitForPose(entry, aspect) {
  const cached = entry.fit;
  if (cached?.angle === entry.angle && cached.tilt === entry.tilt && cached.aspect === aspect) return cached.value;
  const value = projectedFit(entry.gpu.fitPoints,entry.angle,entry.tilt,aspect);
  entry.fit = {angle:entry.angle,tilt:entry.tilt,aspect,value};
  return value;
}

function frame(t) {
  frameRequest = 0;
  if (document.hidden || !ok) return;
  if (modal) {
    if (dirty && band.height) clearCanvas();
    drawn = 0;
    animateVisible = false;
    dirty = false;
    return;
  }

  const scrollTop = window.scrollY;
  const scrollLeft = window.scrollX;
  const dpr = Math.min(devicePixelRatio || 1,pixelRatioCap);
  const bandChanged = updateBand(scrollTop,scrollLeft,innerHeight,document.documentElement.clientWidth,dpr);
  const dragging = Boolean(drag?.moved);
  const elapsed = t - last;
  const rate = mode === 'cpu' ? (dragging ? 20 : 12)
    : isFirefox ? (dragging ? 30 : 24)
    : (dragging && !usesSoftwareRendering ? 60 : 30);
  const interval = 1000 / rate;
  if (!band.height || !band.width) {
    drawn = 0;
    animateVisible = false;
    dirty = false;
    return;
  }
  const rotating = !paused && !scrolling && !dragging;
  if (!bandChanged && !dirty && (!animateVisible || !rotating)) return;
  if (!bandChanged && elapsed < interval - 1) {
    scheduleFrame();
    return;
  }

  // Drag paints are driven by pointer input. Hold the other models' poses so
  // their projected fits can be reused until automatic rotation resumes.
  const rotation = rotating && rotationTime !== null ? Math.min(t - rotationTime,80) * .00058 : 0;
  rotationTime = rotating ? t : null;
  last = t;
  dirty = false;
  clearCanvas();
  drawn = 0;
  animateVisible = false;
  for (const [id, item] of active) {
    if (!item.near) continue;
    const entry = get(id);
    if (entry.state !== 'ready' || !entry.gpu) continue;

    const rect = item.area.getBoundingClientRect();
    const top = rect.top + scrollTop - band.top;
    const left = rect.left + scrollLeft - band.left;
    if (rect.width < 4 || rect.height < 4 || top + rect.height <= 0 || top >= band.height || left + rect.width <= 0 || left >= band.width) continue;

    const x = Math.round(left * dpr);
    const y = Math.round((band.height - top - rect.height) * dpr);
    const width = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);
    const clipX = Math.max(0,x);
    const clipY = Math.max(0,y);
    const clipWidth = Math.min(canvas.width,x+width) - clipX;
    const clipHeight = Math.min(canvas.height,y+height) - clipY;
    if (clipWidth <= 0 || clipHeight <= 0) continue;

    const onScreen = rect.bottom > 0 && rect.top < innerHeight;
    if (onScreen) {
      animateVisible = true;
      if (drag?.id !== id) entry.angle += rotation;
    }
    const fit = fitForPose(entry,width/height);
    if (mode === 'cpu') {
      drawCachedCPU(entry,{left,top,width:rect.width,height:rect.height},fit);
    } else {
      gl.viewport(x,y,width,height);
      gl.scissor(clipX,clipY,clipWidth,clipHeight);
      gl.bindVertexArray(entry.gpu.vao);
      gl.uniform1f(u.ay,entry.angle);
      gl.uniform1f(u.ax,entry.tilt);
      gl.uniform1f(u.scale,fit.scale);
      gl.uniform1f(u.aspect,width/height);
      gl.uniform2f(u.offset,fit.ox,fit.oy);
      gl.drawElements(gl.TRIANGLES,entry.gpu.count,entry.gpu.type,entry.gpu.offset);
    }
    if (!item.node.classList.contains('atlas-living-ready')) item.node.classList.add('atlas-living-ready');
    drawn++;
  }
  frames++;
  if (animateVisible && rotating) scheduleFrame();
  else rotationTime = null;
}
window.__ATLAS_LIVING__={projectedFit,stats:()=>({ok,mode,requested,loading,failed,drawn,frames,active:active.size,ready:[...entries.values()].filter(e=>e.state==='ready').length,paused,angles:Object.fromEntries([...entries].map(([id,e])=>[id,e.angle]))}),reset:()=>{for(const [id,e] of entries){e.angle=.22+Number(id.slice(-2))*.17;e.tilt=.15}invalidate()}};if(init())sync();
})();
