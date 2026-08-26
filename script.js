/* ============================================================================
   AMERICAN LEDGER — Presidents Timeline — rendering engine
   ============================================================================
   This file is the reusable engine: it knows how to draw lifespans, career/
   military/office bars, term bars, war bands, and shared-moment diamonds
   from data — but holds no content itself. All the actual substance (people,
   wars, shared moments) lives in the JSON files under /data and is loaded
   at runtime via fetch().

   Because of that fetch() call, this page must be served over http(s) —
   it will NOT work if you just double-click index.html and open it as a
   file:// URL (browsers block fetch() of local files for security). Serve
   it with GitHub Pages, or locally with something like:
       python3 -m http.server 8000
   ========================================================================= */

let PARTIES = {};
let POS_LABELS = {};
let PRESIDENTS = [];
let WARS = [];
let EVENTS = [];

async function loadData(){
  const [parties, posLabels, presidents, wars, events] = await Promise.all([
    fetch('data/parties.json').then(r=>r.json()),
    fetch('data/pos-labels.json').then(r=>r.json()),
    fetch('data/presidents.json').then(r=>r.json()),
    fetch('data/wars.json').then(r=>r.json()),
    fetch('data/events.json').then(r=>r.json()),
  ]);
  PARTIES = parties;
  POS_LABELS = posLabels;
  PRESIDENTS = presidents;
  WARS = wars;
  EVENTS = events;
  activeParties = new Set(Object.keys(PARTIES)); // must happen after PARTIES is populated
}

async function init(){
  try{
    await loadData();
    buildLegend();
    render();
  } catch(err){
    console.error('Failed to load timeline data:', err);
    document.getElementById('content').innerHTML =
      '<div style="padding:40px;color:var(--paper-dim);font-family:var(--font-body)">' +
      'Could not load the data files (data/*.json). This page needs to be served over http(s) — ' +
      'opening index.html directly (file://) blocks the fetch() calls that load the data. ' +
      'Try GitHub Pages, or run <code>python3 -m http.server</code> in this folder and open ' +
      '<code>http://localhost:8000</code>.</div>';
  }
}

/* ============================================================================
   RENDERING — you shouldn't need to touch anything below this line to edit
   the data above.
   ========================================================================= */

const ROW_H = 48;
const AXIS_H = 44;
const LABEL_W = 216;
const TIMELINE_START = 1730;
const TIMELINE_END = 2030;
let PX_PER_YEAR = 5.6;

// everything overlaps on one shared vertical center per row — these are the
// (top, height) pairs for each layer, thinnest/faintest at the back to
// boldest/most-solid in front. Diamonds float just above the stack.
const STACK_CENTER = 31;
const LANE = {
  event:  { top: 2,  h: 8 },
  life:   { top: STACK_CENTER - 2,  h: 5 },
  mid:    { top: STACK_CENTER - 7,  h: 15 },  // military / career / office bars share this band
  term:   { top: STACK_CENTER - 11, h: 23 },
};

const board = document.getElementById('board');
const content = document.getElementById('content');
const tooltip = document.getElementById('tooltip');

document.documentElement.style.setProperty('--row-h', ROW_H + 'px');

function toDate(d){ return d ? new Date(d + 'T00:00:00') : null; }
function yearFrac(dateStr){
  const d = toDate(dateStr);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const endOfYear = new Date(d.getFullYear()+1, 0, 1);
  const frac = (d - startOfYear) / (endOfYear - startOfYear);
  return d.getFullYear() + frac;
}
function xFor(dateStr){ return (yearFrac(dateStr) - TIMELINE_START) * PX_PER_YEAR; }
function fmtDate(d){
  if(!d) return 'present';
  const [y,m,day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${parseInt(day,10)}, ${y}`;
}
function timelineWidthPx(){ return (TIMELINE_END - TIMELINE_START) * PX_PER_YEAR; }
function nowStr(){ return String(new Date().getFullYear())+'-01-01'; }

let activeParties = new Set(); // populated once PARTIES loads — see loadData()
let showWars = true, showEvents = true, showLife = true, showMilitary = true, showCareer = true, showOffices = true;
let searchTerm = '';
let pinned = null;

function buildLegend(){
  const el = document.getElementById('legendGroup');
  el.innerHTML = '';
  Object.entries(PARTIES).forEach(([key, val])=>{
    const chip = document.createElement('div');
    chip.className = 'legend-chip';
    chip.innerHTML = `<span class="legend-swatch" style="background:${val.color}"></span>${val.label}`;
    chip.addEventListener('click', ()=>{
      if(activeParties.has(key)){ activeParties.delete(key); chip.classList.add('off'); }
      else { activeParties.add(key); chip.classList.remove('off'); }
      render();
    });
    el.appendChild(chip);
  });
}

function render(){
  const width = timelineWidthPx();
  content.innerHTML = '';
  content.style.width = (LABEL_W + width) + 'px';

  // ---- axis row ----
  const axisRow = document.createElement('div');
  axisRow.className = 'row axis-row';
  const axisLabel = document.createElement('div');
  axisLabel.className = 'label-cell';
  axisLabel.textContent = 'President';
  axisRow.appendChild(axisLabel);

  const axisArea = document.createElement('div');
  axisArea.className = 'axis-area';
  axisArea.style.width = width + 'px';

  const step = PX_PER_YEAR > 9 ? 10 : (PX_PER_YEAR > 3 ? 20 : 50);
  for(let y = Math.ceil(TIMELINE_START/step)*step; y <= TIMELINE_END; y += step){
    const x = (y - TIMELINE_START) * PX_PER_YEAR;
    const isCentury = (y % 100 === 0);
    const gl = document.createElement('div');
    gl.className = 'gridline ' + (isCentury ? 'century' : 'decade');
    gl.style.left = x + 'px';
    axisArea.appendChild(gl);
    const tl = document.createElement('div');
    tl.className = 'tick-label' + (isCentury ? ' century' : '');
    tl.style.left = x + 'px';
    tl.textContent = y;
    axisArea.appendChild(tl);
  }
  axisRow.appendChild(axisArea);
  content.appendChild(axisRow);

  // ---- war layer (behind rows, spans full row-stack height) ----
  const totalRowsHeight = PRESIDENTS.length * ROW_H;
  const warLayer = document.createElement('div');
  warLayer.className = 'war-layer' + (showWars ? '' : ' hidden');
  warLayer.style.left = LABEL_W + 'px';
  warLayer.style.top = AXIS_H + 'px';
  warLayer.style.width = width + 'px';
  warLayer.style.height = totalRowsHeight + 'px';
  WARS.forEach((w,i)=>{
    const x1 = xFor(w.start), x2 = xFor(w.end);
    const band = document.createElement('div');
    band.className = 'war-band';
    band.style.left = x1 + 'px';
    band.style.width = Math.max(2, x2-x1) + 'px';
    const lbl = document.createElement('div');
    lbl.className = 'war-label';
    // stagger labels onto two rows so wars close together in time
    // (e.g. Afghanistan/Iraq) don't have their text collide
    lbl.style.top = (2 + (i % 2) * 12) + 'px';
    lbl.textContent = w.name;
    band.appendChild(lbl);
    warLayer.appendChild(band);
  });
  content.appendChild(warLayer);

  // ---- data rows ----
  PRESIDENTS.forEach(p=>{
    const row = document.createElement('div');
    row.className = 'row data-row';

    const matchesSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm);
    const partyActive = activeParties.has(p.party);
    if(!matchesSearch || !partyActive) row.classList.add('dimmed');

    const label = document.createElement('div');
    label.className = 'label-cell';
    const numText = p.num.length>1 ? p.num.join(' & ') : p.num[0];
    label.innerHTML = `<span class="label-num">No. ${numText}</span><span class="label-name">${p.name}</span><span class="label-party">${PARTIES[p.party].label}</span>`;
    row.appendChild(label);

    const area = document.createElement('div');
    area.className = 'timeline-area';
    area.style.width = width + 'px';

    // life bar — always the back layer
    const bx1 = xFor(p.born);
    const bx2 = p.died ? xFor(p.died) : xFor(nowStr());
    const life = document.createElement('div');
    life.className = 'life-bar' + (p.died ? '' : ' alive');
    life.style.left = bx1 + 'px';
    life.style.width = Math.max(2, bx2-bx1) + 'px';
    life.style.top = LANE.life.top + 'px';
    life.style.display = showLife ? 'block' : 'none';
    life.addEventListener('mouseenter', (e)=> showTooltip(e, presidentTooltip(p)));
    life.addEventListener('mouseleave', hideTooltipMaybe);
    life.addEventListener('click', (e)=> pinTooltip(e, presidentTooltip(p)));
    area.appendChild(life);

    // military / career / office bars — all share the same mid-band, overlapping
    (p.positions||[]).forEach(pos=>{
      const px1 = xFor(pos.start);
      const px2 = pos.end ? xFor(pos.end) : xFor(nowStr());
      let bar = document.createElement('div');
      let visible = true;
      if(pos.type === 'military'){ bar.className = 'mil-bar'; visible = showMilitary; }
      else if(pos.type === 'career'){ bar.className = 'job-bar'; visible = showCareer; }
      else { bar.className = 'office-bar type-' + pos.type; visible = showOffices; }
      bar.style.top = LANE.mid.top + 'px';
      bar.style.left = px1 + 'px';
      bar.style.width = Math.max(2, px2-px1) + 'px';
      bar.style.display = visible ? 'block' : 'none';
      const posData = { eyebrow: POS_LABELS[pos.type], name: pos.label, dates: `${fmtDate(pos.start)} – ${pos.end ? fmtDate(pos.end) : 'present'}`, bodyHtml: `<p style="margin:2px 0 0;color:var(--paper-dim)">${p.name}</p>` };
      bar.addEventListener('mouseenter', (e)=> showTooltip(e, posData));
      bar.addEventListener('mouseleave', hideTooltipMaybe);
      bar.addEventListener('click', (e)=> pinTooltip(e, posData));
      area.appendChild(bar);
    });

    // term bars — always the front layer
    p.terms.forEach(t=>{
      const tx1 = xFor(t.start);
      const tx2 = t.end ? xFor(t.end) : xFor(nowStr());
      const bar = document.createElement('div');
      bar.className = 'term-bar';
      bar.style.left = tx1 + 'px';
      bar.style.top = LANE.term.top + 'px';
      bar.style.width = Math.max(3, tx2-tx1) + 'px';
      bar.style.background = PARTIES[p.party].color;
      bar.addEventListener('mouseenter', (e)=> showTooltip(e, presidentTooltip(p)));
      bar.addEventListener('mouseleave', hideTooltipMaybe);
      bar.addEventListener('click', (e)=> pinTooltip(e, presidentTooltip(p)));
      area.appendChild(bar);

      if(t.endReason){
        const mark = document.createElement('div');
        mark.className = 'term-end-mark ' + t.endReason;
        mark.style.left = tx2 + 'px';
        mark.style.top = (LANE.term.top - 3) + 'px';
        mark.style.height = (LANE.term.h + 6) + 'px';
        area.appendChild(mark);
      }
    });

    // shared-moment diamonds — only on rows of presidents actually involved
    EVENTS.forEach(ev=>{
      if(!ev.presidents.includes(p.name)) return;
      const x = xFor(ev.date);
      const dot = document.createElement('div');
      dot.className = 'event-diamond' + (showEvents ? '' : ' hidden');
      dot.style.left = x + 'px';
      dot.style.top = LANE.event.top + 'px';
      const evData = {
        eyebrow: 'Shared moment', name: ev.label, dates: fmtDate(ev.date),
        bodyHtml: `<p style="margin:4px 0 0;color:var(--paper-dim)">${ev.note||''}</p><p style="margin:6px 0 0;font-size:11px;color:var(--paper-dim)">Also involving: ${ev.presidents.filter(n=>n!==p.name).join(', ')}</p>`
      };
      dot.addEventListener('mouseenter', (e)=> showTooltip(e, evData));
      dot.addEventListener('mouseleave', hideTooltipMaybe);
      dot.addEventListener('click', (e)=> pinTooltip(e, evData));
      area.appendChild(dot);
    });

    row.appendChild(area);
    content.appendChild(row);
  });
}

function presidentTooltip(p){
  const termLines = p.terms.map((t,i)=>{
    const ord = p.num[i];
    let endTxt = t.end ? fmtDate(t.end) : 'present';
    let reason = t.endReason ? ` (${t.endReason})` : '';
    return `Term ${ord}: ${fmtDate(t.start)} – ${endTxt}${reason}`;
  }).join('<br>');
  const lifeSpan = `${fmtDate(p.born)} – ${p.died ? fmtDate(p.died) : 'living'}`;
  const posLines = (p.positions||[]).map(pos=>`<span style="color:var(--brass);font-family:var(--font-mono);font-size:10px;text-transform:uppercase;letter-spacing:0.04em">${POS_LABELS[pos.type]}</span> — ${pos.label} <span style="color:var(--paper-dim)">(${fmtDate(pos.start)}–${pos.end?fmtDate(pos.end):'present'})</span>`);
  const bodyHtml = `
    <div class="tt-section-title">In office</div>
    <div style="font-family:var(--font-mono);font-size:11px;color:var(--paper-dim)">${termLines}</div>
    ${posLines.length ? `<div class="tt-section-title">Career, military &amp; office</div><ul>${posLines.map(l=>`<li>${l}</li>`).join('')}</ul>` : ''}
    ${p.career.length ? `<div class="tt-section-title">Other notes</div><ul>${p.career.map(c=>`<li>${c}</li>`).join('')}</ul>` : ''}
    <div class="tt-section-title">Presidency highlights</div>
    <ul>${p.accomplishments.map(a=>`<li>${a}</li>`).join('')}</ul>
  `;
  return { eyebrow: PARTIES[p.party].label + ' · No. ' + p.num.join(' & '), name: p.name, dates: lifeSpan, bodyHtml };
}

function showTooltip(e, data){
  if(pinned) return;
  fillTooltip(data);
  positionTooltip(e);
  tooltip.style.display = 'block';
}
function positionTooltip(e){
  const pad = 16;
  let x = e.clientX + pad, y = e.clientY + pad;
  if(x + 330 > window.innerWidth) x = e.clientX - 330 - pad;
  if(y + 260 > window.innerHeight) y = e.clientY - 200;
  tooltip.style.left = x + 'px';
  tooltip.style.top = y + 'px';
}
function fillTooltip(data){
  document.getElementById('ttEyebrow').textContent = data.eyebrow || '';
  document.getElementById('ttName').textContent = data.name || '';
  document.getElementById('ttDates').textContent = data.dates || '';
  document.getElementById('ttBody').innerHTML = data.bodyHtml || '';
}
function hideTooltipMaybe(){ if(pinned) return; tooltip.style.display = 'none'; }
function pinTooltip(e, data){
  pinned = data;
  fillTooltip(data);
  positionTooltip(e);
  tooltip.style.display = 'block';
  tooltip.classList.add('pinned');
}
document.getElementById('ttClose').addEventListener('click', ()=>{
  pinned = null;
  tooltip.classList.remove('pinned');
  tooltip.style.display = 'none';
});
document.addEventListener('click', (e)=>{
  if(pinned && !tooltip.contains(e.target) && !e.target.closest('.term-bar') && !e.target.closest('.life-bar') && !e.target.closest('.mil-bar') && !e.target.closest('.job-bar') && !e.target.closest('.office-bar') && !e.target.closest('.event-diamond')){
    pinned = null;
    tooltip.classList.remove('pinned');
    tooltip.style.display = 'none';
  }
});

// ---- controls ----
document.getElementById('zoomIn').addEventListener('click', ()=>{ PX_PER_YEAR = Math.min(40, PX_PER_YEAR*1.35); render(); });
document.getElementById('zoomOut').addEventListener('click', ()=>{ PX_PER_YEAR = Math.max(1.2, PX_PER_YEAR/1.35); render(); });
document.getElementById('zoomReset').addEventListener('click', ()=>{ PX_PER_YEAR = 5.6; board.scrollLeft = 0; board.scrollTop = 0; render(); });
document.getElementById('toggleWars').addEventListener('change', (e)=>{ showWars = e.target.checked; render(); });
document.getElementById('toggleEvents').addEventListener('change', (e)=>{ showEvents = e.target.checked; render(); });
document.getElementById('toggleLife').addEventListener('change', (e)=>{ showLife = e.target.checked; render(); });
document.getElementById('toggleMilitary').addEventListener('change', (e)=>{ showMilitary = e.target.checked; render(); });
document.getElementById('toggleCareer').addEventListener('change', (e)=>{ showCareer = e.target.checked; render(); });
document.getElementById('toggleOffices').addEventListener('change', (e)=>{ showOffices = e.target.checked; render(); });
document.getElementById('searchBox').addEventListener('input', (e)=>{ searchTerm = e.target.value.trim().toLowerCase(); render(); });

document.getElementById('modeToggle').addEventListener('click', ()=>{
  const isLight = document.body.classList.toggle('light');
  document.getElementById('modeToggle').textContent = isLight ? '☀ Light mode' : '☾ Dark mode';
});

init();
