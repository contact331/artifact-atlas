
/* Artifact Atlas · Turn 2 — private offline frontend.
   Data authority: data/atlas.json (Turn 1); no external JS runtime. */
(() => {
  'use strict';
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
  const esc = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = n => (Number(n)||0).toLocaleString('en-US');
  const colorFallback='#64748b';
  const normalize=v=>String(v||'').toLowerCase().normalize('NFKD');
  const idOrder=x=>+String(x||'').match(/\d+$/)?.[0]||0;
  const MUSEUM_METHODS=[
    {method:'Digital preservation · Fixity',problem:'Historical object versus new interpretation',tag:'PROVENANCE',proof:'2017 source object; metadata + SHA-256 lock'},
    {method:'Configuration Management',problem:'Whole-site changes threatened a known-good build',tag:'BASELINE',proof:'Immutable baseline; module-level ownership'},
    {method:'Change Control · Minimal Patch',problem:'A tiny edit could brick unrelated routes',tag:'DELTA',proof:'Scope-limited, byte-preserving change sets'},
    {method:'Round-trip Regression',problem:'Editorial edits could silently alter HTML structure',tag:'REGRESSION',proof:'Reverse-substitution structural comparison'},
    {method:'Release Gate Management',problem:'Preview success did not prove production readiness',tag:'GATES',proof:'SOURCE → TOPOLOGY → PREVIEW → RUNTIME → PRODUCTION'},
    {method:'Immutable Release / Rollback',problem:'Production promotion needed a recovery path',tag:'RECOVERY',proof:'Recorded release deployment and rollback identity'}
  ];
  const GENERIC_METHOD_PATTERNS=[
    [/source|provenance|identity|authority|version number/i,'Provenance / Configuration Control','SOURCE'],
    [/image|art|visual|typograph|readability|page|layout|crop|folio/i,'Editorial Preflight / Visual Regression','DESIGN'],
    [/research|scientific|novel|citation|paper|hypothe|model|literature/i,'Scientific Method / Prior-art Review','RESEARCH'],
    [/agent|coordina|handoff|parallel|interface|context drift/i,'Interface Contracts / Agent Orchestration','ORCHESTRATE'],
    [/test|verify|qc|scorecard|false positive|quality/i,'Verification & Validation','VERIFY'],
    [/deploy|publication|release|retail|platform|listing|web/i,'Release Management / Evidence Gate','RELEASE'],
    [/compil|schema|render|format|pdf|excel|csv|text/i,'Schema Validation / Document Engineering','COMPILE'],
    [/reconcil|state|matcher|order|duplicate|mint|transaction/i,'Reconciliation / Idempotency','STATE'],
    [/failure|brick|regress|repair|overflow|break|broken/i,'Root Cause Analysis / CAPA','REPAIR'],
    [/assum|sensitivity|uncertainty|calibrat|bound/i,'Sensitivity Analysis / Calibration','MODEL'],
    [/sale|market|conversion|demand|customer/i,'Customer Discovery / Funnel Analytics','MARKET'],
  ];
  function methodLabelFor(s){const item=GENERIC_METHOD_PATTERNS.find(([re])=>re.test(s));return item?{label:item[1],tag:item[2]}:{label:'Documented production method — classification pending',tag:'METHOD'};}
  const PATHS={
    museumMD:'methodology/featured/Marquise_Museum_Flywheel_Methodology.md',
    museumPDF:'methodology/featured/Marquise_Museum_Flywheel_Methodology.pdf',
  };
  const state={view:'artifacts',query:'',domain:'',project:'',quick:'all',sort:'domain',limit:180,selectedKind:'',selectedId:''};
  let db=null,atlas=null,chatPrimary={records:{}},artifactExhibits={items:{}},exhibitEditorial={items:{}},lastList=[],toastTimer=null,activeHover=null,miniPopupTrigger=null;
  let audioGuide=null;
  const EL={
    lattice:$('#lattice'),count:$('#resultsCount'),scope:$('#scopeCaption'),title:$('#collectionTitle'),eyebrow:$('#collectionEyebrow'),explainer:$('#collectionExplainer'),
    query:$('#search'),domain:$('#domainFilter'),project:$('#projectFilter'),sort:$('#sortFilter'),pills:$('#filterPills'),
    inspector:$('#inspector'),content:$('#inspectorContent'),number:$('#inspector-number'),footId:$('#inspector-foot-id'),
    hover:$('#hovercard'),toast:$('#toast'),loadRow:$('#loadRow'),loadMore:$('#loadMore'),loaded:$('#loadedLabel'),
    miniOverlay:$('#mcubeOverlay'),miniContent:$('#mcubeDialogContent'),miniTitle:$('#mcubeTitle'),miniKicker:$('#mcubeKicker')
  };
  const PHASES=['Discover','Define','Develop','Deliver','Learn'];
  function linkSafe(url){try{const u=new URL(String(url));return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}}
  function linkDomain(url){try{const u=new URL(url);return u.hostname.replace(/^www\./,'');}catch{return url||'—';}}
  function initIndexes(data){
    const map=arr=>new Map(arr.map(x=>[x.id,x]));
    const a2e=new Map(),c2e=new Map(),a2p=new Map(),a2r=new Map();
    for(const edge of data.chat_edges){if(!a2e.has(edge.artifact_id))a2e.set(edge.artifact_id,[]);a2e.get(edge.artifact_id).push(edge);if(!c2e.has(edge.chat_id))c2e.set(edge.chat_id,[]);c2e.get(edge.chat_id).push(edge);}
    for(const link of data.publication_links)for(const id of link.artifact_ids||[]){if(!a2p.has(id))a2p.set(id,[]);a2p.get(id).push(link);}
    for(const rel of data.relationships){for(const id of [rel.from_artifact_id,rel.to_artifact_id]){if(!a2r.has(id))a2r.set(id,[]);a2r.get(id).push(rel);}}
    return {artifact:map(data.artifacts),chat:map(data.chats),project:map(data.projects),method:map(data.method_families),edge:map(data.chat_edges),publication:map(data.publication_links),doc:map(data.source_files),a2e,c2e,a2p,a2r};
  }
  function parseHash(){const hash=location.hash.replace(/^#/,'');const params=new URLSearchParams(hash);const v=params.get('view'),a=params.get('a'),c=params.get('c'),p=params.get('p');if(['artifacts','records','chats','projects'].includes(v))state.view=v;if(a&&/^ART-\d{2}$/.test(a)){state.selectedKind='artifact';state.selectedId=a;}else if(c&&/^C\d{4}$/.test(c)){state.selectedKind='chat';state.selectedId=c;}else if(p&&p.startsWith('PROJ-')){state.selectedKind='project';state.selectedId=p;}}
  function updateHash(){try{let hash=new URLSearchParams({view:state.view});if(state.selectedId)hash.set(state.selectedKind==='artifact'?'a':state.selectedKind==='chat'?'c':'p',state.selectedId);history.replaceState(null,'','#'+hash.toString());}catch{}}
  async function fetchAtlas(){
    if(window.__ATLAS_DATA__)return window.__ATLAS_DATA__;
    const embedded=$('#embeddedAtlas');
    if(embedded){return JSON.parse(embedded.textContent);}
    const response=await fetch('data/atlas.json',{cache:'no-store'});
    if(!response.ok)throw new Error(`Atlas data unavailable (HTTP ${response.status})`);
    return response.json();
  }
  async function fetchChatPrimary(){
    // Compact excerpt sidecar, physically separated from the canonical Atlas registry.
    // Standalone edition embeds it; modular build loads the local JSON file.
    const embedded=$('#embeddedChatWindows');
    if(embedded)return JSON.parse(embedded.textContent);
    try{const response=await fetch('data/chat_primary_windows.json',{cache:'no-store'});if(response.ok)return response.json();}
    catch(err){console.warn('Optional chat primary-source windows not available',err);}
    return {records:{}};
  }
  async function fetchArtifactExhibits(){
    const embedded=$('#embeddedArtifactExhibits');
    if(embedded)return JSON.parse(embedded.textContent);
    try{const r=await fetch('data/artifact_exhibits.json',{cache:'no-store'});if(r.ok)return r.json();}
    catch(err){console.warn('Optional provisional artifact exhibits unavailable',err);}
    return {items:{}};
  }
  async function fetchExhibitEditorial(){
    const embedded=$('#embeddedExhibitEditorial');
    if(embedded)return JSON.parse(embedded.textContent);
    try{const r=await fetch('data/artifact_theme_editorial.json',{cache:'no-store'});if(r.ok)return r.json();}
    catch(err){console.warn('Optional editorial exhibit primers unavailable',err);}
    return {items:{}};
  }
  function artifactExhibitFor(id,position){
    const rec=artifactExhibits?.items?.[id];
    // Agent 2 used its own grid slots. The original Atlas positions are
    // authoritative: keep METHOD at NE (2), PUBLIC at SW (5).
    // Themes fill only the four former unapproved side slots N/W/E/S.
    const sourceGridPosition={1:2,3:3,4:4,6:6}[position];
    return rec?.themes?.find(x=>x.grid_position===sourceGridPosition)||null;
  }
  function updateResearchMetrics(){
    const families=new Map();for(const a of atlas.artifacts)families.set(a.methodology.family_id,a.methodology.curation_state||'');
    const deep=[...families.values()].filter(x=>x==='source_selected_38_case_pass').length;
    const researched=[...families.values()].filter(x=>x==='source_researched_v32_e1_e2_no_externally_verified_flywheel').length;
    const provisional=families.size-deep-researched;
    const el=$('#researchMetrics');if(el)el.innerHTML=`<span class="metric-item"><b>${deep}</b> AUDITED</span><span class="metric-item"><b>${researched}</b> SOURCE-RESEARCHED</span><span class="metric-item"><b>${provisional}</b> PROVISIONAL</span><span class="metric-disclaimer">Source density is not an artifact maturity score</span>`;
  }
  function initSelects(){
    const domains=[...new Set([...atlas.artifacts.map(x=>x.identity.display_domain),...atlas.chats.map(x=>x.domain)].filter(Boolean))].sort();
    EL.domain.insertAdjacentHTML('beforeend',domains.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join(''));
    EL.project.insertAdjacentHTML('beforeend',atlas.projects.map(x=>`<option value="${esc(x.id)}">${esc(x.label)}</option>`).join(''));
    EL.query.addEventListener('input',e=>{state.query=e.target.value.trim();state.limit=180;render();});
    EL.domain.addEventListener('change',e=>{state.domain=e.target.value;state.limit=180;render();});
    EL.project.addEventListener('change',e=>{state.project=e.target.value;state.limit=180;render();});
    EL.sort.addEventListener('change',e=>{state.sort=e.target.value;render();});
    $('#resetFilters').addEventListener('click',resetFilters);
    $$('.view-tab').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
    $('#viewNav').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const tabs=$$('.view-tab');let i=tabs.indexOf(document.activeElement);if(i<0)return;e.preventDefault();i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;setView(tabs[i].dataset.view);tabs[i].focus();});
    EL.pills.addEventListener('click',e=>{const b=e.target.closest('button[data-quick]');if(!b)return;state.quick=b.dataset.quick;state.limit=180;render();});
    EL.loadMore.addEventListener('click',()=>{state.limit+=180;render();});
    $('#openInspector').addEventListener('click',()=>setInspector(true));
    $('#closeInspector').addEventListener('click',clearInspectorSelection);
    $('#scrim').addEventListener('click',()=>setInspector(false));
    document.addEventListener('keydown',e=>{
      const tag=document.activeElement?.tagName;
      if(e.key==='Escape'){if(t20DossierOverlay){e.preventDefault();closeT20Dossier();return;}if(privatePdfOverlay){e.preventDefault();closePrivatePdfFull();return;}if(!EL.miniOverlay.hidden){e.preventDefault();closeMiniPopup();return;}hideHover();setInspector(false);if(document.activeElement===EL.query){EL.query.value='';state.query='';render();}return;}
      if(e.key==='Tab'&&privatePdfOverlay){const controls=$$('button,a[href]',privatePdfOverlay);if(controls.length){const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
      if(e.key==='Tab'&&!EL.miniOverlay.hidden){const focusable=$$('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])',EL.miniOverlay).filter(x=>x.getClientRects().length);if(focusable.length){const first=focusable[0],last=focusable[focusable.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}}
      if(EL.query.getClientRects().length&&e.key==='/'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!['INPUT','TEXTAREA','SELECT'].includes(tag)){e.preventDefault();EL.query.focus();EL.query.select();}
    });
    EL.lattice.addEventListener('click',handleCubeClick);
    EL.miniOverlay.addEventListener('click',handleMiniPopupClick);
    EL.lattice.addEventListener('pointerover',e=>{if(e.target.closest('.mcube'))return;const b=e.target.closest('.cube');if(b&&b!==activeHover){activeHover=b;showHover(e,b);}});
    EL.lattice.addEventListener('pointermove',e=>{if(activeHover)positionHover(e);});
    EL.lattice.addEventListener('pointerout',e=>{if(activeHover&&!activeHover.contains(e.relatedTarget)){activeHover=null;hideHover();}});
    EL.lattice.addEventListener('focusin',e=>{let b=e.target.closest('.cube');if(b)showHover(null,b);});
    EL.lattice.addEventListener('focusout',()=>hideHover());
    EL.lattice.addEventListener('keydown',navigateKeyboard);
    EL.content.addEventListener('click',e=>{const view=e.target.closest('[data-t20-open-html]');if(view){e.preventDefault();openT20Dossier(view);return;}const full=e.target.closest('[data-private-pdf-full]');if(full){e.preventDefault();openPrivatePdfFull(full);return;}const b=e.target.closest('[data-private-preview]');if(b){e.preventDefault();openPrivatePreview(b);return;}});
    EL.content.addEventListener('click',e=>{
      const ex=e.target.closest('[data-export-artifact]');if(ex){e.preventDefault();exportSourceGenealogy(ex.dataset.exportArtifact);return;}
      const dl=e.target.closest('[data-download]');if(dl&&$('#embeddedDownloads')){e.preventDefault();downloadEmbedded(dl.dataset.download);return;}
      const btn=e.target.closest('[data-select]');if(!btn)return;
      e.preventDefault();selectRecord(btn.dataset.selectKind,btn.dataset.select,true);
    });
    window.addEventListener('scroll',hideHover,{passive:true});
    window.addEventListener('resize',hideHover,{passive:true});
    window.addEventListener('resize',()=>requestAnimationFrame(layoutDocking),{passive:true});
  }
  function setView(view){if(!['artifacts','records','chats','projects'].includes(view))return;state.view=view;state.quick='all';state.domain='';state.project='';state.limit=180;EL.domain.value='';EL.project.value='';render();updateHash();}
  function resetFilters(){state.query='';state.domain='';state.project='';state.sort='domain';state.quick='all';state.limit=180;EL.query.value='';EL.domain.value='';EL.project.value='';EL.sort.value='domain';render();}
  function viewMeta(){
    return {
      artifacts:['CURATED INDIVIDUAL OUTPUTS','Individual output lattice','Independent-looking output records; not all externally released or commercially verified.', 'Individual outputs (46)'],
      records:['COMPLETE ARTIFACT GENEALOGY','All artifact nodes','Includes releases, variants, research families, supporting records, candidates and streams.', 'All 71 artifact nodes'],
      chats:['SOURCE CONVERSATION CORPUS','Conversation lattice','1,181 archived chats; heuristic classifications. Click a chat to see original export locator and associated artifact edges.', 'Original chats (1,181)'],
      projects:['PROJECT CONTAINERS / NOT PRODUCTS','Project families','23 curated navigation groups. Groups relate independent outputs without collapsing them into one artifact.', 'Project families (23)']
    }[state.view];
  }
  const quickOptions={
    artifacts:[['all','All outputs'],['url','Has publication URL'],['linked','Has linked chats'],['commercial','Commercial-facing'],['research','Papers & research'],['software','Apps & websites']],
    records:[['all','All records'],['individual','Individual outputs'],['candidates','Candidates'],['versions','Versions'],['supporting','Supporting'],['family','Research families']],
    chats:[['all','All chats'],['linked','Linked to artifacts'],['az','Likely A→Z'],['operating','Operating workflows'],['claude','Claude archive']],
    projects:[['all','All projects'],['multi','Multiple nodes'],['url','Has URL-linked nodes'],['chats','Has chat links']]
  };
  function quickPass(item,kind){const q=state.quick;if(q==='all')return true;if(kind==='artifact'){
      if(q==='url')return !!item.finished_product.primary_url?.url||db.a2p.has(item.id);
      if(q==='linked')return (db.a2e.get(item.id)||[]).length>0;
      if(q==='commercial')return /commercial|commerce|retail|sale|storefront|marketing|collection/i.test(item.identity.output_type+' '+item.finished_product.intended_use);
      if(q==='research')return /research|paper|manuscript|scientific|policy|analysis|white paper|quantitative|book/i.test(item.identity.output_type+' '+item.identity.title);
      if(q==='software')return /software|app|website|site|web|bot|interactive|dashboard/i.test(item.identity.output_type+' '+item.identity.title);
      if(q==='individual')return item.identity.normalized_lane==='Individual outputs';
      if(q==='candidates')return item.identity.normalized_lane==='Candidates / incomplete';
      if(q==='versions')return item.identity.normalized_lane==='Versions / compilations';
      if(q==='supporting')return item.identity.normalized_lane==='Supporting / archival';
      if(q==='family')return item.identity.normalized_lane==='Research families / indexes';
    }else if(kind==='chat'){
      if(q==='linked')return db.c2e.has(item.id);
      if(q==='az')return (item.a_to_z_assessment||'').startsWith('Likely');
      if(q==='operating')return (item.flywheel_assessment||'').startsWith('Operating');
      if(q==='claude')return item.source==='Claude';
    }else if(kind==='project'){
      if(q==='multi')return item.artifact_ids.length>1;
      if(q==='url')return item.artifact_ids.some(id=>db.a2p.has(id));
      if(q==='chats')return item.artifact_ids.some(id=>db.a2e.has(id));
    }return false;}
  function textFor(item,kind){if(kind==='chat'){
      const edges=db.c2e.get(item.id)||[];
      return [item.id,item.title,item.source,item.domain,item.subdomain,item.original_project_classification,item.subjects,item.other_subjects,item.purpose,item.locator,...edges.map(e=>{let a=db.artifact.get(e.artifact_id);return [e.artifact_id,a?.identity?.title,a?.identity?.project_name].join(' ');})].join(' ');
    }if(kind==='project')return [item.id,item.label,...item.artifact_ids.map(id=>db.artifact.get(id)?.identity?.title)].join(' ');
    const links=db.a2p.get(item.id)||[],edges=db.a2e.get(item.id)||[];
    return [item.id,item.identity.title,item.identity.symbol,item.identity.project_name,item.identity.display_domain,item.identity.output_type,item.identity.normalized_lane,item.finished_product.short_description,item.finished_product.historical_production_status,item.methodology.family_id,item.methodology.family_name,item.methodology.named_method_ids.join(' '),item.methodology.specialized_technique_ids.join(' '),...links.map(p=>[p.platform,p.listing_name,p.url].join(' ')),...edges.map(e=>[e.chat_id,e.original_source_title].join(' '))].join(' ');
  }
  function domainFor(item,kind){if(kind==='chat')return item.domain;if(kind==='project')return db.artifact.get(item.artifact_ids[0])?.identity.display_domain||'Other / Unclear';return item.identity.display_domain;}
  function colorFor(item,kind){if(kind==='chat')return item.domain_color||colorFallback;if(kind==='project')return db.artifact.get(item.artifact_ids[0])?.identity.color_hex||colorFallback;return item.identity.color_hex||colorFallback;}
  function projectIdFor(item,kind){if(kind==='chat'){const edges=db.c2e.get(item.id)||[];return edges.length?db.artifact.get(edges[0].artifact_id)?.identity.project_id||'':null;}if(kind==='project')return item.id;return item.identity.project_id;}
  function projectForSort(item,kind){if(kind==='chat'){const edges=db.c2e.get(item.id)||[];return db.artifact.get(edges[0]?.artifact_id)?.identity.project_name||item.original_project_classification||'General';}if(kind==='project')return item.label;return item.identity.project_name;}
  function dateForSort(item,kind){if(kind==='chat')return item.last_date||'';if(kind==='project')return '';let e=db.a2e.get(item.id)||[];return e.map(e=>db.chat.get(e.chat_id)?.last_date||'').sort().at(-1)||'';}
  function srcCount(item,kind){if(kind==='chat')return(db.c2e.get(item.id)||[]).length;if(kind==='project')return item.artifact_ids.reduce((sum,id)=>sum+(db.a2e.get(id)||[]).length,0);return(db.a2e.get(item.id)||[]).length;}
  function filterSource(){let kind=state.view==='chats'?'chat':state.view==='projects'?'project':'artifact';let items=state.view==='chats'?atlas.chats:state.view==='projects'?atlas.projects:state.view==='artifacts'?atlas.artifacts.filter(x=>x.identity.normalized_lane==='Individual outputs'):atlas.artifacts;
    const terms=normalize(state.query).split(/\s+/).filter(Boolean);
    items=items.filter(x=>{
      if(state.domain&&domainFor(x,kind)!==state.domain)return false;
      if(state.project&&projectIdFor(x,kind)!==state.project)return false;
      if(!quickPass(x,kind))return false;
      if(terms.length){const hay=normalize(textFor(x,kind));if(!terms.every(t=>hay.includes(t)))return false;}
      return true;
    });
    const tie=(a,b)=>idOrder(a.id)-idOrder(b.id);
    items.sort((a,b)=>{
      if(state.sort==='id')return tie(a,b);
      if(state.sort==='title')return (a.identity?.title||a.title||a.label).localeCompare(b.identity?.title||b.title||b.label)||tie(a,b);
      if(state.sort==='recent')return dateForSort(b,kind).localeCompare(dateForSort(a,kind))||tie(a,b);
      if(state.sort==='source')return srcCount(b,kind)-srcCount(a,kind)||tie(a,b);
      if(state.sort==='project')return projectForSort(a,kind).localeCompare(projectForSort(b,kind))||tie(a,b);
      return domainFor(a,kind).localeCompare(domainFor(b,kind))||(a.identity?.title||a.title||a.label).localeCompare(b.identity?.title||b.title||b.label)||tie(a,b);
    });
    return {items,kind};
  }
  function abbr(title){const words=String(title||'').match(/[\p{L}\p{N}]+/gu)||[];const meaningful=words.filter(x=>!['the','a','and','of','for','to','with','in','on','from','by','at'].includes(x.toLowerCase()));if(!meaningful.length)return 'CH';if(meaningful.length===1)return meaningful[0].slice(0,3).toUpperCase();return meaningful.slice(0,3).map(w=>w[0].toUpperCase()).join('');}
  function projectCode(label){const words=String(label||'').match(/[\p{L}\p{N}]+/gu)||[];return words.slice(0,3).map(w=>w[0].toUpperCase()).join('')||'PRJ';}
  function cubeName(item,kind){if(kind==='chat')return item.title;if(kind==='project')return item.label;return item.identity.title;}
  function shortCubeName(item,kind){if(kind==='chat')return item.title;if(kind==='project')return item.label;
    let title=item.identity.title.replace(/^Marquise Museum — /,'').replace(/^AESYR WŌDANAZ — /,'').replace(/^The Age of Transition — /,'').replace(/ — /g,' · ');
    if(item.id==='ART-11')return 'Museum Archive';if(item.id==='ART-22')return 'FTM Book';if(item.id==='ART-70')return 'eMuseum';
    return title;
  }
  // 2D square-lattice shell: each record occupies the center of exactly eight
  // stable satellite positions. Nulls are decorative blanks, never fictitious data.
  // Positions: NW, N, NE, W, E, SW, S, SE.
  const MICRO_GRID_POSITIONS=['northwest','north','northeast','west','east','southwest','south','southeast'];
  const MINI_TABS={
    artifact:{titles:['Finished product','A→Z production method','Artifact family & relationships','Source chat genealogy','Publication footprint','Evidence, versions & limits'],slots:[null,0,2,0,0,5,0,null]},
    chat:{titles:['SPARK','IMPACT','RABBIT HOLE','RAW'],slots:[null,1,null,4,2,null,3,null]},
    project:{titles:['Included artifact records','Interpretation'],slots:[null,null,null,1,2,null,null,null]}
  };
  function cubeHtml(item,kind){const id=item.id,color=colorFor(item,kind),title=shortCubeName(item,kind);
    const sym=kind==='chat'?abbr(item.title):kind==='project'?projectCode(item.label):item.identity.symbol;
    const pos=kind==='project'?String(item.artifact_ids.length)+' OUTPUTS':kind==='chat'?String((db.c2e.get(id)||[]).length)+' LINKS':String((db.a2e.get(id)||[]).length)+' CHATS';
    const label=kind==='chat'?'SOURCE':kind==='project'?'PROJECT':item.identity.source_level.replace(/_/g,' ');
    const selected=state.selectedKind===kind&&state.selectedId===id;
    const main=`<button type="button" class="cube cube--${kind}${kind==='artifact'&&/candidate|incomplete/i.test(item.identity.normalized_lane)?' cube--candidate':''}${selected?' selected':''}" style="--face:${esc(color)}" data-kind="${kind}" data-record="${esc(id)}" aria-label="${esc(id)} ${esc(cubeName(item,kind))}${kind==='chat'?', source chat':''}" aria-pressed="${selected?'true':'false'}" title="${esc(cubeName(item,kind))}"><span class="cube-top"><span>${esc(kind==='project'?id.replace('PROJ-','P·'):id)}</span><span>${esc(label)}</span></span><span class="cube-center"><span class="cube-symbol">${esc(sym)}</span></span><span class="cube-bottom"><span class="cube-name">${esc(title)}</span><span class="cube-footer">${esc(pos)}</span></span><span class="cube-status"><span style="--level:${kind==='artifact'?Math.min(100,Math.max(16,(srcCount(item,kind)||0)*8))+'%':kind==='project'?'80%':'38%'}"></span></span></button>`;
    const map=MINI_TABS[kind];
    const satellites=map.slots.map((index,slot)=>{
      const style=`style="--mini-position:${slot}"`;
      const location=MICRO_GRID_POSITIONS[slot];
      if(kind==='artifact'&&slot===0&&index===null&&window.initAtlasAudio) {
        return `<button type="button" class="mcube mcube--active mcube--audio" ${style} data-atlas-audio="${esc(id)}" data-audio-state="idle" aria-label="Play ${esc(cubeName(item,kind))}"><span class="mcube-audio-icon" aria-hidden="true"></span><span class="mcube-label">Audio</span></button>`;
      }
      if(index===null)return `<span class="mcube mcube--blank" ${style} aria-hidden="true"></span>`;
      if(kind==='artifact'&&index===0){
        const exhibit=artifactExhibitFor(id,slot);
        if(!exhibit)return `<span class="mcube mcube--blank" ${style} aria-hidden="true"></span>`;
        const tone=exhibit.popup?.real_world_context||'';
        return `<button type="button" class="mcube mcube--active mcube--exhibit" ${style} data-mini-kind="artifact" data-mini-record="${esc(id)}" data-mini-exhibit-position="${slot}" title="${esc(exhibit.label)}" aria-label="${esc(id)}: explore ${esc(exhibit.label)} (${location})"><span class="mcube-index" aria-hidden="true">◇</span><span class="mcube-label">${esc(exhibit.label)}</span></button>`;
      }
      const title=map.titles[index-1];
      const labels={artifact:['PRODUCT','METHOD','FAMILY','SOURCES','PUBLIC','EVIDENCE'],chat:['SPARK','IMPACT','RABBIT','RAW'],project:['RECORDS','NOTES']};
      return `<button type="button" class="mcube mcube--active" ${style} data-mini-kind="${kind}" data-mini-record="${esc(id)}" data-mini-section="${index}" title="${esc(title)}" aria-label="${esc(id)}: open ${esc(title)} popup (${location})"><span class="mcube-index">${String(index).padStart(2,'0')}</span><span class="mcube-label">${esc(labels[kind][index-1])}</span></button>`;
    }).join('');
    return `<div class="cube-cluster" role="group" aria-label="${esc(id)} and eight satellite positions" style="--cluster-face:${esc(color)}">${main}${satellites}<span class="dock-rail dock-rail--right" aria-hidden="true"></span><span class="dock-rail dock-rail--down" aria-hidden="true"></span></div>`;
  }
  function render(){if(!atlas)return;lastList=filterSource().items;const {items,kind}=filterSource();const v=viewMeta();EL.title.textContent=v[1];EL.explainer.textContent=v[2];EL.scope.textContent=v[3];EL.eyebrow.innerHTML=esc(v[0])+' <span>/</span> '+esc(state.sort==='domain'?'DOMAIN GROUPS':state.sort.toUpperCase());EL.count.textContent=`${fmt(items.length)} ${kind==='chat'?'chats':kind==='project'?'projects':'records'} shown`;
    $$('.view-tab').forEach(b=>{let active=b.dataset.view===state.view;b.classList.toggle('active',active);b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});
    EL.pills.replaceChildren();
    if(items.length===0){EL.lattice.innerHTML=`<div class="empty-result"><h3>No matches in this view</h3><p>Try a different domain, project or source phrase.</p><button type="button" id="emptyReset">Clear filters</button></div>`;$('#emptyReset').addEventListener('click',resetFilters);EL.loadRow.hidden=true;$('#collection').setAttribute('aria-busy','false');return;}
    const shown=items.slice(0,state.limit);
    const isGrouped=['domain','project'].includes(state.sort);
    if(isGrouped){const groups=new Map();for(const a of shown){const key=state.sort==='domain'?domainFor(a,kind):projectForSort(a,kind);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a);}
      EL.lattice.innerHTML=[...groups].sort((a,b)=>b[1].length-a[1].length||a[0].localeCompare(b[0])).map(([name,list],i)=>{const color=colorFor(list[0],kind);return `<section class="domain-section" aria-label="${esc(name)}"><div class="domain-title"><div class="domain-name"><span class="domain-swatch" style="--domain-color:${esc(color)}"></span>${esc(name)}</div><div class="domain-count">${fmt(list.length)} / ${kind==='chat'?'CHATS':'CUBES'}</div></div><div class="cube-grid" role="group" aria-label="${esc(name)} tiles">${list.map(x=>cubeHtml(x,kind)).join('')}</div></section>`;}).join('');
    }else{EL.lattice.innerHTML=`<div class="cube-grid" role="group" aria-label="${esc(v[1])}">${shown.map(x=>cubeHtml(x,kind)).join('')}</div>`;}
    EL.loadRow.hidden=shown.length===items.length;EL.loaded.textContent=`${fmt(shown.length)} of ${fmt(items.length)} rendered`;$('#collection').setAttribute('aria-busy','false');
    audioGuide?.sync(EL.lattice);
    requestAnimationFrame(layoutDocking);
  }
  function layoutDocking(){
    // Geometry-based ports connect only actual adjacent clusters inside the same visual group.
    // No inferred artifact genealogy: these are navigation lattice links, not evidence edges.
    $$('.cube-grid').forEach(grid=>{
      const nodes=$$('.cube-cluster',grid),boxes=nodes.map(node=>node.getBoundingClientRect());
      nodes.forEach((node,i)=>{
        const a=boxes[i],micro=parseFloat(getComputedStyle(node).getPropertyValue('--micro-size'))||64;
        let right=null,down=null;
        boxes.forEach((b,j)=>{if(i===j)return;
          if(Math.abs(b.top-a.top)<8&&b.left>=a.right-3&&(!right||b.left<right.left))right=b;
          if(Math.abs(b.left-a.left)<8&&b.top>=a.bottom-3&&(!down||b.top<down.top))down=b;
        });
        const rgap=right?right.left-a.right:null;
        const dgap=down?down.top-a.bottom:null;
        const okR=rgap!==null&&rgap>=-3&&rgap<110;
        const okD=dgap!==null&&dgap>=-3&&dgap<110;
        node.dataset.dockRight=String(okR);node.dataset.dockDown=String(okD);
        node.style.setProperty('--dock-right-span',okR?`${rgap+micro}px`:'0px');
        node.style.setProperty('--dock-down-span',okD?`${dgap+micro}px`:'0px');
      });
    });
  }
  function handleCubeClick(e){
    const exhibit=e.target.closest('button.mcube[data-mini-exhibit-position]');
    if(exhibit){openArtifactExhibit(exhibit);return;}
    const mini=e.target.closest('button.mcube[data-mini-section]');
    if(mini){openMiniPopup(mini);return;}
    const b=e.target.closest('button.cube[data-record]');if(!b)return;selectRecord(b.dataset.kind,b.dataset.record,true);
  }
  // Chat mini-cubes: visitor-readable exploratory surfaces, not renames of old
  // inspector contents. Verified fields are shown with explicit provenance labels;
  // absent first-message / narrative extraction remains an honest placeholder.
  function renderChatMiniExperience(c,index){
    const links=db.c2e.get(c.id)||[];
    const primary=chatPrimary?.records?.[c.id]||null;
    const intro=(kicker,title,sub)=>`<div class="chat-mini-hero"><span class="chat-mini-kicker">${esc(kicker)}</span><h3>${esc(title)}</h3><p>${esc(sub)}</p></div>`;
    const panel=(title,body,note='')=>`<section class="chat-mini-panel"><h4>${esc(title)}</h4>${body}${note?`<p class="chat-mini-note">${esc(note)}</p>`:''}</section>`;
    const value=(x,missing='Not recorded')=>String(x||'').trim()?esc(x):`<em class="chat-mini-missing">${esc(missing)}</em>`;
    const sourceInfo=`<div class="chat-mini-source"><span>ARCHIVE RECORD</span><strong>${esc(c.id)}</strong><small>${esc(c.first_date||'Date not recorded')} · ${esc(c.source||'Source unclassified')}</small></div>`;
    const splitPipe=x=>String(x||'').split('|').map(s=>s.trim()).filter(Boolean);
    const splitGeneric=x=>String(x||'').split(/\s*[|•;,]\s*/).map(s=>s.trim()).filter(Boolean);
    const unique=(arr)=>[...new Set(arr.filter(Boolean))];
    const label=(name)=>`<div class="chat-primary-label">${esc(name)}</div>`;
    const provenance=primary?`Source checked: ${primary.source_archive}. Message positions refer to the exported active conversation.`:'Primary conversation messages were not recoverable from the available exports for this record.';
    const quote=(item,role)=>item?.text?`${label(`${role} · MSG ${String(item.message_index).padStart(2,'0')}`)}<div class="chat-primary-window">${esc(item.text)}</div>`:'';
    const metaCard=(name,val)=>`<div class="chat-mini-topic chat-mini-stat"><span>${esc(name)}</span><strong>${value(val)}</strong></div>`;
    const topicChips=(arr)=>arr.length?`<div class="chat-mini-chipwrap">${arr.map(x=>`<span class="chat-mini-chip">${esc(x)}</span>`).join('')}</div>`:'<p class="chat-mini-note">No indexed topics beyond this record.</p>';
    const linkedArtifacts=[...new Map(links.map(e=>[e.artifact_id,e])).values()].filter(e=>db.artifact.has(e.artifact_id));
    const linkedProjects=unique(linkedArtifacts.map(e=>db.artifact.get(e.artifact_id)?.identity?.project_name).filter(Boolean));
    const branchSeeds=unique([c.title,...splitGeneric(c.subjects),...splitPipe(c.other_subjects),c.domain,c.subdomain,c.original_project_classification,...linkedProjects.slice(0,4)]).slice(0,14);
    if(index===1){
      const first=primary?.first_user;
      const reply=primary?.first_assistant;
      const sourceWindow=first?.text?quote(first,'FIRST USER MESSAGE')+ (reply?.text?`<div class="chat-primary-response">${quote(reply,'FIRST ASSISTANT REPLY')}</div>`:''):
          (String(c.source_excerpt||c.source_summary_excerpt||'').trim()?`<div class="chat-excerpt chat-mini-raw">${esc(c.source_excerpt||c.source_summary_excerpt)}</div>`:'<div class="chat-mini-placeholder"><span class="chat-mini-placeholder-icon">✦</span><div><strong>Original opening unavailable</strong><small>This record has classification metadata but no matching source message in the supplied exports.</small></div></div>');
      return intro('01 / THE BEGINNING','The spark','The question that opened the exchange, grounded in the source export when available.')+
        `<div class="chat-mini-topic-grid">${metaCard('FIRST SEEN',c.first_date||'—')}${metaCard('MESSAGES',c.message_count||'—')}${metaCard('SOURCE',c.source||'—')}${metaCard('CONFIDENCE',c.classification_confidence||'—')}</div>`+
        panel('Conversation subject',`<p class="chat-mini-main">${value(c.title)}</p><p>${value(c.purpose,'Purpose unclassified')}</p>`, 'Title and purpose are Atlas catalogue metadata; they are not quotations of the opening message.')+
        panel(first?'Original opening exchange':'Preserved source window',sourceWindow,first?provenance:'Indexed excerpt shown as context; it may not be the opening exchange.')+
        panel('Context lane',topicChips([c.original_project_classification,c.artifact_use,c.artifact_status].filter(Boolean)),'Provisional archive classifications, not proof of completed deliverables.')+sourceInfo;
    }
    if(index===2){
      const items=linkedArtifacts.slice(0,14).map(e=>{const a=db.artifact.get(e.artifact_id);return `<button type="button" class="catalogue-link chat-mini-link" data-select-kind="artifact" data-select="${esc(a.id)}"><span class="cl-left"><strong>${esc(a.identity.title)}</strong><small>${esc(e.source_stage||'Link stage unknown')} · ${esc(e.source_strength||'Strength ungraded')}</small></span><span class="cl-id">${esc(a.id)} ↗</span></button>`;}).join('');
      const last=primary?.last_assistant||primary?.last_user;
      return intro('02 / CONNECTIONS','The impact','What the index associates with this exchange—and the last preserved reply, not an inferred success claim.')+
        `<div class="chat-mini-topic-grid">${metaCard('LINKED ARTIFACTS',linkedArtifacts.length)}${metaCard('PROJECTS',linkedProjects.length)}${metaCard('ARTIFACT USE',c.artifact_use||'—')}${metaCard('OUTPUT STATUS',c.artifact_status||'—')}</div>`+
        (linkedProjects.length?panel('Project lanes',topicChips(linkedProjects.slice(0,10)),'Project identities from recorded Atlas artifact links.'):'')+
        panel(`${linkedArtifacts.length} linked artifact${linkedArtifacts.length===1?'':'s'}`,items||'<div class="chat-mini-placeholder"><span class="chat-mini-placeholder-icon">◇</span><div><strong>No indexed artifact connections</strong><small>Absence of a link is not evidence the conversation produced nothing.</small></div></div>','Links indicate source relevance; they do not automatically establish causal contribution.')+
        (last?panel('Last visible response',quote(last,primary?.last_assistant?'ASSISTANT RESPONSE':'USER MESSAGE'),'This is the last preserved message of that role in the export, not proof that a task was completed.'):'')+sourceInfo;
    }
    if(index===3){
      const followups=unique(splitPipe(c.other_subjects)).slice(0,10);
      const relatedArtifacts=linkedArtifacts.slice(0,6).map(e=>db.artifact.get(e.artifact_id)?.identity?.title).filter(Boolean);
      const trail=(primary?.later_user_samples||[]).map((e,i)=>`<div class="chat-primary-trail-row"><span class="chat-primary-turn">TURN ${String(e.message_index).padStart(2,'0')}</span><p>${esc(e.text)}</p></div>`).join('');
      return intro('03 / EXPLORATION','The rabbit hole','Follow the subjects and actual later questions found in the archive, without inventing causal branches.')+
        `<div class="chat-mini-topic-grid">${metaCard('DOMAIN',c.domain||'—')}${metaCard('SUBDOMAIN',c.subdomain||'—')}${metaCard('PROJECT LANE',c.original_project_classification||'—')}${metaCard('SIDE THREADS',followups.length)}</div>`+
        panel('Indexed subjects',topicChips(branchSeeds),'These are Atlas index fields; they are not a reconstructed sequence of decisions.')+
        panel('Follow-on directions',followups.length?topicChips(followups):'<p class="chat-mini-note">No separate side-subject inventory is recorded for this conversation.</p>','Additional subject labels from the archived classification.')+
        (trail?panel('Questions along the route',`<div class="chat-primary-trail">${trail}</div>`, 'Selected user-message samples in original message order, not a comprehensive transcript or a causal map.'):'')+
        (relatedArtifacts.length?panel('Artifacts it may have touched',topicChips(relatedArtifacts),'Artifact titles from current Atlas chat-edge associations.'): '')+sourceInfo;
    }
    if(index===4){
      const excerpt=String(c.source_excerpt||c.source_summary_excerpt||'').trim();
      const windows=primary?[primary.first_user,primary.last_user,primary.last_assistant].filter(Boolean).filter((e,i,a)=>a.findIndex(v=>v.message_index===e.message_index)===i).slice(0,3):[];
      const textWindows=windows.map((e,i)=>`<div class="chat-primary-trail-row">${quote(e,i===0?'FIRST USER MESSAGE':(i===windows.length-1&&e===primary?.last_assistant)?'LAST ASSISTANT RESPONSE':'LATER USER MESSAGE')}</div>`).join('');
      return intro('04 / PRIMARY WINDOW','The raw exchange','Direct source windows and original export locator; the full conversation is not embedded in this popup.')+
        `<div class="chat-mini-topic-grid">${metaCard('FIRST DATE',c.first_date||'—')}${metaCard('LAST DATE',c.last_date||'—')}${metaCard('MESSAGES',c.message_count||'—')}${metaCard('LOCATOR',c.locator?'PRESENT':'MISSING')}</div>`+
        panel('Archive excerpt',excerpt?`<div class="chat-excerpt chat-mini-raw">${esc(excerpt)}</div>`:'<p class="chat-mini-note">No catalogue excerpt available.</p>','Existing Atlas excerpt; may be truncated or drawn from a later segment of the exchange.')+
        (textWindows?panel('Primary-source windows',`<div class="chat-primary-trail">${textWindows}</div>`,provenance):'')+
        panel('Original archive locator',`<div class="chat-mini-locator">${value(c.locator,'Locator unavailable')}</div><p class="chat-mini-note">Original UUID: ${value(c.conversation_id,'Unavailable')}</p>`)+sourceInfo;
    }
    return '<p class="section-note">Unknown chat panel.</p>';
  }


  // Agent-2 artifact themes are a provisional, explicitly separate sidecar.
  // User-authoritative GPT-6 2D layout / docking / inspector, content layer only.
  // T14 editorial primers: general educational context, not claims about Atlas artifacts.
  // These explain high-interest subjects; source-grounded artifact claims remain in Agent 2 sidecar.

  const EXHIBIT_GENERIC_LEAD=/^Explore\s+.+?:\s+the familiar idea behind this artifact/i;
  const quality=(s)=>String(s||'').trim();
  function exhibitReadableProvenance(p,theme){
    const e=quality(p.evidence_status||theme.status||'');
    return /CATALOG_GROUNDED|PROVISIONAL/i.test(e)?'Catalogue-grounded · primary-work check pending':'Editorial context · verification pending';
  }
  const ATLAS_PRIVATE_PREVIEWS={"ART-26":{"title":"MARQUISE_TOKEN_CLUSTERS_PROSPECTUS_20260911-0118_v0.4.pdf","display":"Marquise Museum Token Clusters · v0.4 public discussion draft","path":"private_previews/ART-26.pdf","mime":"application/pdf","size_bytes":9013615,"pages":46,"sha256":"d79ffc482cb84eb6eee64730d80a72f6e24a260c229a9668e99627aabdf3ba56","visibility":"OFFLINE_COPY_PUBLIC_DISCUSSION_DRAFT_DRIVE_ACCESS_NOT_VERIFIED","source_url":"https://drive.google.com/file/d/1xm-srSA7Vs-cjvVcK4NJwg9xuDAdK2sC/view","supersedes_local":"private_previews/history/ART-26_v0.2_20260911.pdf","publication_status_from_pdf":"Public Discussion Draft","publication_date_from_pdf":"2026-09-11"},"ART-35":{"title":"Age_of_Transition_France_95PLUS_EN.pdf","display":"Private English policy PDF","path":"private_previews/ART-35.pdf","mime":"application/pdf","size_bytes":851808,"pages":12,"sha256":"f8e814daf86da22938d29adc054ebadbfd6bfe040c351a71a64363eed412149a","visibility":"PRIVATE_ASSET_NO_PUBLICATION_VERIFICATION"},"ART-38":{"title":"Lineage_Research_Volume_I.pdf","display":"Archive PDF; public status unverified","path":"private_previews/ART-38.pdf","mime":"application/pdf","size_bytes":211299,"pages":62,"sha256":"ca20652bc3152ccc50d72903add56891435f7ee6512b9ee80ff7caf15b7af585","visibility":"PRIVATE_ASSET_NO_PUBLICATION_VERIFICATION"},"ART-43":{"title":"Civic_Sovereignty_V2.2_Role_Transition_Register.pdf","display":"Unpublished field-doctrine paper","path":"private_previews/ART-43.pdf","mime":"application/pdf","size_bytes":500157,"pages":64,"sha256":"a314f7a43d0912275230e8cfa8d6be72421ec83503e58c449998d9eca02bcba3","visibility":"PRIVATE_ASSET_NO_PUBLICATION_VERIFICATION"},"ART-44":{"title":"DIABLO_META_STRUCTURE_WHITE_PAPER_v1-2.pdf","display":"Private white-paper candidate","path":"private_previews/ART-44.pdf","mime":"application/pdf","size_bytes":301865,"pages":13,"sha256":"1b65aca002720b3f94b1d7e84397c2c4a72adec64335c4fce36a2ad884d98e54","visibility":"PRIVATE_ASSET_NO_PUBLICATION_VERIFICATION"},"ART-46":{"title":"Applied_Record_001_Adversariality_Causal_Weight_and_Distribution_v0.1.pdf","display":"Private research record","path":"private_previews/ART-46.pdf","mime":"application/pdf","size_bytes":173061,"pages":7,"sha256":"590961afeda0cb138737a74c604bf04f650126310af82f0cd4182be300e1047d","visibility":"PRIVATE_ASSET_NO_PUBLICATION_VERIFICATION"}};
  const ATLAS_THEME_ICON_ASSIGNMENTS={"AI Agents":"robot","AI Dependence":"chip","AI Governance":"chip","AI Influencers":"code","AI Power":"chip","AI Revolution":"chip","AI Takeover":"chip","AI Understanding":"brain","AI-Enhanced Imagery":"film","Alien Civilizations":"planet","Alien Intelligence":"planet","Alien Life":"planet","Alien Threats":"planet","Ancestry":"dna","Ancient Greece":"tree","Art Authentication":"fingerprint","Art Authenticity":"fingerprint","Art Collecting":"museum","Art Fraud":"fingerprint","Art History":"museum","Art Ownership":"fingerprint","Art Prices":"spark","Artificial Life":"chip","Augmented Intelligence":"spark","Augmented Reality":"vr","Automation":"robot","Blockchain History":"tree","Brain Implants":"code","Cause & Effect":"wave","Character Builds":"gamepad","Civil Liberties":"shield","Civilizations":"planet","Cognitive Biases":"brain","Collecting":"museum","Collective Intelligence":"users","Consciousness":"brain","Consent":"scales","Constitutional Rights":"shield","Cosmic Risks":"orbit","Cost of Living":"coins","Crypto Art":"spark","Crypto Assets":"spark","Cryptocurrency":"coins","Decentralized Finance":"spark","Democracy":"scales","Digital Art":"museum","Digital Art History":"museum","Digital Books":"book","Digital Collectibles":"network","Digital Identity":"fingerprint","Digital Investments":"coins","Digital Libraries":"network","Digital Museums":"museum","Digital Ownership":"fingerprint","Digital Portraits":"network","Digital Societies":"users","Digital Twins":"cube","Dyson Spheres":"planet","Early Crypto Art":"spark","Early NFTs":"coins","Economic Abundance":"chart","Economic Forecasts":"chart","Economic Growth":"chart","Economic Inequality":"scales","Emergence":"chip","Emergent Reality":"wave","Enhanced Perception":"vr","Ethereum":"coins","Evolution":"dna","Family History":"dna","Family Trees":"dna","Fantasy Worlds":"planet","Fashion":"museum","Fermi Paradox":"telescope","France's Economy":"coins","France’s Economy":"coins","Free Will":"spark","Future Forecasts":"chart","Future Society":"users","Future of Civilization":"planet","Future of Experience":"vr","Future of Humanity":"users","Future of Work":"users","Future of the Mind":"brain","Galactic Civilizations":"planet","Galactic Networks":"planet","Game Balance":"gamepad","Game Theory":"gamepad","Geopolitics":"scales","Global Economy":"coins","Global Power":"globe","Government Spending":"spark","Hidden Patterns":"spark","Historical Archives":"museum","Historical Legends":"map","Historical Mysteries":"spark","History of NFTs":"coins","How Evidence Works":"beaker","How Markets Work":"coins","Human Autonomy":"spark","Human Behavior":"users","Human Control":"shield","Human Freedom":"shield","Human Rights":"shield","Human vs AI":"brain","Independent Publishing":"book","Institutional Power":"users","Institutional Resilience":"shield","Intelligence Tests":"brain","Interactive Museums":"museum","Internet Archaeology":"network","Internet Collecting":"museum","Internet Culture":"network","Internet History":"tree","Knowledge Graphs":"lightbulb","Knowledge Maps":"lightbulb","Language & Reality":"book","Life in the Universe":"planet","Longevity":"clock","Lost Ancestors":"crown","Lost Documents":"scroll","Magical Realms":"spark","Mass Automation":"robot","Meaning & Machines":"lightbulb","Medieval Europe":"crown","Myth & Folklore":"tree","Mythical Worlds":"planet","NFT Origins":"coins","NFTs":"coins","Networked Minds":"brain","Norse Mythology":"tree","Odin":"crown","Online Art Markets":"coins","Online Libraries":"network","Personal Identity":"fingerprint","Philosophy of Mind":"brain","Planetary Defense":"planet","Political Power":"scales","Post-Work Society":"users","Power & Control":"chart","Predicting the Future":"clock","Rise of AI":"chip","Robot Economy":"robot","Robot Revolution":"robot","Robots vs Jobs":"robot","Rogue AI":"chip","Role-Playing Games":"gamepad","Royal Bloodlines":"crown","Royal Lineages":"crown","SETI":"telescope","Science & Art":"beaker","Science vs Speculation":"beaker","Scientific Method":"beaker","Search for Aliens":"planet","Simulation Theory":"cube","Smart Cities":"globe","Smart Contracts":"code","Social Media Algorithms":"network","Space Exploration":"rocket","Storytelling":"book","Superintelligence":"brain","Technological Singularity":"orbit","The Future of Reading":"book","Tokenized Art":"coins","Tokenized Assets":"coins","Trading Bots":"spark","Trustworthy Research":"beaker","Uncertainty":"beaker","Universal Basic Income":"coins","Universal Language":"book","Urban AI":"code","Viking History":"sword","Virtual Economies":"spark","Virtual Reality":"vr","Virtual Vaults":"spark","Virtual Worlds":"planet","Wealth Inequality":"scales","Welfare State":"scales","What Makes Art Valuable?":"spark","World Economies":"planet","World Order":"planet"};
  let privatePreviewBlobUrl=null,privatePdfOverlay=null,privatePdfReturnFocus=null;
  function atlasSvg(name,cls=''){
    return `<svg class="atlas-subject-svg ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="#atlas-svg-${esc(name)}"></use></svg>`;
  }
  function themeIconFor(title){return ATLAS_THEME_ICON_ASSIGNMENTS[title]||'spark';}
  // v17 reconciliation: canonically distinct catalogue IDs can share one original file.
  const ATLAS_V17 = (window.ATLAS_V17_PUBLIC || {});
  const ATLAS_V17_RECORDS = ATLAS_V17.records || {};
  const ATLAS_V17_PACKAGES = ATLAS_V17.packages || {};
  const ATLAS_T19_RECORDS = (window.ATLAS_T19_PUBLIC || {}).records || {};
  const ATLAS_T20_RECORDS = (window.ATLAS_T20_PUBLIC || {}).records || {};
  let t20DossierOverlay=null;
  let t20DossierReturnFocus=null;
  for(const [assetId,entry] of Object.entries((window.ATLAS_V17_PREVIEWS||{}))){ATLAS_PRIVATE_PREVIEWS[assetId]=entry;}
  function renderT19Public(id){
    const rec=ATLAS_T19_RECORDS[id];if(!rec)return '';
    if(rec.mode==='edition_url_replacement'){
      const url=linkSafe(rec.public_url);
      return `<div class="atlas-v17-public atlas-t19-public" data-t19-record="${esc(id)}"><div class="atlas-v17-heading"><strong>CURRENT EDITION</strong><span>OWNER-SUPPLIED · 23 NOV 2026</span></div><a class="atlas-v17-external" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span>${atlasSvg('book')}<strong>${esc(rec.label)}</strong><small>Amazon · ASIN B0HDRN7SF3</small></span><b aria-hidden="true">↗</b></a><p class="atlas-v17-caution">${esc(rec.note)}</p></div>`;
    }
    if(rec.mode==='retired_public_destination'){
      const current=db.artifact.get(rec.current_artifact_id);
      return `<div class="atlas-v17-public atlas-t19-public atlas-t19-legacy" data-t19-record="${esc(id)}"><div class="atlas-v17-heading"><strong>HISTORICAL / SUPERSEDED NODE</strong><span>PUBLIC LINKS RETIRED</span></div><p class="atlas-t19-heading">This archival entry is retained. The current public-facing destination is <strong>ART-07</strong>.</p><button class="atlas-t19-current" type="button" data-select-kind="artifact" data-select="ART-07"><span>${atlasSvg('book')}<strong>See current artifact · ART-07</strong><small>${esc(current?.identity?.title||'Autumn Equinox Declaration')}</small></span><b>↗</b></button><p class="atlas-v17-caution">${esc(rec.note)}</p></div>`;
    }
    return '';
  }
  // T20: supplementary surfaces without changing the authoritative T16/T19 public routing.
  // Sensitive personal assessment content remains private, unlinked externally and on-demand only.
  function renderT20Public(id){
    const rec=ATLAS_T20_RECORDS[id];if(!rec)return '';
    if(id==='ART-08'){
      const links=(rec.links||[]).map(l=>{const safe=linkSafe(l.url);return safe?`<a class="atlas-v17-external atlas-t20-social" href="${esc(safe)}" target="_blank" rel="noopener noreferrer"><span>${atlasSvg('link')}<strong>${esc(l.name)}</strong><small>${esc(l.status)}</small></span><b aria-hidden="true">↗</b></a>`:'';}).join('');
      return `<div class="atlas-v17-public atlas-t20-public" data-t20-record="ART-08"><div class="atlas-v17-heading"><strong>IMAGINED LIFE · SOCIAL CHANNELS</strong><span>RELATED CAMPAIGN / NOT NFT LISTING</span></div>${links}<p class="atlas-v17-disclaimer">These channels were originally assigned to ART-12, the social-content catalogue. ART-08 now references them as the promotion/discovery surfaces of the same project. OpenSea remains the NFT collection destination.</p></div>`;
    }
    if(id==='ART-14'){
      return `<div class="atlas-v17-public atlas-t20-public atlas-t20-private" data-t20-record="ART-14"><div class="atlas-v17-heading"><strong>RELATED PRIVATE BENCHMARK RESULT</strong><span>PERSONAL · OFFLINE ONLY</span></div><p class="atlas-t20-heading">Dossier 2 · Behavioural and psychological profile (Bench v1.4)</p><p class="atlas-v17-caution">${esc(rec.description)}</p><button type="button" class="atlas-v17-package atlas-t20-openhtml" data-t20-open-html="${esc(rec.source_package_id)}"><span>${atlasSvg('book')} <strong>View Dossier 2 in the offline edition</strong><small>Sandboxed, owner-only interactive viewer · 173 KiB</small></span><b aria-hidden="true">↗</b></button><button type="button" class="atlas-t19-current atlas-t20-crosslink" data-select-kind="artifact" data-select="ART-54"><span>${atlasSvg('link')}<strong>View benchmark record · ART-54</strong><small>Distinct output identity, linked from the ART-14 harness</small></span><b>↗</b></button><p class="atlas-v17-disclaimer">The file is embedded only in the private offline Atlas build. It is not a public document, is not uploaded to GitHub, and no result claims are independently validated.</p></div>`;
    }
    return '';
  }
  function closeT20Dossier(restoreFocus=true){
    if(!t20DossierOverlay)return;
    const trigger=t20DossierReturnFocus;
    t20DossierOverlay.remove();t20DossierOverlay=null;t20DossierReturnFocus=null;
    document.body.classList.remove('atlas-t20-html-open');
    if(restoreFocus&&trigger?.isConnected)trigger.focus();
  }
  function openT20Dossier(button){
    const rec=ATLAS_T20_RECORDS['ART-14'];
    const key=button.dataset.t20OpenHtml;
    if(!rec||key!==rec.source_package_id){notify('Restricted dossier not configured');return;}
    const source=$('#embeddedV17Packages')?.textContent;
    if(!source){notify('Open the private offline T23 edition to view this restricted dossier');return;}
    const encoded=JSON.parse(source)[key];
    if(!encoded){notify('Private dossier payload missing');return;}
    closeT20Dossier(false);
    let original;
    try {const bytes=Uint8Array.from(atob(encoded),ch=>ch.charCodeAt(0));original=new TextDecoder('utf-8').decode(bytes);}catch(err){notify('Unable to decode private dossier');return;}
    const wrap=document.createElement('div');wrap.className='atlas-t20-html-overlay';wrap.id='atlasT20DossierOverlay';
    wrap.innerHTML=`<section class="atlas-t20-html-reader" role="dialog" aria-modal="true" aria-labelledby="atlasT20HTMLTitle"><header class="atlas-t20-html-bar"><div><span class="atlas-t20-html-kicker">OWNER-ONLY · PRIVATE BENCHMARK</span><h2 id="atlasT20HTMLTitle">Dossier 2 · Bench v1.4</h2><small>Linked from ART-14 · primary record ART-54 · not for publication</small></div><button type="button" class="atlas-t20-html-close" aria-label="Close the private HTML dossier">${atlasSvg('x')} Close</button></header><iframe sandbox="allow-scripts" referrerpolicy="no-referrer" title="Private Dossier 2 interactive HTML"></iframe></section>`;
    wrap.addEventListener('click',ev=>{if(ev.target===wrap||ev.target.closest('.atlas-t20-html-close'))closeT20Dossier();});
    document.body.append(wrap);t20DossierOverlay=wrap;t20DossierReturnFocus=button;
    document.body.classList.add('atlas-t20-html-open');
    wrap.querySelector('iframe').srcdoc=original;
    wrap.querySelector('.atlas-t20-html-close').focus();
  }

  function renderV17Public(id){
    const record=ATLAS_V17_RECORDS[id];if(!record)return '';
    const caution=(s)=>`<p class="atlas-v17-caution">${esc(s)}</p>`;
    const related=(record.related||[]).map(r=>`<div class="atlas-v17-family"><div>${esc(r.explanation)}</div><div class="atlas-v17-related">${r.ids.map(other=>`<button type="button" class="atlas-v17-relative" data-select-kind="artifact" data-select="${esc(other)}">${esc(other)} ↗</button>`).join('')}</div></div>`).join('');
    const links=(record.links||[]).map(l=>{const u=linkSafe(l.url);return u?`<a class="atlas-v17-external" href="${esc(u)}" target="_blank" rel="noopener noreferrer"><span>${atlasSvg('link')}<strong>${esc(l.title)}</strong><small>${esc(l.status)}</small></span><b aria-hidden="true">↗</b></a>`:'';}).join('');
    const notes=(record.notes||[]).map(x=>caution(x)).join('');
    const docs=(record.docs||[]).map(key=>renderPrivatePreviewCard(key)).join('');
    const packs=(record.packages||[]).map(key=>{const p=ATLAS_V17_PACKAGES[key];if(!p)return '';const restricted=p.visibility==='RESTRICTED_PERSONAL_PRIVATE_ONLY';return `<button type="button" class="atlas-v17-package${restricted?' atlas-v17-restricted':''}" data-v17-download="${esc(key)}"><span>${atlasSvg('download')} <strong>${esc(p.title)}</strong><small>${restricted?'RESTRICTED PERSONAL FILE — PRIVATE OFFLINE ONLY':`${(p.size_bytes/1048576).toFixed(2)} MiB · private archive download`}</small></span><b>↓</b></button>`;}).join('');
    return `<div class="atlas-v17-public" data-v17-record="${esc(id)}"><div class="atlas-v17-heading"><strong>RECONCILED LINKS &amp; ORIGINAL FILES</strong><span>PRIVATE BUILD · SOURCE-MATCHED</span></div>${links}${notes}${related}${packs}${docs}<p class="atlas-v17-disclaimer">The presence of a private file does not prove journal acceptance, external publication or public distribution. Parent-family and individual-paper records share the same original file when matching checksums establish identity.</p></div>`;
  }
  function downloadV17Asset(key){
    const p=ATLAS_V17_PACKAGES[key];if(!p)return;
    const payload=$('#embeddedV17Packages')?.textContent;
    if(payload){
      const files=JSON.parse(payload),encoded=files[key];if(!encoded){notify('Package payload missing');return;}
      const binary=atob(encoded),b=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)b[i]=binary.charCodeAt(i);
      const url=URL.createObjectURL(new Blob([b],{type:p.mime||'application/octet-stream'}));
      const a=document.createElement('a');a.href=url;a.download=p.name||'atlas-archive.zip';a.style.display='none';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }else{
      const a=document.createElement('a');a.href=p.path;a.download=p.name||'atlas-archive.zip';a.style.display='none';document.body.append(a);a.click();a.remove();
    }
  }

  function renderPrivatePreviewCard(id){
    const p=ATLAS_PRIVATE_PREVIEWS[id];if(!p)return '';
    const isArt26=id==='ART-26';
    const originalLink=isArt26?`<a class="atlas-art26-original" href="https://drive.google.com/file/d/1xm-srSA7Vs-cjvVcK4NJwg9xuDAdK2sC/view" target="_blank" rel="noopener noreferrer">Open original v0.4 on Google Drive ↗</a>`:'';
    const status=isArt26?'Public Discussion Draft (document page 3). This offline PDF replaces the older v0.2 placeholder; Google Drive access permissions are not independently verified.':'This file is included only in the private build. Its presence does not establish publication, completion, or rights clearance.';
    return `<section class="atlas-private-asset"><div class="atlas-private-asset-heading">${atlasSvg('book')}<div><strong>PRIVATE DOCUMENT PREVIEW</strong><small>${isArt26?'v0.4 · Original linked on Drive':'Stored offline, not a public URL'}</small></div></div><p>${esc(p.display)} · ${p.pages} pages · ${(p.size_bytes/1048576).toFixed(2)} MiB</p>${isArt26?'<p class="atlas-art26-version">Corrected source · 11 September 2026 · v0.4</p>':''}<button type="button" class="atlas-private-view" data-private-preview="${esc(id)}">${atlasSvg('eye')} View PDF inside Atlas</button>${originalLink}<div class="atlas-private-preview-slot" data-private-preview-slot="${esc(id)}"></div><p class="tiny-note">${esc(status)}</p></section>`;
  }
  // Keep the approved compact page-one preview; render the full document only
  // in its own viewport-constrained dialog, never within the scrollable mCube.
  function closePrivatePdfFull(restoreFocus=true){
    if(!privatePdfOverlay)return;
    const trigger=privatePdfReturnFocus;
    privatePdfOverlay.remove();
    privatePdfOverlay=null;
    privatePdfReturnFocus=null;
    document.body.classList.remove('atlas-pdf-full-open');
    if(restoreFocus&&trigger?.isConnected)trigger.focus();
  }
  function clearPrivatePreview(){
    closePrivatePdfFull(false);
    if(privatePreviewBlobUrl){URL.revokeObjectURL(privatePreviewBlobUrl);privatePreviewBlobUrl=null;}
  }
  function openPrivatePdfFull(button){
    const id=button.dataset.privatePdfFull,p=ATLAS_PRIVATE_PREVIEWS[id];if(!p)return;
    closePrivatePdfFull(false);
    privatePdfReturnFocus=button;
    const src=privatePreviewBlobUrl||p.path;
    const overlay=document.createElement('div');
    overlay.className='atlas-full-pdf-overlay';
    overlay.id='atlasFullPdfOverlay';
    overlay.setAttribute('role','presentation');
    overlay.innerHTML=`<section class="atlas-full-pdf-dialog" role="dialog" aria-modal="true" aria-labelledby="atlasFullPdfTitle">
      <header class="atlas-full-pdf-header">
        <div class="atlas-full-pdf-heading">
          <span class="atlas-full-pdf-kicker">PRIVATE READER · ${esc(id)} · ${p.pages} PAGES</span>
          <h2 id="atlasFullPdfTitle">${esc(p.display)}</h2>
          <small>${esc(p.title)} · Stored locally · Not a public release</small>
        </div>
        <div class="atlas-full-pdf-actions">
          <a class="atlas-full-pdf-external" href="${esc(src)}" target="_blank" rel="noopener noreferrer" title="View private PDF in a separate browser tab">Separate tab ↗</a>
          <button type="button" class="atlas-full-pdf-close" aria-label="Close full PDF and return to mini-cube">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18"/></svg>
            <span>Close</span>
          </button>
        </div>
      </header>
      <iframe class="atlas-full-pdf-frame" title="Full PDF: ${esc(p.title)}" referrerpolicy="no-referrer" loading="eager"></iframe>
    </section>`;
    overlay.addEventListener('click',e=>{
      if(e.target===overlay||e.target.closest('.atlas-full-pdf-close'))closePrivatePdfFull();
    });
    document.body.append(overlay);
    privatePdfOverlay=overlay;
    document.body.classList.add('atlas-pdf-full-open');
    overlay.querySelector('.atlas-full-pdf-frame').src=src+'#page=1';
    overlay.querySelector('.atlas-full-pdf-close').focus();
  }
  function openPrivatePreview(button){
    const id=button.dataset.privatePreview,p=ATLAS_PRIVATE_PREVIEWS[id];if(!p)return;
    const container=button.closest('.atlas-private-asset');const slot=container?.querySelector('[data-private-preview-slot]');if(!slot)return;
    const isOpen=!!slot.querySelector('.atlas-private-cover');
    if(isOpen){slot.replaceChildren();clearPrivatePreview();button.innerHTML=atlasSvg('eye')+' View PDF inside Atlas';return;}
    clearPrivatePreview();
    const embedded=$('#embeddedPrivatePreviewDocs');
    if(embedded){
      const docs=JSON.parse(embedded.textContent);const payload=docs[id];
      if(!payload){slot.textContent='Document not embedded in this edition.';return;}
      const binary=atob(payload),bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      privatePreviewBlobUrl=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
    }
    const image=document.createElement('img');
    image.className='atlas-private-cover';
    image.alt=`First page of ${p.title}`;
    const thumbNode=$('#embeddedPrivatePreviewThumbs');
    if(thumbNode){const thumbs=JSON.parse(thumbNode.textContent);image.src=thumbs[id]?'data:image/png;base64,'+thumbs[id]:p.thumbnail;}
    else image.src=p.thumbnail||`private_previews/${id}_cover.png`;
    const full=document.createElement('button');
    full.type='button';
    full.className='atlas-private-pdf-launch';
    full.dataset.privatePdfFull=id;
    full.textContent=`Read full ${p.pages}-page PDF · Expand viewer`;
    slot.replaceChildren(image,full);
    button.innerHTML=atlasSvg('eye')+' Close PDF preview';
  }
  function handleExhibitNav(button){
    const which=button.dataset.exhibitJump;
    const target=EL.miniContent.querySelector(`[data-exhibit-panel="${which}"]`);
    if(!target)return;target.scrollIntoView({block:'start',behavior:'smooth'});
    button.closest('.atlas-exhibit-nav')?.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  }
  function openArtifactExhibit(button){
    const id=button.dataset.miniRecord;
    const pos=Number(button.dataset.miniExhibitPosition);
    const theme=artifactExhibitFor(id,pos);
    const artifact=db.artifact.get(id);
    if(!theme||!artifact)return;
    miniPopupTrigger=button;
    selectRecord('artifact',id,false); // canonical sidebar stays authoritative
    const p=theme.popup||{};
    const title=theme.label;
    const note=exhibitEditorial?.items?.[title];
    const educational=note?[note.context,note.question]:null;
    const generic=EXHIBIT_GENERIC_LEAD.test(quality(p.lead));
    const question=educational?.[1] || (!generic&&/\?/.test(quality(p.lead))?p.lead:'');
    const opening=!generic&&quality(p.lead)?p.lead:quality(p.real_world_context)||title;
    const panel=(eyebrow,heading,text,cls='')=>`<section class="atlas-exhibit-panel ${cls}"><div class="atlas-exhibit-panel-top">${eyebrow}</div><h3>${heading}</h3><p>${esc(text)}</p></section>`;
    const topic=quality(p.real_world_context);
    const bridge=quality(p.artifact_bridge);
    const connection=quality(p.catalogue_context_and_limits);
    const product=quality(artifact.finished_product?.short_description||artifact.finished_product?.intended_use);
    const type=quality(artifact.identity?.output_type||'Artifact record');
    const description=bridge&&connection&&bridge===connection?bridge:[bridge,connection].filter(Boolean).join(' ');
    // No repeated 'Explore connected artifacts' list. Cross-artifact navigation lives in the established sidebar.
    const topicIcon=themeIconFor(title);
    const nav=(target,name,label)=>`<button type="button" class="atlas-exhibit-nav-button" data-exhibit-jump="${target}" aria-label="Jump to ${label}" aria-pressed="false">${atlasSvg(name)}<span>${label}</span></button>`;
    EL.miniContent.innerHTML=`<div class="atlas-exhibit-body atlas-exhibit-body--deep">
      <div class="atlas-exhibit-lede" data-exhibit-panel="idea"><button type="button" class="atlas-theme-icon-button" data-exhibit-jump="idea" title="${esc(title)} · return to overview" aria-label="${esc(title)}: return to overview">${atlasSvg(topicIcon)}</button><div><span class="atlas-exhibit-brow">THE REAL-WORLD IDEA · ${esc(title.toUpperCase())}</span><p>${esc(opening)}</p></div></div>
      <nav class="atlas-exhibit-nav" aria-label="Explore exhibit sections">${nav('idea',topicIcon,'Idea')}${nav('context','book','Context')}${nav('question','lightbulb','Question')}${nav('artifact','cube','In this work')}${nav('evidence','shield','Evidence')}</nav>
      <div data-exhibit-panel="context">
      ${generic?'':topic&&topic!==opening?panel('SUBJECT PRIMER','The idea in context',topic,'atlas-exhibit-panel--topic'):''}
      ${educational?panel('EDITORIAL BACKGROUND','Why this subject is interesting',educational[0],'atlas-exhibit-panel--editorial'):''}
      </div>
      ${question&&question!==opening?`<section class="atlas-exhibit-question" data-exhibit-panel="question"><span>THE BIG QUESTION</span><strong>${esc(question)}</strong></section>`:`<div data-exhibit-panel="question" hidden></div>`}
      <section data-exhibit-panel="artifact" class="atlas-exhibit-panel atlas-exhibit-panel--bridge"><div class="atlas-exhibit-panel-top">IN THIS ARTIFACT</div><h3>Where the idea meets the work</h3>
        <p class="atlas-exhibit-bridge-primary">${esc(bridge||'The precise connection requires primary-artifact review.')}</p>
        ${connection&&connection!==bridge?`<p class="atlas-exhibit-bridge-context">${esc(connection)}</p>`:''}
        ${product?`<div class="atlas-exhibit-object"><span>THE RECORDED OUTPUT</span><strong>${esc(type)}</strong><p>${esc(product)}</p></div>`:''}
      </section>
      <div class="atlas-exhibit-caution" data-exhibit-panel="evidence"><strong>${esc(exhibitReadableProvenance(p,theme))}</strong><p>${esc(p.content_caution||'This educational theme is not independent verification of the artifact.')}</p><span>General primers are editorial background, not statements of what the artifact proves. Related artifact navigation remains in the sidebar.</span></div>
    </div>`;
    EL.miniTitle.textContent=title;
    EL.miniKicker.textContent=`${id} · SUBJECT ${String(pos).padStart(2,'0')}`;
    $('#mcubeDeckNote').textContent=artifact.identity.title;
    $('#mcubeSidebar').textContent='Open artifact in sidebar';
    EL.miniOverlay.dataset.miniKind='exhibit';
    EL.miniOverlay.dataset.miniSection=String(pos);
    EL.miniOverlay.style.setProperty('--mc-accent',artifact.identity.color_hex||'#b194f2');
    EL.miniOverlay.hidden=false;
    document.body.classList.add('mcube-modal-open');hideHover();
    $('#mcubeClose').focus();
  }
  function openMiniPopup(button){
    const {miniKind:kind,miniRecord:id,miniSection:raw}=button.dataset;
    const index=Number(raw),configuration=MINI_TABS[kind];
    if(!configuration||!Number.isInteger(index)||index<1||index>configuration.titles.length)return;
    miniPopupTrigger=button;
    $('#mcubeSidebar').textContent='Open in sidebar';
    EL.miniOverlay.style.removeProperty('--mc-accent');
    selectRecord(kind,id,false); // Sidebar remains canonical and is kept in sync.
    const original=$$('.inspector-section',EL.content)[index-1];
    if(!original){notify('Inspector section unavailable');return;}
    const clone=original.cloneNode(true);clone.open=true;
    // Four source-chat experiences replace the four old satellite panels.
    // The original sidebar details remain intact for forensic/source access.
    if(kind==='chat'){
      const record=db.chat.get(id);
      const body=$('.inspector-section-body',clone);
      if(record&&body)body.innerHTML=renderChatMiniExperience(record,index);
    }
    // The sidebar and popup can coexist; duplicate document IDs are forbidden.
    const refs=new Map();
    $$('[id]',clone).forEach((node,i)=>{const previous=node.id;const renamed=`mcube-dialog-${i}-${previous}`;refs.set(previous,renamed);node.id=renamed;});
    $$('[aria-labelledby],[aria-describedby],[for]',clone).forEach(node=>{
      for(const attr of ['aria-labelledby','aria-describedby','for'])if(node.hasAttribute(attr)){
        const value=node.getAttribute(attr).split(/\s+/).map(tok=>refs.get(tok)||tok).join(' ');
        node.setAttribute(attr,value);
      }
    });
    EL.miniContent.replaceChildren(clone);
    EL.miniTitle.textContent=configuration.titles[index-1];
    EL.miniKicker.textContent=`${id} · ${String(index).padStart(2,'0')} / ${String(configuration.titles.length).padStart(2,'0')}`;
    // Present the same existing content with a section-specific color and a concise orientation line.
    const miniHints={
      artifact:[
        'The completed work, intended purpose and recorded destination.',
        'Production route, decisions and evidence-graded breakthroughs.',
        'Related artifacts and the family they belong to.',
        'Conversation sources associated with this record.',
        'Recorded public destinations and their verification limits.',
        'Evidence, editions and what remains unverified.'
      ],
      chat:[
        'What opened this conversation? Follow the original question when recovered.',
        'Which artifacts does this exchange connect to? Recorded links, not proof of causality.',
        'How far did the ideas branch? Explore the indexed subjects and open questions.',
        'Look directly at the preserved excerpt and source locator.'
      ],
      project:[
        'Explore the artifact records grouped under this project.',
        'What this project group represents—and what it does not.'
      ]
    };
    EL.miniOverlay.dataset.miniKind=kind;
    EL.miniOverlay.dataset.miniSection=String(index);
    $('#mcubeDeckNote').textContent=miniHints[kind]?.[index-1]||'Explore the connected record.';
    EL.miniOverlay.hidden=false;
    document.body.classList.add('mcube-modal-open');hideHover();
    $('#mcubeClose').focus();
  }
  function closeMiniPopup(restoreFocus=true){
    closeT20Dossier(false);
    if(EL.miniOverlay.hidden)return;
    clearPrivatePreview();
    EL.miniOverlay.hidden=true;document.body.classList.remove('mcube-modal-open');
    EL.miniContent.replaceChildren();
    EL.miniOverlay.style.removeProperty('--mc-accent');
    if(restoreFocus&&miniPopupTrigger?.isConnected)miniPopupTrigger.focus();
    miniPopupTrigger=null;
  }
  function handleMiniPopupClick(e){
    const t20html=e.target.closest('[data-t20-open-html]');if(t20html){e.preventDefault();openT20Dossier(t20html);return;}
    const fullPdf=e.target.closest('[data-private-pdf-full]');if(fullPdf){e.preventDefault();openPrivatePdfFull(fullPdf);return;}
    const v17dl=e.target.closest('[data-v17-download]');if(v17dl){e.preventDefault();downloadV17Asset(v17dl.dataset.v17Download);return;}
    const privateDoc=e.target.closest('[data-private-preview]');if(privateDoc){e.preventDefault();openPrivatePreview(privateDoc);return;}
    const navButton=e.target.closest('[data-exhibit-jump]');if(navButton){e.preventDefault();handleExhibitNav(navButton);return;}
    if(e.target===EL.miniOverlay||e.target.closest('#mcubeClose')){closeMiniPopup();return;}
    if(e.target.closest('#mcubeSidebar')){
      const isExhibit=miniPopupTrigger?.hasAttribute('data-mini-exhibit-position');
      const index=isExhibit?1:(Number(miniPopupTrigger?.dataset.miniSection)||1);
      closeMiniPopup(false);
      const section=$$('.inspector-section',EL.content)[index-1];
      if(section){section.open=true;section.scrollIntoView({block:'nearest',behavior:'auto'});}
      if(window.innerWidth<=820)setInspector(true);
      return;
    }
    const ex=e.target.closest('[data-export-artifact]');
    if(ex){e.preventDefault();exportSourceGenealogy(ex.dataset.exportArtifact);return;}
    const dl=e.target.closest('[data-download]');
    if(dl&&$('#embeddedDownloads')){e.preventDefault();downloadEmbedded(dl.dataset.download);return;}
    const btn=e.target.closest('[data-select]');
    if(btn){e.preventDefault();closeMiniPopup(false);selectRecord(btn.dataset.selectKind,btn.dataset.select,true);}
  }

  function setInspector(show){EL.inspector.classList.toggle('open',show);$('#scrim').classList.toggle('active',show);document.body.classList.toggle('inspector-open',show);}
  function selectRecord(kind,id,shouldOpen){
    clearPrivatePreview();if(!['artifact','chat','project'].includes(kind))return;const record=db[kind].get(id);if(!record)return;state.selectedKind=kind;state.selectedId=id;
    $$('.cube.selected').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false');});
    $$(`.cube[data-kind="${kind}"][data-record="${id}"]`).forEach(x=>{x.classList.add('selected');x.setAttribute('aria-pressed','true');});
    renderInspector();updateHash();hideHover();if(shouldOpen&&window.innerWidth<=820)setInspector(true);
  }
  function eventSelect(kind,id){selectRecord(kind,id,true);}
  function selectedRecord(){return db?.[state.selectedKind]?.get(state.selectedId);}
  function clearInspectorSelection(){const previous=$('.cube.selected');clearPrivatePreview();state.selectedKind='';state.selectedId='';$$('.cube.selected').forEach(x=>{x.classList.remove('selected');x.setAttribute('aria-pressed','false');});renderInspector();updateHash();hideHover();setInspector(false);if(previous?.isConnected)previous.focus({preventScroll:true});else if(window.innerWidth>820)$('#quickpadSocket')?.focus({preventScroll:true});else $('#openInspector')?.focus({preventScroll:true});}
  function renderInspector(){const record=selectedRecord();EL.inspector.classList.toggle('inspector-idle',!record);if(!record){EL.content.replaceChildren();EL.number.textContent='/ —';EL.footId.textContent='';return;}
    EL.number.textContent='/ '+(state.selectedKind==='artifact'?state.selectedId.replace('ART-',''):state.selectedId);
    EL.footId.textContent=record.id;
    if(state.selectedKind==='artifact')EL.content.innerHTML=renderArtifactInspector(record);
    else if(state.selectedKind==='chat')EL.content.innerHTML=renderChatInspector(record);
    else EL.content.innerHTML=renderProjectInspector(record);
    EL.content.scrollTop=0;
  }
  function tag(t,type=''){return `<span class="inspector-tag ${type?'inspector-tag--'+type:''}">${esc(t)}</span>`;}
  function section(n,title,body,open=false){return `<details class="inspector-section" ${open?'open':''}><summary class="section-header"><span class="summary-index">${String(n).padStart(2,'0')}</span>${esc(title)}<span class="section-icon">+</span></summary><div class="inspector-section-body">${body}</div></details>`;}
  function downloadEmbedded(path){
    try{
      const assets=window.__ATLAS_DOWNLOAD_ASSETS__||(window.__ATLAS_DOWNLOAD_ASSETS__=JSON.parse($('#embeddedDownloads').textContent));
      const entry=assets[path];if(!entry)throw new Error('Dossier missing from standalone bundle');
      const bytes=Uint8Array.from(atob(entry.payload),c=>c.charCodeAt(0));
      const blob=new Blob([bytes],{type:entry.mime});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=path.split('/').at(-1);a.style.display='none';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
    }catch(err){console.error(err);notify('Download unavailable in this edition');}
  }
  // Source export is a transparent reference table, not a claimed authorship certificate.
  function exportSourceGenealogy(artifactId){
    const artifact=db.artifact.get(artifactId);if(!artifact)return;
    const edges=db.a2e.get(artifactId)||[];
    const header=['artifact_id','artifact_title','chat_id','conversation_uuid','chat_title','source_platform','export_locator','production_stage','source_strength','attribution_limit'];
    const safeCell=value=>{let x=String(value??'');if(/^[\s]*[=+@-]/.test(x))x="'"+x;return '"'+x.replace(/"/g,'""')+'"';};
    const lines=[header,...edges.map(edge=>{const c=db.chat.get(edge.chat_id);return [artifactId,artifact.identity.title,edge.chat_id,c?.conversation_id||'',c?.title||edge.original_source_title||'',c?.source||'',c?.locator||edge.original_segment||'',edge.source_stage||'',edge.source_strength||'','Contextual relation; not verified causal authorship'];})].map(row=>row.map(safeCell).join(','));
    const payload='\ufeff'+lines.join('\r\n')+'\r\n';
    const url=URL.createObjectURL(new Blob([payload],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=artifactId+'_source_genealogy.csv';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);
    notify('Source genealogy exported · '+edges.length+' stage links');
  }
  function notify(message){EL.toast.textContent=message;EL.toast.classList.add('visible');if(toastTimer)clearTimeout(toastTimer);toastTimer=setTimeout(()=>EL.toast.classList.remove('visible'),2800);}
  function downloadLinks(a){
    const m=a.methodology;
    const md=m.v31_md || String(m.legacy_md||'').replace('methodology/legacy-md/','methodology/atlas-dossiers/md/');
    const pdf=m.v31_pdf || String(m.legacy_pdf||'').replace('methodology/legacy-pdf/','methodology/atlas-dossiers/pdf/');
    const path=p=>String(p||'').startsWith('methodology/v3.1/')||String(p||'').startsWith('methodology/v3.2/')||String(p||'').startsWith('methodology/atlas-dossiers/')?p:'';
    return `<div class="inspector-actions"><a href="${esc(path(md))}" data-download="${esc(path(md))}" class="method-download" download>↓ FULL MD</a><a href="${esc(path(pdf))}" data-download="${esc(path(pdf))}" class="method-download" download>↓ FULL PDF</a></div>`;
  }
  function publicationNote(a){const snap=a.evidence.current_publication_snapshot;if(snap){if(snap.summary_state==='current_public_destination_observed')return tag('Public URL observed · Nov 22','good');if(snap.summary_state==='earlier_edition_only')return tag('Earlier edition only','caution');return tag('Live URL not confirmed','caution');}const e=a.evidence;return e.publication_state==='title_specific_page_previously_web_checked'?tag('Previously web-checked','good'):tag('Publication unverified','caution');}
  function statusTag(a){let s=a.finished_product.historical_production_status||'';if(/not verified|unverified|candidate|incomplete|draft|unconfirmed/i.test(s))return tag('Verification pending','caution');return tag('Output documented','good');}
  function summaryNode(index,method,problem,tag,proof,isCandidate){
    return `<li class="fw-node"><span class="fw-node-track"><span class="fw-orb"><span class="fw-orb-core"></span></span></span><div class="fw-node-card"><div class="fw-node-metadata"><span>${String(index+1).padStart(2,'0')}</span><span class="fw-node-phase">${esc(tag)}</span></div><strong class="fw-node-method">${esc(method)}</strong><p>${esc(problem)}</p>${proof?`<small>${esc(proof)}</small>`:''}${isCandidate?'<span class="fw-node-candidate">Method match · provisional</span>':''}</div></li>`;
  }
  function renderFlywheelRoute(a){
    // Route is a compact process overview, not a list of individual breakthroughs.
    // Museum stages are documented in the release handover; other records use an explicitly generic scaffold.
    const museum=['ART-11','ART-24','ART-71'].includes(a.id);
    const stages=a.methodology.curated_route || (museum?['Anchor','Scope','Patch','Verify','Release','Reuse']:['Discover','Define','Develop','Deliver','Learn']);
    const cells=stages.map((label,i)=>`<span class="fw-route-stop"><span class="fw-route-dot">${String(i+1).padStart(2,'0')}</span><b>${esc(label)}</b></span>${i<stages.length-1?'<span class="fw-route-arrow" aria-hidden="true">➜</span>':''}`).join('');
    const caption=a.methodology.curated_route ? 'Document-grounded A→Z route. Historical test and release caveats are detailed in the complete methodology.' : (museum?'Provenance is locked; small changes are verified against a known-good release, and each accepted release becomes the next baseline.':'Common production lifecycle shown as a navigation scaffold. Artifact-specific stage evidence remains provisional.');
    return `<section class="fw-route-card" aria-labelledby="fw-route-title">
      <div class="fw-block-kicker"><span>01 / A→Z</span><span>PRODUCTION ROUTE</span></div>
      <div class="fw-route-head"><h3 id="fw-route-title" class="fw-route-heading">FLY<span>WHEEL</span><small> / SUMMARY</small></h3><span class="fw-route-loop" aria-hidden="true">↻</span></div>
      <div class="fw-route-steps" role="list" aria-label="Production flywheel summary">${cells}</div>
      <p class="fw-route-caption">${esc(caption)}</p>
      <div class="fw-route-loopnote"><span aria-hidden="true">↩</span> <span>Feedback → retained rule → next production cycle</span></div>
    </section>`;
  }
  function renderBreakthroughCandidates(a){
    const museum=['ART-11','ART-24','ART-71'].includes(a.id);
    const raw=a.methodology.significant_breakthrough_candidates||[];
    const curated=a.methodology.curated_breakthroughs || [];
    const methods=curated.length ? curated.map(x=>({method:x.method,problem:x.problem,tag:String(x.phase||x.tag||'METHOD').toUpperCase(),proof:(x.case_id?'Source-audited case '+x.case_id+' · ':'Source memo · ')+(x.evidence_grade||x.grade||'evidence-limited'),candidate:(x.evidence_grade||x.grade)==='E1'})) : (museum?MUSEUM_METHODS.map(x=>({...x,candidate:false})):raw.slice(0,5).map(x=>{const term=methodLabelFor(x);return {method:term.label,problem:x,tag:term.tag,proof:'',candidate:true};}));
    const nodes=methods.length?methods.map((x,i)=>summaryNode(i,x.method,x.problem,x.tag,x.proof,x.candidate)).join(''):`<p class="section-note">No ranked candidate breakthroughs yet. The full dossier retains the available evidence and its limitations.</p>`;
    return `<section class="fw-breakthrough-card" aria-labelledby="fw-breakthrough-title">
      <div class="fw-block-kicker"><span>02 / BREAKTHROUGHS</span><span>${methods.length} NODES</span></div>
      <h3 id="fw-breakthrough-title" class="fw-breakthrough-heading">BREAKTHROUGH <span>CANDIDATES</span></h3>
      <p class="fw-breakthrough-subtitle">Decisive problem → named method → evidence status</p>
      <ol class="fw-node-string" aria-label="Selected breakthrough candidates">${nodes}</ol>
      <div class="fw-terminal"><span class="fw-terminal-sigil">◆</span><div><strong>Output reached</strong><small>${esc((a.finished_product.short_description||'Output recorded').length>142?(a.finished_product.short_description||'Output recorded').slice(0,142)+'…':(a.finished_product.short_description||'Output recorded'))}</small></div></div>
      <p class="fw-fineprint">This rail selects consequential operations; it does not represent every production step. Full methods, sources and caveats belong to the MD/PDF dossier.</p>
    </section>`;
  }
  function displayArtifactStage(a){return `<div class="fw-two-blocks">${renderFlywheelRoute(a)}${renderBreakthroughCandidates(a)}</div>`;}
  function relatedFor(a){const all=db.a2r.get(a.id)||[],group=[];for(const r of all){const counterpart=r.from_artifact_id===a.id?r.to_artifact_id:r.from_artifact_id;const other=db.artifact.get(counterpart);if(other)group.push({other,rel:r,where:r.from_artifact_id===a.id?'from':'to'});}
    const seen=new Set();return group.filter(x=>{if(seen.has(x.other.id))return false;seen.add(x.other.id);return true;});
  }
  function artifactCardLink(other,label){return `<button class="catalogue-link" data-select-kind="artifact" data-select="${esc(other.id)}"><span class="cl-left"><strong>${esc(other.identity.title)}</strong><small>${esc(label||other.identity.output_type)}</small></span><span class="cl-id">${esc(other.id)} ↗</span></button>`;}
  function renderArtifactInspector(a){const id=a.id,ident=a.identity,f=a.finished_product,m=a.methodology,source=(db.a2e.get(id)||[]),pubs=(db.a2p.get(id)||[]),rel=relatedFor(a),candidates=source.filter(e=>e.source_strength==='direct/high relevance'),context=source.filter(e=>e.source_strength!=='direct/high relevance');
    const t19=ATLAS_T19_RECORDS[id];
    const url=linkSafe(t19?.public_url||(!t19?f.primary_url?.url:null));
    const pubLink=t19?.mode==='retired_public_destination'?`<div class="atlas-t19-mini-context"><strong>PUBLIC ROUTE SUPERSEDED</strong><small>Historical source retained · Follow ART-07 for the current edition</small><button type="button" data-select-kind="artifact" data-select="ART-07">Open ART-07 ↗</button></div>`:url?`<a class="link-block" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span class="lb-main"><strong>${t19?.mode==='edition_url_replacement'?'Open newest Amazon edition':'Open recorded artifact URL'}</strong><small>${esc(linkDomain(url))}</small></span><span class="arrow">↗</span></a>`:'<p class="helper-msg">No direct publication URL matched in this registry.</p>';
    const releaseNote=`<div class="tiny-note">Historical source state only. A linked page or storefront is not proof of sales, current availability or release certification.</div>`;
    const t19Badge=t19?.mode==='edition_url_replacement'?tag('Newer Amazon edition · owner supplied','caution'):t19?.mode==='retired_public_destination'?tag('Archived source · see ART-07','caution'):publicationNote(a);
    const body1=`<p class="section-note">${esc(f.short_description||'No concise product summary recorded.')}</p>${pubLink}<div class="url-evidence">${t19Badge}</div>${releaseNote}`;
    const body2=`${displayArtifactStage(a)}<div class="fw-dossier-bar"><div class="fw-dossier-head"><span>COMPLETE FIELD DOSSIER</span><small>MD + PDF · source methodology</small></div>${downloadLinks(a)}</div><p class="tiny-note">${m.curation_state==='source_selected_38_case_pass'?'SOURCE-SELECTED v3.1: dated source evidence; cross-artifact uplift unverified.':m.curation_state==='source_researched_v32_e1_e2_no_externally_verified_flywheel'?'SOURCE-RESEARCHED v3.2: E1 design records and E2 documented interventions; no proof of independent validation or cross-artifact uplift.':'PROVISIONAL: artifact-specific method candidates have not been source-audited.'} Complete sources and caveats remain in the MD/PDF.</p>`;
    const relationList=rel.slice(0,24).map(({other,rel,where})=>artifactCardLink(other,`${rel.relation_type.replace(/_/g,' ')} · ${where==='from'?'linked to':'linked from'} this artifact`)).join('');
    const body3=(rel.length?relationList:'<p class="section-note">No explicit cross-artifact relationship registered.</p>')+`<p class="tiny-note">Relationships preserve original association semantics; “associated” does not imply “part of”.</p>`;
    const srcItem=e=>{const c=db.chat.get(e.chat_id);const strength=e.source_strength==='direct/high relevance'?'high':'context';const href='#'+new URLSearchParams({view:'chats',c:e.chat_id}).toString();return `<a class="catalogue-link source-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer" aria-label="Open source ${esc(e.chat_id)} in a new tab"><span class="source-left-rail" aria-hidden="true">◆</span><span class="cl-left"><strong>${esc(c?.title||e.original_source_title||'Untitled source')}</strong><small>${esc(e.source_stage)} · ${esc(c?.first_date||e.original_source_date||'Date unavailable')}</small><span class="source-strength ${strength}">${esc(e.source_strength)}</span></span><span class="cl-id">${esc(e.chat_id)}<span class="external-corner" aria-hidden="true">↗</span></span></a>`;};
    const body4=`<div class="source-intro"><strong>${new Set(source.map(x=>x.chat_id)).size} CONVERSATION SOURCES</strong><small>${source.length} stage links · each source opens in a separate tab</small></div><button type="button" class="source-export" data-export-artifact="${esc(a.id)}" aria-label="Download the ${esc(a.id)} source genealogy CSV">↓ EXPORT SOURCE GENEALOGY · CSV</button><p class="section-note">Source relevance is not proof of causal authorship. Original archive paths appear in each new-tab record.</p><div class="divider-label">Direct / high relevance (${candidates.length})</div>${candidates.slice(0,30).map(srcItem).join('')||'<p class="section-note">None recovered.</p>'}${context.length?`<div class="divider-label">Topic / context / inferred (${context.length})</div>${context.slice(0,22).map(srcItem).join('')}`:''}`;
    const pubCard=p=>{const u=linkSafe(p.url),c=p.current_check||{},s=c.state||'unverified_current';const verified=/^public_(page|pdf|reader|site|document|collection)$/.test(s);const status=verified?'PUBLIC PAGE CHECKED 22 NOV':s==='private_repository'?'PRIVATE REPOSITORY':s==='third_party_older_edition'||s==='public_prior_edition'||s==='public_prior_document'?'EARLIER WORK / EDITION':s==='platform_restricted'||s==='tool_unavailable'?'ACCESS NOT VERIFIED':'NOT RECHECKED';const rel=p.identity_correction?.relation_type||'';return `<div class="catalogue-link" style="cursor:default"><div class="cl-left"><strong>${esc(p.platform)} · ${esc(p.listing_name||'Publication reference')}</strong><small>${esc(p.publication_kind)} · ${esc(status)}</small>${rel?`<small title="${esc(p.identity_correction?.note||'')}">${esc(rel.replace(/_/g,' '))}</small>`:''}<small title="${esc(p.url)}">${esc(linkDomain(p.url))}</small>${u?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" class="inline-link">Open reference ↗</a>`:''}</div><span class="cl-id">${esc(p.id)}</span></div>`;};
    const body5=t19?renderT19Public(id):(pubs.length?pubs.map(pubCard).join(''):'<p class="section-note">No publication URL matched in original registry. See supplements below; this is not evidence of non-publication.</p>')+renderPrivatePreviewCard(id)+renderV17Public(id)+renderT20Public(id);
    const docs=(a.evidence.source_files||[]).map(id=>db.doc.get(id)).filter(Boolean);
    const docBlocks=docs.length?docs.map(d=>`<div class="detail-cell"><div class="d-label">${esc(d.id)} · ${esc(d.inspection_state||'Source')}</div><div class="d-value">${esc(d.filename)}</div></div>`).join(''):'<p class="section-note">No direct evidence-file anchor in this node. Related records may hold the file evidence.</p>';
    const body6=`<div class="detail-grid"><div class="detail-cell"><div class="d-label">Historical evidence</div><div class="d-value">${esc(a.evidence.source_code||'—')}</div></div><div class="detail-cell"><div class="d-label">Methodology family</div><div class="d-value">${esc(m.family_id||'—')}</div></div><div class="detail-cell"><div class="d-label">Navigation lane</div><div class="d-value">${esc(ident.normalized_lane)}</div></div><div class="detail-cell"><div class="d-label">Project ID</div><div class="d-value">${esc(ident.project_id)}</div></div></div><div class="divider-label">Document evidence (${docs.length})</div>${docBlocks}<div class="divider-label">Original evidence notes</div><p class="section-note">${esc(a.evidence.source_notes||'No note')}</p><div class="callout">${esc(a.methodology.evidence_ceiling||'Do not infer sales, causal chat authorship or live deployment from the presence of records.')}</div>`;
    const badge=t19?t19Badge:(f.primary_url?.url?publicationNote(a):tag('No direct URL','caution'));
    return `<div class="inspector-hero" style="--item-color:${esc(ident.color_hex)}"><div class="hero-hud-mark"><span>◈</span><span>OUTPUT DOSSIER</span><i>ARCHIVE SIGNAL · ${esc(id)}</i></div><div class="inspector-kicker"><span>CANONICAL ARTIFACT / ${esc(id)}</span><span>${esc(m.family_id||'—')}</span></div><div class="identity-head"><h2>${esc(ident.title)}</h2><span class="id-plate">${esc(id)}</span></div><div class="inspector-tags">${statusTag(a)}${badge}${tag(srcCount(a,'artifact')+' chat edges','subtle')}${tag(m.curation_state==='source_selected_38_case_pass'?'Audited v3.1':m.curation_state==='source_researched_v32_e1_e2_no_externally_verified_flywheel'?'Research v3.2':'Methodology provisional',m.curation_state==='source_selected_38_case_pass'?'good':'caution')}</div><p class="inspector-summary">${esc(f.short_description||f.intended_use||'Artifact record.')} </p><div class="inspector-sample-tile"><span>${esc(id)}</span><strong>${esc(ident.symbol)}</strong><small>${esc(ident.display_domain)}</small></div></div>
    ${section(1,'Finished product',body1)}${section(2,'A→Z production method',body2)}${section(3,'Artifact family & relationships',body3,false)}${section(4,'Source chat genealogy',body4,false)}${section(5,'Publication footprint',body5,false)}${section(6,'Evidence, versions & limits',body6,false)}`;
  }
  function renderChatInspector(c){const edges=db.c2e.get(c.id)||[];
    const related=edges.map(e=>{let a=db.artifact.get(e.artifact_id);if(!a)return '';return `<button class="catalogue-link" data-select-kind="artifact" data-select="${esc(a.id)}"><span class="cl-left"><strong>${esc(a.identity.title)}</strong><small>${esc(e.source_stage)} · ${esc(e.source_strength)}</small></span><span class="cl-id">${esc(a.id)} ↗</span></button>`;}).join('');
    return `<div class="inspector-hero"><div class="inspector-kicker"><span>ORIGINAL CONVERSATION</span><span>${esc(c.id)}</span></div><div class="inspector-chat-top"><h2>${esc(c.title)}</h2><span class="id-plate">${esc(c.id)}</span></div><div class="inspector-tags">${tag(c.source||'Source')}${tag(c.message_count+' messages','subtle')}${tag(c.classification_confidence+' classification','caution')}</div><p class="inspector-summary">${esc(c.purpose||'Conversation-level purpose not classified.')}</p><div class="detail-grid"><div class="detail-cell"><div class="d-label">First seen</div><div class="d-value">${esc(c.first_date||'—')}</div></div><div class="detail-cell"><div class="d-label">Last seen</div><div class="d-value">${esc(c.last_date||'—')}</div></div></div></div>
      ${section(1,'Original source locator',`<p class="section-note">The original exported conversation can be found in this archive segment:</p><div class="detail-cell"><div class="d-label">Archive path</div><div class="d-value">${esc(c.locator)}</div></div><div class="detail-cell" style="margin-top:7px"><div class="d-label">Original UUID</div><div class="d-value">${esc(c.conversation_id)}</div></div><p class="tiny-note">A source UUID is not a public ChatGPT share link.</p>`,true)}
      ${section(2,'Linked artifact contributions',`<p class="section-note">${edges.length} recorded link(s). Production attribution is analyst-assessed and may be contextual.</p>${related||'<p class="section-note">No reconstructed artifact link. This is still a valid corpus record.</p>'}`,true)}
      ${section(3,'Subject and classification',`<div class="detail-grid"><div class="detail-cell"><div class="d-label">Domain</div><div class="d-value">${esc(c.domain)}</div></div><div class="detail-cell"><div class="d-label">Subdomain</div><div class="d-value">${esc(c.subdomain)}</div></div><div class="detail-cell"><div class="d-label">Flywheel assessment</div><div class="d-value">${esc(c.flywheel_assessment)}</div></div><div class="detail-cell"><div class="d-label">A→Z assessment</div><div class="d-value">${esc(c.a_to_z_assessment)}</div></div></div><p class="section-note">${esc(c.subjects||'')}</p>`,false)}
      ${section(4,'Archived excerpt',`<p class="tiny-note">Excerpt is truncated and may not represent the complete conversation.</p><div class="chat-excerpt">${esc(c.source_excerpt||c.source_summary_excerpt||'No excerpt available.')}</div>`,false)}
    `;
  }
  function renderProjectInspector(p){const arts=p.artifact_ids.map(id=>db.artifact.get(id)).filter(Boolean),linked=arts.filter(a=>db.a2e.has(a.id));
    const col=arts[0]?.identity.color_hex||colorFallback;
    return `<div class="inspector-hero" style="--item-color:${esc(col)}"><div class="inspector-kicker"><span>PROJECT GROUP / NAVIGATION</span><span>${esc(p.id)}</span></div><div class="identity-head"><h2>${esc(p.label)}</h2></div><div class="inspector-tags">${tag(arts.length+' artifact nodes')}${tag(linked.length+' nodes with chat edges','subtle')}</div><p class="inspector-summary">${esc(p.definition||'Curated navigation grouping.')}</p></div>${section(1,'Included artifact records',arts.map(a=>artifactCardLink(a)).join(''),true)}${section(2,'Interpretation',`<p class="section-note">Project groups do not certify completion or merge editions, releases and companion sites into the same product.</p>`,false)}`;
  }
  function showHover(event,b){const kind=b.dataset.kind,id=b.dataset.record,item=db[kind].get(id);if(!item)return;const title=kind==='artifact'?item.identity.title:kind==='chat'?item.title:item.label;
    const sub=kind==='artifact'?item.finished_product.short_description:kind==='chat'?(item.purpose||item.subjects):item.definition;
    const foot=kind==='artifact'?`${srcCount(item,kind)} chat edges • ${db.a2p.get(item.id)?.length||0} URL references`:kind==='chat'?`${item.source} • ${item.locator}`:`${item.artifact_ids.length} associated artifact nodes`;
    EL.hover.innerHTML=`<div class="hc-overline">${esc(id)} · ${esc(domainFor(item,kind))}</div><h3>${esc(title)}</h3><p>${esc((sub||'').slice(0,260))}</p><div class="hc-meta">${esc(foot)}</div>`;
    EL.hover.classList.add('visible');EL.hover.setAttribute('aria-hidden','false');if(event)positionHover(event);else{const rect=b.getBoundingClientRect();positionHover({clientX:rect.left+rect.width/2,clientY:rect.top});}
  }
  function positionHover(e){if(window.innerWidth<=560)return;const h=EL.hover;const rect=h.getBoundingClientRect();let left=e.clientX+18,top=e.clientY+18;if(left+rect.width>window.innerWidth-10)left=e.clientX-rect.width-16;if(top+rect.height>window.innerHeight-8)top=e.clientY-rect.height-18;h.style.left=Math.max(8,left)+'px';h.style.top=Math.max(8,top)+'px';}
  function hideHover(){activeHover=null;EL.hover.classList.remove('visible');EL.hover.setAttribute('aria-hidden','true');}
  function navigateKeyboard(e){if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;const b=e.target.closest('.cube');if(!b)return;const grid=b.closest('.cube-grid');if(!grid)return;const cells=$$('.cube',grid),i=cells.indexOf(b);if(i<0)return;const gridCols=getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length||1;let next=i+({'ArrowLeft':-1,'ArrowRight':1,'ArrowUp':-gridCols,'ArrowDown':gridCols}[e.key]);if(next<0||next>=cells.length)return;e.preventDefault();cells[next].focus();}
  function showFatal(err){console.error(err);EL.content.innerHTML='<div class="empty-inspector"><h2>Index unavailable</h2><p>Could not load the canonical Turn 1 data.</p></div>';EL.lattice.innerHTML=`<div class="empty-result"><h3>Unable to load the atlas</h3><p>${esc(err.message||String(err))}. Use the standalone HTML edition or serve this folder over localhost.</p></div>`;EL.count.textContent='DATA LOAD ERROR';$('#collection').setAttribute('aria-busy','false');}
  async function boot(){try{atlas=await fetchAtlas();chatPrimary=await fetchChatPrimary();artifactExhibits=await fetchArtifactExhibits();exhibitEditorial=await fetchExhibitEditorial();if(!atlas||atlas.artifacts.length!==71||atlas.chats.length!==1181||atlas.chat_edges.length!==327||atlas.publication_links.length!==91)throw new Error('Source counts differ from the locked Turn 1 foundation');db=initIndexes(atlas);updateResearchMetrics();parseHash();initSelects();if(!selectedRecord()){state.selectedKind='';state.selectedId='';}renderInspector();render();updateHash();if(window.initAtlasAudio)audioGuide=window.initAtlasAudio(atlas.artifacts);window.__ATLAS_READY__=true;try{if(window.initAtlasQuickpad)window.__ATLAS_QUICKPAD__=window.initAtlasQuickpad(atlas,id=>selectRecord("artifact",id,true));}catch(err){console.warn("Quickpad unavailable",err);}window.__ATLAS_TEST__={getState:()=>({...state}),getCounts:()=>({artifacts:atlas.artifacts.length,chats:atlas.chats.length,chatEdges:atlas.chat_edges.length,publications:atlas.publication_links.length}),selectRecord,setView};}catch(e){showFatal(e);window.__ATLAS_READY__=false;}}
  boot();
})();

