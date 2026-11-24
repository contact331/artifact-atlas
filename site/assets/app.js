(() => {
  'use strict';

  const {artifacts, mediaBase} = window.ATLAS_CATALOGUE;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;',
  })[char]);
  const folded = value => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  const projects = [...new Set(artifacts.map(record => record.projectId))].map(id => {
    const records = artifacts.filter(record => record.projectId === id);
    const first = records[0];
    return {
      id, records, title: first.project, project: first.project, projectId: id,
      domain: first.domain, color: first.color, type: 'Project',
      symbol: first.project.match(/[\p{L}\p{N}]+/gu).slice(0, 3).map(word => word[0]).join('').toUpperCase(),
    };
  });
  const recordsById = new Map([...artifacts, ...projects].map(record => [record.id, record]));
  const views = {
    artifacts: ['Curated releases', 'Individual outputs', 'Books, exhibitions, film, and standalone research.'],
    records: ['Complete exhibition index', 'All artifact records', 'Explore the public works and their companions.'],
    projects: ['Project index', 'Projects', 'Follow the works grouped under each project.'],
  };
  const positions = ['northwest', 'north', 'northeast', 'west', 'east', 'southwest', 'south', 'southeast'];
  const themesAt = new Map([[1, 0], [3, 1], [4, 2], [6, 3]]);
  const sectionNames = ['Finished product', 'A→Z production method', 'Related works', 'Public references', 'Publication footprint', 'Themes'];
  const projectSectionNames = ['Included artifact records', 'Project overview'];
  const lattice = $('#lattice');
  const dialog = $('#mcubeOverlay');
  const inspector = $('#inspector');
  const search = $('#search');
  const selects = ['#domainFilter', '#projectFilter', '#sortFilter'].map(selector => $(selector));
  const state = {view: 'artifacts', id: artifacts[0].id};
  let trigger;
  let audio;

  function audioCube(record) {
    return `<button type="button" class="mcube mcube--active mcube--audio" style="--mini-position:0" data-atlas-audio="${record.id}" data-audio-state="idle" aria-label="Play ${esc(record.title)}"><span class="mcube-audio-icon" aria-hidden="true"></span><span class="mcube-label">Audio</span></button>`;
  }

  function miniCube(record, slot, value, label, index, theme = false) {
    return `<button type="button" class="mcube mcube--active${theme ? ' mcube--exhibit' : ''}" style="--mini-position:${slot}" data-popup="${value}" data-popup-record="${record.id}" title="${esc(label)}" aria-label="${record.id}: ${esc(label)} (${positions[slot]})"><span class="mcube-index" aria-hidden="true">${index}</span><span class="mcube-label">${esc(label)}</span></button>`;
  }

  function cube(record) {
    const project = Boolean(record.records);
    const kind = project ? 'project' : 'artifact';
    const selected = record.id === state.id;
    const title = esc(record.title);
    const footer = project ? `${record.records.length} works` : `${record.links.length} public ${record.links.length === 1 ? 'link' : 'links'}`;
    const main = `<button type="button" class="cube cube--${kind}${selected ? ' selected' : ''}" style="--face:${record.color}" data-kind="${kind}" data-record="${record.id}" aria-label="${record.id} ${title}" aria-pressed="${selected}" title="${title}"><span class="cube-top"><span>${esc(project ? record.id.replace('PROJ-', 'P·') : record.id)}</span><span>${esc(record.type.toUpperCase())}</span></span><span class="cube-center"><span class="cube-symbol">${esc(record.symbol)}</span></span><span class="cube-bottom"><span class="cube-name">${title}</span><span class="cube-footer">${esc(footer.toUpperCase())}</span></span><span class="cube-status"><span style="--level:80%"></span></span></button>`;
    const satellites = positions.map((_, slot) => {
      if (project) {
        if (slot === 3) return miniCube(record, slot, 'section-1', 'Records', '01');
        if (slot === 4) return miniCube(record, slot, 'section-2', 'Overview', '02');
      } else {
        if (slot === 0) return audioCube(record);
        if (slot === 2) return miniCube(record, slot, 'section-2', 'Method', '02');
        if (slot === 5) return miniCube(record, slot, 'section-5', 'Public', '05');
        if (themesAt.has(slot)) {
          const index = themesAt.get(slot);
          return miniCube(record, slot, `theme-${index}`, record.themes[index].title, '◇', true);
        }
      }
      return `<span class="mcube mcube--blank" style="--mini-position:${slot}" aria-hidden="true"></span>`;
    }).join('');
    return `<div class="cube-cluster" role="group" aria-label="${record.id} companion cubes" style="--cluster-face:${record.color}">${main}${satellites}<span class="dock-rail dock-rail--right" aria-hidden="true"></span><span class="dock-rail dock-rail--down" aria-hidden="true"></span></div>`;
  }

  function publications(record) {
    return record.links.map(({label, url}) => `<a class="link-block public-popup-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><span><strong>${esc(label)}</strong><br><small>${esc(new URL(url).hostname)}</small></span><span aria-hidden="true">↗</span></a>`).join('');
  }

  function recordButtons(records) {
    return records.map(record => `<button type="button" class="inspector-related" data-select="${record.id}">${record.id} · ${esc(record.title)}</button>`).join('');
  }

  function sectionBody(record, number) {
    if (record.records) {
      if (number === 1) return recordButtons(record.records);
      return `<p>This project brings together ${record.records.length} ${record.records.length === 1 ? 'work' : 'works'} in the public Atlas.</p>`;
    }
    switch (number) {
      case 1: return `<p class="public-record-copy">${esc(record.summary)}</p>`;
      case 2: return `<div class="public-method"><p>${esc(record.method)}</p></div>`;
      case 3: {
        const related = recordsById.get(record.projectId).records.filter(item => item.id !== record.id);
        return related.length ? recordButtons(related) : `<p>${esc(record.project)} has one work in this exhibition.</p>`;
      }
      case 4:
      case 5: return publications(record);
      case 6: return record.themes.map((theme, index) => `<button type="button" class="inspector-related" data-popup="theme-${index}" data-popup-record="${record.id}">${esc(theme.title)}</button>`).join('');
    }
  }

  function renderInspector() {
    const record = recordsById.get(state.id);
    const names = record.records ? projectSectionNames : sectionNames;
    const content = $('#inspectorContent');
    $('#inspector-number').textContent = '/ ' + (record.records ? record.symbol : record.id.slice(4));
    $('#inspector-foot-id').textContent = record.id;
    const hero = `<div class="inspector-hero" style="--face:${record.color}"><div class="inspector-kicker"><span>${record.records ? 'PROJECT' : 'OUTPUT DOSSIER'}</span><span>${record.id}</span></div><h2>${esc(record.title)}</h2><div class="inspector-tags"><span class="inspector-tag">${esc(record.type)}</span><span class="inspector-tag">${esc(record.domain)}</span></div>${record.summary ? `<p class="public-record-copy">${esc(record.summary)}</p>` : ''}<div class="inspector-preview-cube cube" aria-hidden="true" style="--face:${record.color};width:76px;height:76px"><span class="cube-center"><span class="cube-symbol" style="font-size:24px">${esc(record.symbol)}</span></span></div></div>`;
    const sections = names.map((name, index) => {
      const number = index + 1;
      return `<details class="inspector-section" data-section="${number}"><summary class="section-header"><span class="summary-index">${String(number).padStart(2, '0')}</span>${esc(name)}<span class="section-icon">+</span></summary><div class="inspector-section-body">${sectionBody(record, number)}</div></details>`;
    }).join('');
    content.innerHTML = hero + sections;
    content.scrollTop = 0;
  }

  function setInspector(open) {
    inspector.classList.toggle('open', open);
    $('#scrim').classList.toggle('active', open);
    document.body.classList.toggle('inspector-open', open);
  }

  function writeHash() {
    const params = new URLSearchParams({view:state.view, a:state.id});
    history.replaceState(null, '', '#' + params);
  }

  function readHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    const requested = params.get('view');
    if (Object.hasOwn(views, requested)) state.view = requested;
    const selected = params.get('a') || params.get('p');
    if (recordsById.has(selected)) state.id = selected;
  }

  function selectRecord(id) {
    if (!recordsById.has(id)) return;
    state.id = id;
    $$('.cube[data-record]', lattice).forEach(button => {
      const selected = button.dataset.record === id;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    renderInspector();
    writeHash();
    if (innerWidth <= 820) setInspector(true);
  }

  function openPopup(button) {
    const record = recordsById.get(button.dataset.popupRecord);
    const [type, value] = button.dataset.popup.split('-');
    const index = Number(value);
    trigger = button;
    const theme = type === 'theme' ? record.themes[index] : null;
    const names = record.records ? projectSectionNames : sectionNames;
    $('#mcubeKicker').textContent = record.id + (theme ? ' / THEME' : ' / DOSSIER');
    $('#mcubeTitle').textContent = theme?.title || names[index - 1];
    $('#mcubeDeckNote').textContent = record.title;
    $('#mcubeDialogContent').innerHTML = theme ? `<div class="public-theme"><p>${esc(theme.description)}</p></div>` : sectionBody(record, index);
    dialog.style.setProperty('--mc-accent', record.color);
    dialog.hidden = false;
    $('.workbench').inert = true;
    inspector.inert = true;
    $('#mcubeClose').focus();
  }

  function closePopup(restore = true) {
    if (dialog.hidden) return;
    dialog.hidden = true;
    $('.workbench').inert = false;
    inspector.inert = false;
    if (restore) trigger?.focus();
  }

  function render() {
    const [domain, project, sort] = selects.map(select => select.value);
    const query = folded(search.value.trim());
    const [eyebrow, title, explainer] = views[state.view];
    const candidates = state.view === 'projects' ? projects : state.view === 'artifacts' ? artifacts.filter(record => record.primary) : artifacts;
    const filtered = candidates.filter(record => {
      const description = [record.id, record.title, record.project, record.domain, record.summary, record.method, ...(record.themes || []).map(theme => theme.title)].join(' ');
      const domainMatch = !domain || record.domain === domain || record.records?.some(item => item.domain === domain);
      return domainMatch && (!project || project === record.projectId) && (!query || folded(description).includes(query));
    });
    filtered.sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : a.id.localeCompare(b.id));
    const grouped = sort === 'domain' || sort === 'project';
    const groups = new Map();
    for (const record of filtered) {
      const key = grouped ? record[sort] : '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }
    $('#collectionEyebrow').textContent = eyebrow.toUpperCase();
    $('#collectionTitle').textContent = title;
    $('#collectionExplainer').textContent = explainer;
    $('#scopeCaption').textContent = candidates.length + ' available';
    $('#resultsCount').textContent = `${filtered.length} ${state.view === 'projects' ? 'projects' : 'records'} shown`;
    $$('.view-tab').forEach(tab => {
      const active = tab.dataset.view === state.view;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    lattice.innerHTML = filtered.length
      ? [...groups].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([name, list]) =>
          `<section class="domain-section">${grouped ? `<div class="domain-title"><div class="domain-name"><span class="domain-swatch" style="--domain-color:${list[0].color}"></span>${esc(name)}</div><div class="domain-count">${list.length} / CUBES</div></div>` : ''}<div class="cube-grid">${list.map(cube).join('')}</div></section>`
        ).join('')
      : '<div class="empty-result"><h3>No matching works</h3><button type="button" data-reset>Clear filters</button></div>';
    $('#collection').setAttribute('aria-busy','false');
    audio?.sync(lattice);
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

  function reset() {
    search.value = '';
    selects.forEach(select => { select.selectedIndex = 0; });
    render();
  }

  const domains = [...new Set(artifacts.map(record => record.domain))].sort();
  selects[0].insertAdjacentHTML('beforeend', domains.map(domain => `<option>${esc(domain)}</option>`).join(''));
  selects[1].insertAdjacentHTML('beforeend', projects.map(project => `<option value="${project.id}">${esc(project.title)}</option>`).join(''));
  $('#tab-output-count').textContent = artifacts.filter(record => record.primary).length;
  $('[data-view="records"] .tab-counter').textContent = artifacts.length;
  $('[data-view="projects"] .tab-counter').textContent = projects.length;
  $('#researchMetrics').innerHTML = `<span class="metric-item">${artifacts.length} works</span><span class="metric-item">${projects.length} projects</span><span class="metric-item">Guided audio</span>`;

  document.addEventListener('click', event => {
    const tab = event.target.closest('.view-tab');
    const button = event.target.closest('[data-record], [data-select], [data-popup]');
    if (tab) {
      state.view = tab.dataset.view;
      reset();
      writeHash();
    } else if (button?.dataset.popup) {
      openPopup(button);
    } else if (button) {
      closePopup(false);
      selectRecord(button.dataset.record || button.dataset.select);
    } else if (event.target.closest('[data-reset],#resetFilters')) reset();
  });
  $('#viewNav').addEventListener('keydown', event => {
    const tabs = $$('.view-tab');
    const index = tabs.indexOf(document.activeElement);
    const key = event.key;
    if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const next = key === 'Home' ? 0 : key === 'End' ? tabs.length - 1 :
      (index + tabs.length + (key === 'ArrowRight' ? 1 : -1)) % tabs.length;
    tabs[next].click();
    tabs[next].focus();
  });
  $('#openInspector').addEventListener('click', () => setInspector(true));
  $('#closeInspector').addEventListener('click', () => setInspector(false));
  $('#scrim').addEventListener('click', () => setInspector(false));
  $('#mcubeClose').addEventListener('click', () => closePopup());
  $('#mcubeSidebar').addEventListener('click', () => {
    const {popup, popupRecord} = trigger.dataset;
    closePopup(false);
    selectRecord(popupRecord);
    setInspector(true);
    const number = popup.startsWith('theme-') ? 6 : Number(popup.split('-')[1]);
    const details = $(`[data-section="${number}"]`, inspector);
    details.open = true;
    $('summary', details).focus();
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) closePopup(); });
  search.addEventListener('input', render);
  selects.forEach(select => select.addEventListener('change', render));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (!dialog.hidden) closePopup();
      else setInspector(false);
    }
    if (event.key === 'Tab' && !dialog.hidden) {
      const elements = $$('a, button', dialog);
      if (event.shiftKey && document.activeElement === elements[0]) {
        event.preventDefault();
        elements.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === elements.at(-1)) {
        event.preventDefault();
        elements[0].focus();
      }
    }
    if (event.key === '/' && dialog.hidden && !event.target.closest('input, select, textarea, [contenteditable]')) {
      event.preventDefault();
      search.focus();
    }
  });
  window.addEventListener('hashchange', () => {
    readHash();
    renderInspector();
    render();
  });
  window.addEventListener('resize', () => requestAnimationFrame(layoutDocking));
  readHash();
  renderInspector();
  render();
  audio = window.initAtlasAudio(artifacts, mediaBase);
  audio.sync();
})();
