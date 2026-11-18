/* ===== 常量 ===== */
const SLOTS = [
  { key:'hat',    label:'帽子' },
  { key:'top',    label:'上衣' },
  { key:'bottom', label:'裤子' },
  { key:'cape',   label:'披风' },
  { key:'glove',  label:'手套' },
  { key:'shoe',   label:'鞋子' }
];

const TARGET_MAX = 3;   /* 同一个词条最多凑 3 条 */
const TAGS = [
  { k:'DL',      name:'Dimensional Leap', group:'core' },
  { k:'WH',      name:'White Hole',       group:'core' },
  { k:'REG',     name:'Registry',         group:'core' },
  { k:'ATK',     name:'ATK',              group:'core' },
  { k:'BOW',     name:'Bowman',           group:'class' },
  { k:'CD',      name:'Crit DMG',         group:'crit' },
  { k:'MAGE',    name:'Mage',             group:'class' },
  { k:'PIRATE',  name:'Pirate',           group:'class' },
  { k:'THIEF',   name:'Thief',            group:'class' },
  { k:'WARRIOR', name:'Warrior',          group:'class' },
  { k:'IED',     name:'IED',              group:'extra' },
  { k:'DMG',     name:'Dmg',              group:'extra' },
  { k:'BD',      name:'BD',               group:'extra' },
  { k:'OTHER',   name:'Other',            group:'other' }
];
const TAGMAP = {};
TAGS.forEach(t => { TAGMAP[t.k] = t; });

/* ===== 搭配（多套目标）===== */
const DEFAULT_PRESET_ID = 'classic';
const DEFAULT_PRESETS = [
  {
    id: DEFAULT_PRESET_ID,
    name: '默认泛用毕业搭配',
    desc: '通用四类各 3 条，五个职业各 1 条，Crit DMG 1 条',
    builtin: true,
    targets: { DL:3, WH:3, REG:3, ATK:3, MAGE:1, PIRATE:1, THIEF:1, WARRIOR:1, BOW:1, CD:1 }
  },
  {
    id: 'all-attack',
    name: '全攻击(6彩色宝石)',
    desc: '三条伤害',
    builtin: true,
    targets: { DL:3, WH:3, REG:3, ATK:3, CD:3, DMG:3 }
  },
  {
    id: 'triple-holo',
    name: '三全息(5彩色宝石)',
    desc: '任意三条1级全息',
    builtin: true,
    targets: { DL:3, WH:3, REG:3, ATK:3, CD:3 }
  }
];
const DEFAULT_PRESET = DEFAULT_PRESETS[0];
const LEGACY_PRESET_IDS = { p3:'all-attack', p4:'triple-holo' };

function cleanTargets(o) {
  const z = {};
  TAGS.forEach(t => { z[t.k] = Math.max(0, Math.min(TARGET_MAX, Math.round(Number(o && o[t.k]) || 0))); });
  return z;
}
function makePreset(p, keepId) {
  return {
    id: keepId || p.id,
    name: String(p.name || '').slice(0, 24),
    desc: String(p.desc || '').slice(0, 40),
    builtin: !!p.builtin,
    targets: cleanTargets(p.targets)
  };
}
function mergePresets(raw) {
  const saved = (Array.isArray(raw) ? raw : []).map(p => makePreset(p, p.id));
  const customs = saved.filter(p => !DEFAULT_PRESETS.some(b =>
    b.id === p.id || (p.name || '').trim() === b.name));
  const list = DEFAULT_PRESETS.map(b => makePreset(b));
  customs.forEach(p => { if (!list.some(x => x.id === p.id)) list.push(p); });
  return list;
}
function mapActiveId(id) {
  return LEGACY_PRESET_IDS[id] || id;
}
function presetById(id) {
  for (let i = 0; i < state.presets.length; i++) {
    if (state.presets[i].id === id) return state.presets[i];
  }
  return state.presets[0];
}
function activePreset() { return presetById(state.activeId); }
function activeTargets() {
  const p = activePreset();
  const out = {};
  TAGS.forEach(t => {
    const n = Math.round(Number(p.targets[t.k]) || 0);
    if (n > 0) out[t.k] = Math.min(TARGET_MAX, n);
  });
  return out;
}
function presetTotal(p) {
  let sum = 0;
  TAGS.forEach(t => { sum += Math.max(0, Math.min(TARGET_MAX, Math.round(Number(p.targets[t.k]) || 0))); });
  return sum;
}
function nextPresetId() {
  let n = state.presets.length + 1;
  let id = 'p' + n;
  while (state.presets.some(p => p.id === id)) { n += 1; id = 'p' + n; }
  return id;
}
function targetSummary(targets) {
  const keys = Object.keys(targets);
  if (!keys.length) return '未设置';
  return keys.map(k => TAGMAP[k].name + ' ×' + targets[k]).join('、');
}

/* ===== 求解核心 ===== */
function solveSet(slotPieces, targets, comboLimit) {
  const keys = Object.keys(targets);
  const tgt = keys.map(k => targets[k]);
  const idx = {};
  keys.forEach((k, i) => { idx[k] = i; });
  const empty = tgt.map(() => 0);
  const totalTarget = tgt.reduce((a, b) => a + b, 0);

  /* 同部位里词条完全相同的件视为等价：方案按「词条组合」计数，不按件计数。
     每类只保留一个代表，并记住它在本部位库存里的序号（显示用第一个）。 */
  const slotSets = slotPieces.map(list => {
    const seen = new Map();
    const out = [];
    list.forEach((p, i) => {
      const sig = p.lines.map(l => String(l)).sort().join('|');
      if (seen.has(sig)) { seen.get(sig).count += 1; return; }
      const entry = { piece:p, index:i, count:1 };
      seen.set(sig, entry);
      out.push(entry);
    });
    return out;
  });

  function apply(counts, piece) {
    const c = counts.slice();
    let gain = 0;
    for (let n = 0; n < piece.lines.length; n++) {
      const j = idx[piece.lines[n]];
      if (j === undefined) continue;
      if (c[j] < tgt[j]) { c[j] += 1; gain += 1; }
    }
    return [c, gain];
  }

  const memo = new Map();
  function best(i, counts) {
    if (i === slotPieces.length) return { score:0, ways:1 };
    const key = i + '|' + counts.join(',');
    const hit = memo.get(key);
    if (hit) return hit;
    /* 这个部位还没有装备：先空着继续算，后面再提示「添一件什么就能齐」 */
    if (!slotSets[i].length) {
      const skip = best(i + 1, counts);
      memo.set(key, skip);
      return skip;
    }
    let bs = -Infinity, bw = 0;
    for (let p = 0; p < slotSets[i].length; p++) {
      const [c2, g] = apply(counts, slotSets[i][p].piece);
      const r = best(i + 1, c2);
      if (r.ways === 0) continue;
      const tot = g + r.score;
      if (tot > bs) { bs = tot; bw = r.ways; }
      else if (tot === bs) { bw += r.ways; }
    }
    const res = { score:bs, ways:bw };
    memo.set(key, res);
    return res;
  }

  const root = best(0, empty);
  const maxScore = root.score;
  const ways = root.ways;
  const emptySlots = slotPieces
    .map((list, i) => (list.length ? null : SLOTS[i].label))
    .filter(Boolean);

  const combos = [];
  if (ways > 0 && comboLimit > 0) {
    const path = [];
    (function walk(i, counts, remain) {
      if (combos.length >= comboLimit) return;
      if (i === slotPieces.length) { combos.push(path.slice()); return; }
      if (!slotSets[i].length) { walk(i + 1, counts, remain); return; }
      for (let p = 0; p < slotSets[i].length; p++) {
        const [c2, g] = apply(counts, slotSets[i][p].piece);
        const r = best(i + 1, c2);
        if (r.ways === 0 || g + r.score !== remain) continue;
        path.push({ slot:i, pieceIndex:slotSets[i][p].index, piece:slotSets[i][p].piece, gain:g });
        walk(i + 1, c2, remain - g);
        path.pop();
        if (combos.length >= comboLimit) return;
      }
    })(0, empty, maxScore);
  }

  function rawCounts(combo) {
    const c = {};
    keys.forEach(k => { c[k] = 0; });
    combo.forEach(step => {
      step.piece.lines.forEach(l => { if (c[l] !== undefined) c[l] += 1; });
    });
    return c;
  }

  return {
    keys, targets:targets, tgt, totalTarget,
    maxScore, ways, combos, emptySlots, rawCounts
  };
}

/* ===== 状态 ===== */
const STORE_KEY = 'ms-3l-solver-v2';
const state = {
  page:'solve',
  activeId:DEFAULT_PRESET_ID,
  presets:DEFAULT_PRESETS.map(p => makePreset(p)),
  inv:null,
  demo:false,
  pick:{ slot:'hat', lines:[] },
  solIndex:0
};
let LAST = null;

function emptyInv() {
  const o = {};
  SLOTS.forEach(s => { o[s.key] = []; });
  return o;
}
function P(a, b, c) { return { lines:[a, b, c] }; }

function demoInv() {
  /* 用这套示例可以直接凑满「默认泛用毕业搭配」的 18 条，并且有 2 套不同选择；
     hat #3 与 #1 词条完全相同，用来演示同款件不会算成两套方案 */
  return {
    hat:    [P('DL','WH','ATK'),  P('DL','ATK','MAGE'), P('DL','WH','ATK')],
    top:    [P('DL','REG','MAGE'), P('DL','REG','CD')],
    bottom: [P('WH','ATK','PIRATE')],
    cape:   [P('REG','DL','THIEF')],
    glove:  [P('WH','ATK','WARRIOR')],
    shoe:   [P('REG','BOW','CD'),  P('REG','BOW','MAGE')]
  };
}

function normalizeInv(obj) {
  const out = emptyInv();
  SLOTS.forEach(s => {
    const list = (obj && Array.isArray(obj[s.key])) ? obj[s.key] : [];
    out[s.key] = list
      .map(p => ({ lines:(Array.isArray(p && p.lines) ? p.lines : []).filter(k => TAGMAP[k]).slice(0, 3) }))
      .filter(p => p.lines.length > 0);
  });
  return out;
}

/* ===== DOM 小工具 ===== */
const $ = s => document.querySelector(s);
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}
function chipNode(k, dim) {
  const t = TAGMAP[k];
  const c = el('span', 'chip s-' + k.toLowerCase() + (dim ? ' dim' : ''), t.name);
  c.dataset.tag = k;
  return c;
}

/* ===== 存档 ===== */
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      version:5, page:state.page, activeId:state.activeId,
      presets:state.presets, inv:state.inv, demo:state.demo
    }));
  } catch (e) { /* file:// 下若被禁用就忽略 */ }
}
/* 把一份存档数据装进 state（load 与导入共用） */
function applyStore(d) {
  state.inv = normalizeInv(d.inv);
  /* 每次打开都落在「求解器」页；搭配沿用上一次用的那套 */
  state.page = 'solve';
  state.demo = !!d.demo;

  if (Array.isArray(d.presets) && d.presets.length) {
    state.presets = mergePresets(d.presets);
    const aid = mapActiveId(d.activeId);
    state.activeId = state.presets.some(p => p.id === aid) ? aid : DEFAULT_PRESET_ID;
  } else {
    /* 旧存档迁移：保留原来的自定义搭配，同时补上三套默认搭配 */
    state.presets = DEFAULT_PRESETS.map(p => makePreset(p));
    const oldCustom = d.custom ? cleanTargets(d.custom) : null;
    const oldTotal = oldCustom ? TAGS.reduce((a, t) => a + (oldCustom[t.k] || 0), 0) : 0;
    if (oldTotal > 0) {
      state.presets.push(makePreset({
        id:'p2',
        name:(d.customName || '我的搭配'),
        desc:'自定义目标',
        builtin:false,
        targets:oldCustom
      }));
    }
    state.activeId = (d.mode === 'custom' && oldTotal > 0) ? 'p2' : DEFAULT_PRESET_ID;
  }
  return true;
}
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !d.inv) return false;
    return applyStore(d);
  } catch (e) { return false; }
}

/* ===== 渲染：页签 ===== */
function renderPage() {
  const box = $('#pageTabs');
  box.innerHTML = '';
  const pages = [
    { k:'solve',  label:'求解器' },
    { k:'custom', label:'目标词条编辑' }
  ];
  pages.forEach(p => {
    const btn = el('button', 'tab', p.label);
    btn.dataset.active = (state.page === p.k) ? '1' : '0';
    btn.onclick = () => {
      if (state.page === p.k) return;
      state.page = p.k;
      renderAll();
    };
    box.appendChild(btn);
  });
  $('#viewSolve').hidden = (state.page !== 'solve');
  $('#viewCustom').hidden = (state.page !== 'custom');
}

/* ===== 渲染：搭配标签（求解器页）===== */
function renderMode() {
  const box = $('#modeSwitch');
  box.innerHTML = '';
  state.presets.forEach(p => {
    const btn = el('button', 'mode-btn', p.name || '未命名');
    const n = presetTotal(p);
    btn.title = (p.desc ? p.desc + '，' : '') + '合计 ' + n + ' 条' + (p.builtin ? '（默认搭配）' : '');
    btn.dataset.active = (state.activeId === p.id) ? '1' : '0';
    btn.onclick = () => {
      if (state.activeId === p.id) {
        state.page = 'custom';
        renderAll();
        return;
      }
      activatePreset(p.id);
    };
    box.appendChild(btn);
  });
  const add = el('button', 'mode-btn', '＋ 新增');
  add.title = '去「目标词条编辑」页新增一套搭配';
  add.onclick = () => { state.page = 'custom'; renderAll(); };
  box.appendChild(add);
}

/* 切换当前搭配并回求解页 */
function activatePreset(id) {
  const p = presetById(id);
  if (presetTotal(p) === 0) {
    state.activeId = id;
    state.page = 'custom';
    state.solIndex = 0;
    renderAll();
    $('#custNote').textContent = '「' + p.name + '」还是 0 条：先把条数填起来，再用它求解。';
    return;
  }
  state.activeId = id;
  state.page = 'solve';
  state.solIndex = 0;
  renderAll();
}

/* ===== 渲染：目标 ===== */
function renderTargets() {
  const box = $('#targetGrid');
  box.innerHTML = '';
  const targets = activeTargets();
  const keys = Object.keys(targets);
  const pill = $('#targetPill');
  const desc = $('#targetDesc');
  if (desc) {
    const note = String(activePreset().desc || '').trim();
    desc.textContent = note ? ('当前搭配备注：' + note) : '';
    desc.hidden = !note;
  }

  if (!keys.length) {
    $('#targetSub').textContent = '';
    pill.textContent = '未设置';
    pill.dataset.state = 'zero';
    return;
  }

  const combo = (LAST && LAST.combos.length) ? LAST.combos[Math.min(state.solIndex, LAST.combos.length - 1)] : null;
  const counts = combo ? LAST.rawCounts(combo) : {};

  keys.forEach(k => {
    const need = targets[k];
    const got = counts[k] || 0;
    const item = el('div', 'target');
    item.dataset.state = got >= need ? 'ok' : (got > 0 ? 'part' : 'zero');
    const nm = el('span', 'tname');
    nm.appendChild(el('i', 'tdot s-' + k));
    nm.appendChild(document.createTextNode(TAGMAP[k].name));
    item.appendChild(nm);
    const val = el('span', 'tval', String(got));
    val.appendChild(el('em', null, '/ ' + need));
    item.appendChild(val);
    const meter = el('span', 'tmeter');
    for (let n = 0; n < need; n++) meter.appendChild(el('i', n < Math.min(got, need) ? 'on' : null));
    item.appendChild(meter);
    box.appendChild(item);
  });

  const totalTarget = keys.reduce((a, k) => a + targets[k], 0);
  const score = LAST ? LAST.maxScore : 0;
  pill.textContent = (score >= totalTarget) ? ('完成 ' + totalTarget + ' / ' + totalTarget + ' 条') : (score + ' / ' + totalTarget + ' 条');
  pill.dataset.state = (score >= totalTarget) ? 'ok' : (score > 0 ? 'part' : 'zero');
  $('#targetSub').textContent = '共 ' + totalTarget + ' 条';
}

/* ===== 渲染：搭配列表（目标词条编辑页）===== */
function renderPresets() {
  const box = $('#presetRow');
  box.innerHTML = '';
  state.presets.forEach(p => {
    const btn = el('button', 'tab');
    btn.appendChild(el('span', 'nm', p.name || '未命名'));
    btn.appendChild(el('span', 'cnt', String(presetTotal(p))));
    btn.title = (p.desc ? p.desc + '，' : '') + '合计 ' + presetTotal(p) + ' 条';
    btn.dataset.active = (state.activeId === p.id) ? '1' : '0';
    btn.onclick = () => {
      state.activeId = p.id;
      state.solIndex = 0;
      renderAll();
    };
    box.appendChild(btn);
  });

  const pill = $('#activePill');
  pill.textContent = '当前：' + activePreset().name;
  pill.dataset.state = 'ok';
}

/* ===== 渲染：编辑当前搭配 ====== */
function renderCustom() {
  const p = activePreset();
  const box = $('#custGrid');
  box.innerHTML = '';
  TAGS.forEach(t => {
    const v = Math.max(0, Math.min(TARGET_MAX, Math.round(Number(p.targets[t.k]) || 0)));
    const cell = el('div', 'cust-cell');
    cell.dataset.on = (v > 0) ? '1' : '0';
    cell.appendChild(el('span', 'cname', t.name));
    const st = el('div', 'stepper');
    const minus = el('button', null, '\u2212');
    minus.title = p.builtin ? '默认搭配不可修改' : '减 1';
    minus.disabled = p.builtin || v <= 0;
    minus.onclick = () => setCustom(t.k, v - 1);
    const val = el('span', 'v', String(v));
    const plus = el('button', null, '+');
    plus.title = p.builtin ? '默认搭配不可修改' : (v >= TARGET_MAX ? '每条最多 3' : '加 1');
    plus.disabled = p.builtin || v >= TARGET_MAX;
    plus.onclick = () => setCustom(t.k, v + 1);
    st.appendChild(minus);
    st.appendChild(val);
    st.appendChild(plus);
    cell.appendChild(st);
    box.appendChild(cell);
  });

  const nameInput = $('#custName');
  if (nameInput && document.activeElement !== nameInput) nameInput.value = p.name || '';
  nameInput.disabled = p.builtin;
  const descInput = $('#custDesc');
  if (descInput && document.activeElement !== descInput) descInput.value = p.desc || '';
  descInput.disabled = p.builtin;

  const total = presetTotal(p);
  const pill = $('#custPill');
  pill.textContent = total + ' / 18 条';
  pill.dataset.state = (total > 18) ? 'over' : (total === 0 ? 'zero' : (total === 18 ? 'ok' : 'part'));
  $('#custSub').textContent = p.builtin ? '· 默认搭配，只读' : '· 可编辑';

  let note = '';
  if (p.builtin) {
    note = '这是默认搭配，条数、名称、备注都锁定；需要别的目标请点上面的「＋ 新增搭配」另存一套。';
  } else if (total === 0) {
    note = '还没填任何要求：全部为 0 时这套搭配没有目标可凑。';
  } else if (total > 18) {
    note = '合计 ' + total + ' 条，超过 6 件 × 3 条 = 18 条的上限，不可能全部达成，请先减到 18 以内。';
  } else if (total === 18) {
    note = '合计 18 条：要求每一条词条都落在目标上，求出来的搭配里件件都是满分件。';
  } else {
    note = '合计 ' + total + ' 条：还有 ' + (18 - total) + ' 条可以放空转词条，求解器仍会优先把目标全部凑齐。';
  }
  $('#custNote').textContent = note;
  $('#btnDelPreset').disabled = p.builtin;
  $('#btnPresetZero').disabled = p.builtin;
  $('#btnDelPreset').title = p.builtin ? '默认搭配不能删除' : '删掉这套搭配';
  renderPresets();
  renderCustomPrev();
}

function renderCustomPrev() {
  const box = $('#custPrev');
  box.innerHTML = '';
  const cur = {};
  const p = activePreset();
  TAGS.forEach(t => {
    const n = Math.max(0, Math.min(TARGET_MAX, Math.round(Number(p.targets[t.k]) || 0)));
    if (n > 0) cur[t.k] = n;
  });
  const keys = Object.keys(cur);
  const total = keys.reduce((a, k) => a + cur[k], 0);
  const pill = $('#prevPill');

  if (!keys.length) {
    pill.textContent = '空';
    pill.dataset.state = 'zero';
    $('#prevSub').textContent = '';
    $('#custDiff').textContent = '还没有设置任何目标词条，这套搭配在求解器里会直接显示「未设置」。';
    return;
  }

  keys.forEach(k => {
    const item = el('div', 'target');
    if (total > 18) item.dataset.state = 'over';
    const nm2 = el('span', 'tname');
    nm2.appendChild(el('i', 'tdot s-' + k));
    nm2.appendChild(document.createTextNode(TAGMAP[k].name));
    item.appendChild(nm2);
    item.appendChild(el('span', 'tval', '\u00d7' + cur[k]));
    box.appendChild(item);
  });

  pill.textContent = total + ' 条';
  pill.dataset.state = (total > 18) ? 'over' : 'ok';
  $('#prevSub').textContent = '· ' + keys.length + ' 类词条';

  const base = presetById(DEFAULT_PRESET_ID).targets;
  const diff = [];
  TAGS.forEach(t => {
    const a = base[t.k] || 0;
    const b = cur[t.k] || 0;
    if (a !== b) diff.push(t.name + ' ' + a + '\u2192' + b);
  });
  $('#custDiff').textContent = (p.id === DEFAULT_PRESET_ID)
    ? '这就是默认搭配「' + DEFAULT_PRESET.name + '」本身。'
    : (diff.length
      ? ('与默认搭配「' + DEFAULT_PRESET.name + '」的差异：' + diff.join('；') + '。')
      : '与默认搭配「' + DEFAULT_PRESET.name + '」的目标完全一致。');
}

function setCustom(k, v) {
  const p = activePreset();
  if (p.builtin) return;
  p.targets[k] = Math.max(0, Math.min(TARGET_MAX, Math.round(v) || 0));
  state.solIndex = 0;
  renderAll();
}

/* 改名称 / 改备注：只对自定义搭配生效，同步到两个页面的标签与说明 */
function commitField(which, v) {
  const p = activePreset();
  if (p.builtin) {
    renderAll();
    $('#custNote').textContent = '默认搭配「' + p.name + '」不能改名，新增一套再改。';
    return;
  }
  const raw = String(v == null ? '' : v).trim().replace(/[\s\u3000]+/g, ' ');
  if (which === 'name') {
    p.name = raw.slice(0, 24) || ('搭配 ' + (state.presets.indexOf(p) + 1));
  } else {
    p.desc = raw.slice(0, 40);
  }
  renderAll();
  $('#custNote').textContent = (which === 'name')
    ? ('名称已保存为「' + p.name + '」，求解器页的标签与说明已同步。')
    : (p.desc ? ('备注已保存：' + p.desc) : '备注已清空，目标卡上会直接显示词条目标。');
}

/* 新增一套搭配：复制当前这套的条数，另存新的（备注留空） */
function addPreset() {
  const cur = activePreset();
  const nid = nextPresetId();
  const np = makePreset({
    id: nid,
    name: '搭配 ' + state.presets.length,
    desc: '',
    builtin: false,
    targets: cur.targets
  }, nid);
  state.presets.push(np);
  state.activeId = np.id;
  state.solIndex = 0;
  renderAll();
  $('#custNote').textContent = '已新增「' + np.name + '」：名字和备注都能改，条数也可以调，用不上了点「删除这套搭配」。';
  const input = $('#custName');
  if (input) input.focus();
}

/* 删除当前这套（默认搭配不可删） */
function delPreset() {
  const p = activePreset();
  if (p.builtin) return;
  if (!confirm('删除搭配「' + p.name + '」？')) return;
  state.presets = state.presets.filter(x => x.id !== p.id);
  if (!state.presets.length) state.presets = [makePreset(DEFAULT_PRESET)];
  state.activeId = DEFAULT_PRESET_ID;
  state.solIndex = 0;
  renderAll();
  $('#custNote').textContent = '已删除，当前切回默认搭配「' + DEFAULT_PRESET.name + '」。';
}

function applyCustom() {
  const p = activePreset();
  if (presetTotal(p) === 0) {
    $('#custNote').textContent = '这套搭配还没填任何要求，先把要凑的词条条数调到 1 以上。';
    return;
  }
  state.page = 'solve';
  state.solIndex = 0;
  renderAll();
}

/* ===== 渲染：添加区 ===== */
function renderSlotTabs() {
  const box = $('#slotTabs');
  box.innerHTML = '';
  SLOTS.forEach(s => {
    const btn = el('button', 'slot-tab', s.label);
    btn.dataset.active = (state.pick.slot === s.key) ? '1' : '0';
    const cnt = el('span', 'cnt', String(state.inv[s.key].length));
    btn.appendChild(cnt);
    btn.onclick = () => { state.pick.slot = s.key; renderSlotTabs(); };
    box.appendChild(btn);
  });
}

function renderTagGrid() {
  const box = $('#tagGrid');
  box.innerHTML = '';
  TAGS.forEach(t => {
    if (t.k === 'OTHER') return;   /* 手动加装备时不给选 Other：认不出的词条由识别自己记 */
    const at = state.pick.lines.indexOf(t.k);
    const btn = el('button', 'tbtn s-' + t.k.toLowerCase(), t.name);
    btn.dataset.group = t.group;
    btn.dataset.selected = (at >= 0) ? '1' : '0';
    if (at >= 0) btn.dataset.order = String(at + 1);
    btn.onclick = () => toggleTag(t.k);
    box.appendChild(btn);
  });
}

function renderPreview() {
  /* 选中了哪几条只在词条按钮上的角标里体现 */
  const n = state.pick.lines.length;
  $('#addBtn').disabled = (n !== 3);
  const pill = $('#pickPill');
  if (pill) {
    pill.textContent = n + ' / 3 条';
    pill.dataset.state = (n === 3) ? 'ok' : (n > 0 ? 'part' : 'zero');
  }
}

function toggleTag(k) {
  const lines = state.pick.lines;
  const at = lines.indexOf(k);
  if (at >= 0) lines.splice(at, 1);
  else if (lines.length < 3) lines.push(k);
  renderTagGrid();
  renderPreview();
}

function addPiece() {
  if (state.pick.lines.length !== 3) return;
  state.inv[state.pick.slot].push({ lines:state.pick.lines.slice() });
  state.pick.lines = [];
  state.demo = false;
  state.solIndex = 0;
  renderAll();
}

/* ===== 渲染：库存 ===== */
function renderInventory() {
  const box = $('#invList');
  box.innerHTML = '';
  let total = 0;
  SLOTS.forEach(s => {
    const list = state.inv[s.key];
    total += list.length;
    const wrap = el('div', 'inv-slot');
    const h = el('h3', null, s.label);
    h.appendChild(el('span', null, list.length + ' 件'));
    wrap.appendChild(h);
    if (!list.length) {
      wrap.appendChild(el('div', 'inv-none', '还没有'));
    } else {
      list.forEach((p, i) => {
        const row = el('div', 'inv-item');
        row.appendChild(el('span', 'idx', '#' + (i + 1)));
        const chips = el('div', 'chips');
        p.lines.forEach(k => chips.appendChild(chipNode(k, false)));
        row.appendChild(chips);
        const del = el('button', 'del', '\u00d7');
        del.title = '删除';
        del.onclick = () => {
          state.inv[s.key].splice(i, 1);
          state.demo = false;
          state.solIndex = 0;
          /* 从库存里删掉后，这件再被识别到要能重新入库 */
          delete SCAN.seen[s.key + '|' + scanSig(p.lines)];
          SCAN.lastSig = null;
          SCAN.lastHash = '';
          renderAll();
        };
        row.appendChild(del);
        wrap.appendChild(row);
      });
    }
    box.appendChild(wrap);
  });
  $('#invPill').textContent = total + ' 件';
  $('#invSub').textContent = state.demo ? '示例数据' : '';
}

/* ===== 渲染：再添一件就能齐 =====
   逐部位验证：把该部位现有那件（若有）拿走，再补 1 件进去，剩余缺口是否
   能被一件装备（最多 3 条互不相同的词条）一次补满。空位和已有装备的部位都算。 */
function renderGapPanel(combo, counts) {
  const card = $('#gapCard');
  const body = $('#gapBody');
  const pill = $('#gapPill');
  const sub = $('#gapSub');
  body.innerHTML = '';
  card.hidden = true;
  sub.textContent = '';

  if (!LAST || !LAST.combos.length || LAST.maxScore >= LAST.totalTarget) return;

  const chosen = {};
  combo.forEach(step => { chosen[step.slot] = step; });

  const cands = [];
  SLOTS.forEach((s, i) => {
    const step = chosen[i];
    const isEmpty = !step;
    if (isEmpty && LAST.emptySlots.indexOf(s.label) < 0) return;
    const base = {};
    LAST.keys.forEach(k => { base[k] = counts[k] || 0; });
    if (step) step.piece.lines.forEach(k => { if (base[k] !== undefined) base[k] -= 1; });

    const need = [];
    let ok = true;
    LAST.keys.forEach(k => {
      const miss = LAST.targets[k] - base[k];
      if (miss > 0) {
        if (miss > 1) ok = false;   /* 同一件不会出现两条相同词条，补不上 */
        need.push(k);
      }
    });
    if (!ok || !need.length || need.length > 3) return;
    cands.push({ label:s.label, tags:need, idx:step ? step.pieceIndex + 1 : 0 });
  });

  if (!cands.length) return;
  card.hidden = false;
  pill.dataset.state = 'part';
  pill.textContent = '差 1 件';
  sub.textContent = ' · ' + cands.length + ' 个部位可选';

  body.appendChild(el('p', 'gap-hint',
    '下面这些部位再添 1 件就能凑满目标：这件只要带齐该行词条即可，多出来的词条不计数。'));

  cands.forEach(c => {
    const row = el('div', 'gap-row');
    row.appendChild(el('div', 'k', c.label));
    const chips = el('div', 'chips');
    c.tags.forEach(k => chips.appendChild(chipNode(k, false)));
    row.appendChild(chips);
    row.appendChild(el('div', 'rep', c.idx ? ('换掉 #' + c.idx) : '空位补 1 件'));
    body.appendChild(row);
  });
}

/* ===== 渲染：结果 ===== */
function renderResult() {
  const body = $('#resultBody');
  const pill = $('#resultPill');
  body.innerHTML = '';
  $('#gapCard').hidden = true;
  $('#gapBody').innerHTML = '';

  if (!LAST || LAST.ways === 0) {
    pill.textContent = LAST ? '待补齐' : '未设置';
    pill.dataset.state = 'zero';
    const p = el('p', 'empty');
    if (!LAST) {
      p.textContent = '这套搭配还没有目标词条：去右上角「目标词条编辑」页填起来，或切换到别的搭配。';
    } else if (!LAST.emptySlots.length) {
      p.textContent = '暂时没有可行搭配。';
    } else {
      p.textContent = '这些部位还没有装备：' + LAST.emptySlots.join('、') + '。先在「加一件装备」里补上，或用识别加进来。';
    }
    body.appendChild(p);
    return;
  }

  const combo = LAST.combos[Math.min(state.solIndex, LAST.combos.length - 1)];
  const counts = LAST.rawCounts(combo);
  const complete = LAST.maxScore >= LAST.totalTarget;

  const status = el('div', 'status');
  const big = el('b', complete ? 'ok' : '', LAST.maxScore + ' / ' + LAST.totalTarget + ' 条');
  status.appendChild(big);
  status.appendChild(document.createTextNode(complete ? ' · 目标全部达成' : ' · 已拿下的目标条数'));
  body.appendChild(status);

  const bar = el('div', 'score-bar' + (complete ? ' ok' : ''));
  const fill = el('i');
  const pct = LAST.totalTarget ? (LAST.maxScore / LAST.totalTarget) * 100 : 0;
  fill.style.width = Math.max(2, Math.min(100, pct)) + '%';
  bar.appendChild(fill);
  body.appendChild(bar);

  const shown = Math.min(LAST.ways, LAST.combos.length);
  const sub = el('div', 'status');
  let subText;
  if (complete) {
    subText = '可行方案共 ' + LAST.ways + ' 套';
    if (LAST.ways > 1) {
      subText += (shown < LAST.ways) ? ('，下方可浏览前 ' + shown + ' 套。') : '，用下方按钮切换查看。';
    } else {
      subText += '。';
    }
  } else {
    subText = '共 ' + LAST.ways + ' 套同等最优的搭配。';
  }
  sub.appendChild(document.createTextNode(subText));
  body.appendChild(sub);

  pill.textContent = complete ? '完成' : '最优';
  pill.dataset.state = complete ? 'ok' : 'part';

  if (shown > 1) {
    const nav = el('div', 'nav');
    const prev = el('button', 'ghost', '\u2190 上一套');
    const next = el('button', 'ghost', '下一套 \u2192');
    const label = el('span', 'label', '方案 ' + (Math.min(state.solIndex, LAST.combos.length - 1) + 1) + ' / ' + shown);
    prev.disabled = false;
    prev.onclick = () => {
      state.solIndex = (state.solIndex - 1 + LAST.combos.length) % LAST.combos.length;
      renderAll();
    };
    next.onclick = () => {
      state.solIndex = (state.solIndex + 1) % LAST.combos.length;
      renderAll();
    };
    nav.appendChild(prev); nav.appendChild(label); nav.appendChild(next);
    body.appendChild(nav);
  }

  /* 逐件展示，标出哪条真正计入目标 */
  const running = {};
  LAST.keys.forEach(k => { running[k] = 0; });
  const sol = el('div', 'sol');
  combo.forEach(step => {
    const row = el('div', 'sol-row');
    row.appendChild(el('div', 'slot', SLOTS[step.slot].label));
    row.appendChild(el('div', 'tagno', '#' + (step.pieceIndex + 1)));
    const chips = el('div', 'chips');
    step.piece.lines.forEach(k => {
      let counted = false;
      if (LAST.targets[k] !== undefined && running[k] < LAST.targets[k]) {
        running[k] += 1;
        counted = true;
      }
      chips.appendChild(chipNode(k, !counted));
    });
    row.appendChild(chips);
    sol.appendChild(row);
  });
  body.appendChild(sol);

  renderGapPanel(combo, counts);
}

/* ===== 主渲染 ===== */
function renderAll() {
  const pieces = SLOTS.map(s => state.inv[s.key] || []);
  const targets = activeTargets();
  LAST = Object.keys(targets).length ? solveSet(pieces, targets, 40) : null;
  if (!LAST || !LAST.combos.length) state.solIndex = 0;
  else if (state.solIndex >= LAST.combos.length) state.solIndex = 0;
  renderPage();
  renderMode();
  renderTargets();
  renderSlotTabs();
  renderTagGrid();
  renderPreview();
  renderInventory();
  renderResult();
  renderCustom();
  renderScan();
  save();
}

/* ===== 工具按钮 ===== */
function loadDemo() {
  state.inv = normalizeInv(demoInv());
  state.demo = true;
  state.solIndex = 0;
  renderAll();
}
function clearInv() {
  state.inv = emptyInv();
  state.demo = false;
  state.solIndex = 0;
  /* 清空库存后，之前判过的重复不再算重复 */
  SCAN.seen = Object.create(null);
  SCAN.dups = Object.create(null);
  renderAll();
}
function exportJson() {
  const data = JSON.stringify({
    version:5, activeId:state.activeId, presets:state.presets, inv:state.inv
  }, null, 2);
  const blob = new Blob([data], { type:'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Q区装备库存.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(String(reader.result));
      const inv = normalizeInv(d && d.inv ? d.inv : d);
      state.inv = inv;
      state.demo = false;
      if (d && Array.isArray(d.presets) && d.presets.length) {
        state.presets = mergePresets(d.presets);
        const aid = mapActiveId(d.activeId);
        state.activeId = state.presets.some(p => p.id === aid) ? aid : DEFAULT_PRESET_ID;
      }
      state.solIndex = 0;
      renderAll();
    } catch (e) {
      alert('读取失败：文件不是有效的库存 JSON。');
    }
  };
  reader.readAsText(file, 'utf-8');
}

/* ===== 识别录入：窗口共享 + OCR ===== */
const OCR_CDN = {
  script:'https://fastly.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
  worker:'https://fastly.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  core:'https://fastly.jsdelivr.net/npm/tesseract.js-core@5.1.0',
  lang:'https://fastly.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'
};
const SCAN = {
  stream:null, raf:null, timer:null, drawing:false,
  rect:null, drag:null,
  panelOpen:false, auto:true,
  worker:null, loading:null,
  lastHash:'', lastAt:0, busy:false,
  records:[], seq:0, raw:'', sessionAdded:0, sessionRecognized:0,
  seen:Object.create(null), dups:Object.create(null), skipped:0, diag:[],
  prevGrid:null, lastBox:null, queue:[], holdUntil:0, missCount:0, lastSig:null, lastEnqAt:0
};

function scanSig(lines) { return lines.slice().sort().join('|'); }
/* 识别诊断日志：引擎加载、窗口共享、每帧 OCR 结果、异常，都记在页面里，方便复制反馈 */
function dlog(msg) {
  const d = new Date();
  const p2 = n => (n < 10 ? '0' + n : '' + n);
  const ts = p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds());
  SCAN.diag.push(ts + ' ' + msg);
  if (SCAN.diag.length > 200) SCAN.diag.shift();
  const box = $('#scanDiagBody');
  if (box) { box.value = SCAN.diag.join('\n'); box.scrollTop = box.scrollHeight; }
}
window.addEventListener('error', e => {
  dlog('页面异常 ' + (e && e.message ? e.message : '') + (e && e.filename ? ' @' + String(e.filename).split('/').pop() + ':' + e.lineno : ''));
});
window.addEventListener('unhandledrejection', e => {
  const r = e && e.reason;
  dlog('未处理的 Promise 错误 ' + (r && (r.message || r) ? (r.message || r) : r));
});
function scanNote(text) {
  const n = $('#scanNote');
  if (n) n.textContent = text || '';
}
function setScanPill(text, st) {
  const p = $('#scanPill');
  if (!p) return;
  p.textContent = '';
  /* 识别中：前面转个小圈，后面跟三个跳动的点，配合外圈呼吸光 */
  if (st === 'part') {
    const s = document.createElement('span');
    s.className = 'scan-spin';
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="42 10"/></svg>';
    p.appendChild(s);
  }
  p.appendChild(document.createTextNode(text));
  if (st === 'part') {
    const d = document.createElement('span');
    d.className = 'scan-dots';
    for (let i = 0; i < 3; i++) d.appendChild(document.createElement('i'));
    p.appendChild(d);
  }
  p.dataset.state = st || 'zero';
}
function setEngine(text) {
  const n = $('#scanEngine');
  if (n) n.textContent = '识别引擎：' + text;
}

/* --- 识别引擎（点开始时才联网加载，页面本身仍可离线用） --- */
function loadOcrScript() {
  if (window.Tesseract) return Promise.resolve();
  if (SCAN.loading) return SCAN.loading;
  dlog('开始加载识别脚本 ' + OCR_CDN.script.split('/').slice(-2).join('/'));
  SCAN.loading = new Promise((resolve, reject) => {
    let settled = false;
    const s = document.createElement('script');
    s.src = OCR_CDN.script;
    s.onload = () => { if (!settled) { settled = true; dlog('识别脚本已就绪'); resolve(); } };
    s.onerror = () => {
      if (!settled) {
        settled = true; SCAN.loading = null;
        dlog('识别脚本下载失败（需要联网 / 会被墙）');
        reject(new Error('识别引擎下载失败，请联网后重试'));
      }
    };
    document.head.appendChild(s);
    setTimeout(() => {
      if (!settled) {
        settled = true; SCAN.loading = null;
        dlog('识别脚本加载超时 30s');
        reject(new Error('识别引擎加载超时，请检查网络'));
      }
    }, 30000);
  });
  return SCAN.loading;
}

async function makeWorker() {
  setEngine('加载中…');
  await loadOcrScript();
  if (!window.Tesseract) throw new Error('识别引擎不可用');
  dlog('创建识别引擎（首次约 7MB，耐心等）');
  const worker = await Tesseract.createWorker('eng', 1, {
    workerPath: OCR_CDN.worker,
    corePath: OCR_CDN.core,
    langPath: OCR_CDN.lang,
    logger: m => {
      if (!m) return;
      if (m.status === 'loading language traineddata') {
        setEngine('加载语言包 ' + Math.round((m.progress || 0) * 100) + '%');
        const p = Math.round((m.progress || 0) * 100);
        if (p === 0 || p >= 100 || p % 25 === 0) dlog('语言包 ' + p + '%');
      } else if (m.status === 'initializing api') {
        setEngine('初始化…');
      }
    }
  });
  try {
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+%.: ',
      preserve_interword_spaces: '1',
      /* 一块浮窗就是一段整齐的文字块：用单块模式 + 关掉词典，读得更快，连续划过多件不积压 */
      tessedit_pageseg_mode: '6',
      load_system_dawg: '0',
      load_freq_dawg: '0',
      user_defined_dawg: '0'
    });
  } catch (e) { dlog('setParameters 跳过：' + ((e && e.message) || e)); }
  SCAN.worker = worker;
  setEngine('就绪');
  dlog('识别引擎就绪');
  return worker;
}

/* 同一时间只建一个引擎：采集每秒问好几次，没这个锁一秒能建出十几个，
   互相抢 CPU，页面卡到连识别中的动画都停住 */
function ensureWorker() {
  if (SCAN.worker) return Promise.resolve(SCAN.worker);
  if (!SCAN.workerP) {
    SCAN.workerP = makeWorker().then(
      w => { SCAN.workerP = null; return w; },
      e => { SCAN.workerP = null; throw e; }
    );
  }
  return SCAN.workerP;
}

/* --- 窗口共享 --- */
async function grabGameWindow() {
  /* displaySurface 是给选择器的提示：让它默认停在「窗口 / 程序」这一页 */
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      video:{ displaySurface:'window', frameRate:{ ideal:15, max:30 } }, audio:false
    });
  } catch (e) {
    /* 用户自己取消就别再弹一次；只是这个提示不被支持时才退回普通参数 */
    if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) throw e;
    return navigator.mediaDevices.getDisplayMedia({
      video:{ frameRate:{ ideal:15, max:30 } }, audio:false
    });
  }
}

async function startScan() {
  dlog('环境：' + location.protocol + ' 安全上下文=' + (window.isSecureContext ? '是' : '否')
    + ' mediaDevices=' + !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia));
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    dlog('当前环境不支持 getDisplayMedia');
    scanNote('这个浏览器不支持共享窗口，请用 Chrome / Edge，或改用下面的截图识别。');
    return;
  }
  setScanPill('选择窗口…', 'part');
  scanNote('在弹出的列表里选中游戏窗口（默认就停在「窗口」这一页）。');
  dlog('请求共享窗口（displaySurface:window）');
  try {
    SCAN.stream = await grabGameWindow();
  } catch (e) {
    SCAN.stream = null;
    setScanPill('未开始', 'zero');
    dlog('共享窗口失败 ' + ((e && e.name) || 'Error') + '：' + ((e && e.message) || ''));
    scanNote('没能共享窗口（' + ((e && e.name) || 'Error') + '）。'
      + (location.protocol === 'file:' ? '本地双击打开（file://）时浏览器可能不允许共享窗口，可以改用下面的截图识别，或打开在线版。' : '可以再点一次，或者改用截图识别。'));
    return;
  }

  const video = $('#scanVideo');
  const canvas = $('#scanCanvas');
  video.srcObject = SCAN.stream;
  try { await video.play(); } catch (e) { /* 静音 autoplay 一般不会失败 */ }
  canvas.hidden = false;
  $('#scanHint').hidden = true;
  $('#scanRect').style.display = SCAN.rect ? 'block' : 'none';
  $('#btnScanStop').disabled = false;
  $('#btnScanStart').disabled = true;
  $('#btnScanRect').disabled = false;
  setScanPill('运行中', 'ok');
  SCAN.seen = Object.create(null);
  SCAN.dups = Object.create(null);
  SCAN.skipped = 0;
  SCAN.records = [];
  SCAN.seq = 0;
  SCAN.sessionAdded = 0;
  SCAN.sessionRecognized = 0;
  SCAN.lastHash = '';
  SCAN.lastSig = null;
  SCAN.lastEnqAt = 0;
  SCAN.prevGrid = null;
  SCAN.lastBox = null;
  SCAN.queue = [];
  SCAN.holdUntil = 0;
  SCAN.missCount = 0;
  scanNote(SCAN.rect
    ? '正在识别，把装备浮窗停在方框里；划过的每一件都会自动录入，重复的会跳过。'
    : '整窗识别中：划过一件装备就会录入一件，重复的会跳过，直到你点「停止」。框选一块浮窗区域会更快更准。');
  renderScanLog();

  const track = SCAN.stream.getVideoTracks()[0];
  if (track) {
    track.onended = stopScan;
    const st = track.getSettings ? track.getSettings() : {};
    dlog('共享开始：' + (track.label || '窗口') + ' ' + (st.width || '?') + 'x' + (st.height || '?'));
  }

  if (SCAN.raf) cancelAnimationFrame(SCAN.raf);
  let last = 0;
  const paint = ts => {
    if (!SCAN.stream) return;
    if (ts - last > PREVIEW_MS) {   /* 页面上这块预览按 3 帧/秒刷新，识别仍按视频原始帧走 */
      last = ts;
      if (video.videoWidth && canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      if (canvas.width) canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    }
    SCAN.raf = requestAnimationFrame(paint);
  };
  SCAN.raf = requestAnimationFrame(paint);

  if (SCAN.timer) clearInterval(SCAN.timer);
  SCAN.timer = setInterval(ocrTick, 150);   /* 每件浮窗可能只停 200ms，采集得比它快 */

  try { ensureWorker(); } catch (e) { /* 错误在 ocrTick 里统一提示 */ }
}

function stopScan() {
  if (SCAN.stream) {
    SCAN.stream.getTracks().forEach(t => t.stop());
    SCAN.stream = null;
  }
  if (SCAN.raf) { cancelAnimationFrame(SCAN.raf); SCAN.raf = null; }
  if (SCAN.timer) { clearInterval(SCAN.timer); SCAN.timer = null; }
  SCAN.holdUntil = 0;
  SCAN.missCount = 0;
  $('#btnScanStop').disabled = true;
  $('#btnScanStart').disabled = false;
  $('#btnScanRect').disabled = true;
  /* 已拍下的浮窗不丢，继续读完再收工；这里只报真实已识别数量，不拿队列截图数冒充装备数 */
  if (SCAN.queue.length) {
    setScanPill('收尾识别 · 已识别 ' + SCAN.sessionRecognized + ' 件', 'part');
    scanNote('已停止共享窗口，正在读完剩余的截图……');
    dlog('已停止共享，队列里还有 ' + SCAN.queue.length + ' 张截图要读');
    pumpOcr();
    return;
  }
  setScanPill('已停止', 'zero');
  const added = SCAN.sessionAdded;
  scanNote('已停止共享窗口。本次录入 ' + added + ' 件'
    + (SCAN.skipped ? '，跳过重复 ' + SCAN.skipped + ' 次' : '') + '，都留在库存里。');
}

/* --- 截取区域 / 变化检测 --- */
function cropCanvas() {
  const video = $('#scanVideo');
  if (!video.videoWidth) return null;
  const rect = SCAN.rect || { x:0, y:0, w:1, h:1 };
  const vw = video.videoWidth, vh = video.videoHeight;
  const sx = Math.round(rect.x * vw);
  const sy = Math.round(rect.y * vh);
  const sw = Math.max(8, Math.round(rect.w * vw));
  const sh = Math.max(8, Math.round(rect.h * vh));
  const c = document.createElement('canvas');
  c.width = Math.min(sw, vw - sx);
  c.height = Math.min(sh, vh - sy);
  const g = c.getContext('2d');
  g.drawImage(video, sx, sy, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

function hashCanvas(c) {
  const t = document.createElement('canvas');
  t.width = 24; t.height = 10;
  const g = t.getContext('2d');
  g.drawImage(c, 0, 0, 24, 10);
  let d;
  try { d = g.getImageData(0, 0, 24, 10).data; } catch (e) { return String(Date.now()); }
  let h = '';
  for (let i = 0; i < d.length; i += 4) {
    h += ((d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) >> 4) & 15;
  }
  return h;
}

/* 粗签名：32x16 的灰度格子，用来判断「还是不是同一件浮窗」。
   游戏画面每帧有细微抖动，逐像素哈希会一路误判成新浮窗，把队列塞爆。 */
function sigOf(c) {
  const t = document.createElement('canvas');
  t.width = 32; t.height = 16;
  const g = t.getContext('2d');
  g.drawImage(c, 0, 0, 32, 16);
  let d;
  try { d = g.getImageData(0, 0, 32, 16).data; } catch (e) { return null; }
  const out = [];
  for (let i = 0; i < d.length; i += 4) out.push((d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) / 15);
  return out;
}

function sigChanged(a, b) {
  if (!a || !b || a.length !== b.length) return 999;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += b[i] - a[i];
  const mean = sum / a.length;           /* 整体亮度变了（掉帧、色偏）不算换件 */
  let n = 0;
  for (let i = 0; i < a.length; i++) if (Math.abs(b[i] - a[i] - mean) > 9) n++;
  return n;
}

/* --- 自动找浮窗：整窗共享时只看「刚刚变化的那一块」，把装备浮窗切出来再 OCR --- */
const GRID = 40;
function grabGrid() {
  const canvas = $('#scanCanvas');
  if (!canvas || !canvas.width) return null;
  const t = document.createElement('canvas');
  t.width = GRID; t.height = GRID;
  const g = t.getContext('2d');
  g.drawImage(canvas, 0, 0, GRID, GRID);
  try { return g.getImageData(0, 0, GRID, GRID).data; } catch (e) { return null; }
}

function changedBox(a, b) {
  const mask = new Uint8Array(GRID * GRID);
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = (y * GRID + x) * 4;
      const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      if (d > 30) mask[y * GRID + x] = 1;
    }
  }
  /* 取最大的一块连通区域：浮窗出现 / 消失是两块，别把它们拼成超宽的一条 */
  const seen = new Uint8Array(GRID * GRID);
  let best = null;
  for (let k = 0; k < mask.length; k++) {
    if (!mask[k] || seen[k]) continue;
    const stack = [k];
    seen[k] = 1;
    let n = 0, minx = GRID, miny = GRID, maxx = -1, maxy = -1;
    while (stack.length) {
      const p = stack.pop();
      const x = p % GRID, y = (p - x) / GRID;
      n++;
      if (x < minx) minx = x;
      if (x > maxx) maxx = x;
      if (y < miny) miny = y;
      if (y > maxy) maxy = y;
      const nb = [[x-1,y], [x+1,y], [x,y-1], [x,y+1]];
      for (let t = 0; t < 4; t++) {
        const nx = nb[t][0], ny = nb[t][1];
        if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
        const q = ny * GRID + nx;
        if (mask[q] && !seen[q]) { seen[q] = 1; stack.push(q); }
      }
    }
    if (!best || n > best.n) best = { n:n, x0:minx, y0:miny, x1:maxx, y1:maxy };
  }
  return best;
}

/* 返回一块「刚变了」的浮窗区域画布；变化太小（只是光标/动画）就返回 null */
function autoCrop() {
  const canvas = $('#scanCanvas');
  if (!canvas || !canvas.width) return null;
  const grid = grabGrid();
  if (!grid) return null;
  const prev = SCAN.prevGrid;
  SCAN.prevGrid = grid;
  if (!prev) return null;
  const box = changedBox(prev, grid);
  if (!box || box.n < 8) return null;
  const W = canvas.width, H = canvas.height;
  const cw = W / GRID, ch = H / GRID;
  let x0 = Math.max(0, Math.floor(box.x0 * cw) - 16);
  let y0 = Math.max(0, Math.floor(box.y0 * ch) - 16);
  let x1 = Math.min(W, Math.ceil((box.x1 + 1) * cw) + 16);
  let y1 = Math.min(H, Math.ceil((box.y1 + 1) * ch) + 16);
  /* 同一位置的浮窗换了一件：只有几行字变了，沿用上一块浮窗的范围重读 */
  if (box.n < 40) {
    const lb = SCAN.lastBox;
    if (!lb) return null;
    const hit = x1 > lb.x && x0 < lb.x + lb.w && y1 > lb.y && y0 < lb.y + lb.h;
    if (!hit) return null;
    x0 = Math.max(0, lb.x - 12);
    y0 = Math.max(0, lb.y - 12);
    x1 = Math.min(W, lb.x + lb.w + 12);
    y1 = Math.min(H, lb.y + lb.h + 12);
  }
  if (x1 - x0 < 160 || y1 - y0 < 160) return null;
  /* 浮窗常常只露出一截（下半截上一件还在屏上时，只有标题那几行算「变化」），
     词条在标题下面，所以往下补到整块浮窗的高度再读，别只截到标题 */
  if (y1 - y0 < 820) y1 = Math.min(H, y0 + 820);
  /* 整窗都变了（切场景/滚动背包）就别读了，白花几秒 */
  if ((x1 - x0) * (y1 - y0) > W * H * 0.35) return null;
  const c = document.createElement('canvas');
  c.width = x1 - x0;
  c.height = y1 - y0;
  c.getContext('2d').drawImage(canvas, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  if (box.n >= 40) SCAN.lastBox = { x:x0, y:y0, w:c.width, h:c.height };
  return c;
}

/* 两件浮窗并排（对比穿在身上的那件）时只认左边这件：
   只看浮窗「标题那一行」的 Supercharged（下面套装加成那行也带这个词，不能算），
   两个标题的中心 x 差得够远，才在中间切一刀 */
function leftOfSecondPanel(c, words) {
  const W = c.width, H = c.height;
  const xs = [];
  (words || []).forEach(w => {
    const u = String(w.text || '').toUpperCase();
    if (u.indexOf('SUPERCHARGED') === 0 && w.bbox.y0 < H * 0.3) {
      xs.push((w.bbox.x0 + w.bbox.x1) / 2);
    }
  });
  if (xs.length < 2) return null;
  xs.sort((a, b) => a - b);
  let gap = 0, cut = 0;
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] - xs[i - 1] > gap) { gap = xs[i] - xs[i - 1]; cut = (xs[i] + xs[i - 1]) / 2; }
  }
  if (gap < Math.max(W * 0.3, 220)) return null;
  const split = Math.round(cut);
  if (split < 150 || split > W - 60) return null;
  const out = document.createElement('canvas');
  out.width = split;
  out.height = c.height;
  out.getContext('2d').drawImage(c, 0, 0, split, c.height, 0, 0, split, c.height);
  return out;
}

/* 按标题那一行定位整块浮窗：x 从标题左边留 36px，宽最多 560（一块浮窗的宽度），高最多 900 */
function panelFromTitle(c, words) {
  if (!c) return null;
  let ty = null;
  (words || []).forEach(w => {
    const u = String(w.text || '').toUpperCase();
    if (u.indexOf('SUPERCHARGED') < 0) return;
    if (!ty || w.bbox.y0 < ty.y0) ty = w.bbox;
  });
  if (!ty) return null;
  const x = Math.max(0, Math.round(ty.x0) - 36);
  const y = Math.max(0, Math.round(ty.y0) - 30);
  const w2 = Math.min(c.width - x, 560);
  const h2 = Math.min(c.height - y, 900);
  if (w2 < 200 || h2 < 240) return null;
  const out = document.createElement('canvas');
  out.width = w2;
  out.height = h2;
  out.getContext('2d').drawImage(c, x, y, w2, h2, 0, 0, w2, h2);
  return out;
}

/* 从 OCR 文本里取装备名（Supercharged 后面那段的字母），用来比对是不是同一件 */
function itemTitle(t) {
  const s = String(t || '').replace(/\s+/g, '');
  const i = s.search(/SUPERCHARGED/i);
  if (i < 0) return '';
  return s.slice(i, i + 30).replace(/[^A-Za-z]/g, '').toLowerCase().slice(0, 20);
}

/* 截取和识别分开：采集按固定节拍「拍」当前浮窗，内容变了才进队列让 OCR 读。
   一次 OCR 要一秒多，采集不等它，所以连续划过多件也不漏。 */
const QUEUE_MAX = 40;              /* 最多排队等识别的截图数（约 20 件，换件时会多拍一张空背景） */
const PREVIEW_MS = 333;            /* 页面上游戏画面按 3 帧/秒刷新，识别仍按视频原始帧走 */

function enqueueCrop(c) {
  if (SCAN.queue.length >= QUEUE_MAX) return false;       /* 队列最多排 40 张截图，塞满时先不拍 */
  const sig = sigOf(c);
  if (sigChanged(sig, SCAN.lastSig) < 20) return false;   /* 还是那件浮窗（只是画面抖动/闪光） */
  if (Date.now() - SCAN.lastEnqAt < 100) return false;   /* 一秒拍几十张会把队列塞爆 */
  SCAN.lastSig = sig;
  SCAN.lastEnqAt = Date.now();
  SCAN.queue.push({ canvas:c, at:Date.now() });
  dlog('拍下浮窗 ' + c.width + 'x' + c.height + '，队列 ' + SCAN.queue.length);
  return true;
}

/* 按坐标取一块画面（定点持续监视用） */
function cropBox(b) {
  const canvas = $('#scanCanvas');
  if (!canvas || !canvas.width || !b) return null;
  const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y);
  const w = Math.min(canvas.width - x0, b.w), h = Math.min(canvas.height - y0, b.h);
  if (w < 160 || h < 160) return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(canvas, x0, y0, w, h, 0, 0, w, h);
  return c;
}

/* 一次采集：框选就按框读；否则先找刚变化的浮窗，没变化但已锁定区域就按定点读 */
function captureOnce() {
  if (!SCAN.stream || !SCAN.panelOpen || state.page !== 'solve') return;
  let c = null;
  if (SCAN.rect) {
    c = cropCanvas();
  } else {
    c = autoCrop();
    if (!c && SCAN.lastBox && Date.now() < SCAN.holdUntil) c = cropBox(SCAN.lastBox);
  }
  if (c) enqueueCrop(c);
}

function ocrTick() {
  if (!SCAN.stream || !SCAN.panelOpen || state.page !== 'solve') return;
  if (!SCAN.worker) {
    ensureWorker().catch(e => {
      setEngine('不可用（需要联网）');
      dlog('引擎初始化失败：' + ((e && e.message) || e));
    });
  }
  captureOnce();
  pumpOcr();
}

async function pumpOcr() {
  if (SCAN.busy || !SCAN.queue.length || !SCAN.worker) return;
  const job = SCAN.queue.shift();
  SCAN.busy = true;
  setScanPill((SCAN.stream ? '识别中' : '收尾识别') + ' · 已识别 ' + SCAN.sessionRecognized + ' 件', 'part');
  try {
    let r = await SCAN.worker.recognize(job.canvas);
    let txt = r.data.text;
    let note = '';
    let cur = job.canvas;
    /* 两件并排显示时只认左边那件，切掉右边再读一遍 */
    const lp = leftOfSecondPanel(job.canvas, r.data.words);
    if (lp) {
      r = await SCAN.worker.recognize(lp);
      txt = r.data.text;
      cur = lp;
      note = ' 只读左边的浮窗';
      dlog('检测到两件浮窗，只读左边那件（' + lp.width + 'px 宽）');
    }
    /* 只读到装备名、词条一条都没认出来：按标题在「同一张截图」里重切一块整浮窗再读。
       用同一张图是为了不把鼠标已经移到的下一件读成这一件 */
    if (!parseItemTags(txt).detected && /SUPERCHARGED|LIBAE/i.test(txt || '')) {
      const pc = panelFromTitle(cur, r.data.words);
      if (pc) {
        dlog('词条没读全，按标题重切浮窗重读（' + pc.width + 'x' + pc.height + '）');
        r = await SCAN.worker.recognize(pc);
        const t2 = r.data.text;
        if (parseItemTags(t2).detected && itemTitle(t2) === itemTitle(txt)) {
          txt = t2;
          note += ' 重切重读';
        }
      }
    }
    dlog('OCR ' + job.canvas.width + 'x' + job.canvas.height + note + ' 读到 '
      + String(txt || '').replace(/\s+/g, ' ').trim().slice(0, 90));
    /* 读到装备名就锁定这块浮窗继续盯着，连续两次读不到就放开 */
    if (/SUPERCHARGED|HOLOGRAM|LIBAE/i.test(txt || '')) {
      SCAN.missCount = 0;
      SCAN.holdUntil = Date.now() + 5000;
    } else {
      SCAN.missCount++;
      if (SCAN.missCount >= 2) { SCAN.holdUntil = 0; SCAN.missCount = 0; }
    }
    handleOcrText(txt, '窗口');
  } catch (e) {
    scanNote('识别出错：' + ((e && e.message) || e));
    dlog('OCR 出错：' + ((e && e.message) || e));
  } finally {
    SCAN.busy = false;
    if (!SCAN.queue.length) {
      setScanPill(SCAN.stream ? ('运行中 · 已识别 ' + SCAN.sessionRecognized + ' 件') : '已停止', SCAN.stream ? 'ok' : 'zero');
    } else {
      setScanPill((SCAN.stream ? '识别中' : '收尾识别') + ' · 已识别 ' + SCAN.sessionRecognized + ' 件', 'part');
    }
    /* 一次识别一块，读完后稍歇再取下一块，别把 CPU 全占满让人物卡住 */
    if (SCAN.queue.length) setTimeout(pumpOcr, 80);
    else if (!SCAN.stream) {
      const added = SCAN.sessionAdded;
      scanNote('已停止共享窗口。本次录入 ' + added + ' 件'
        + (SCAN.skipped ? '，跳过重复 ' + SCAN.skipped + ' 次' : '') + '，都留在库存里。');
    }
  }
}

/* --- 文本 → 词条 --- */
function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  let cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j] + 1, ins = cur[j - 1] + 1, sub = prev[j - 1] + cost;
      cur[j] = del < ins ? (del < sub ? del : sub) : (ins < sub ? ins : sub);
    }
    const tmp = prev; prev = cur; cur = tmp;
  }
  return prev[n];
}

/* 词条别名：按「整词 / 相邻整词」比对，避免 DAMAGE 里拆出 MAGE 这种误判 */
const TAG_ALIAS = [
  { k:'DL',      w:['DIMENSIONAL', 'LEAP'] },
  { k:'WH',      w:['WHITE', 'HOLE'] },
  { k:'REG',     w:['REGISTRY'] },
  { k:'ATK',     w:['ATTACK', 'POWER', 'MAGIC', 'ATT'] },
  { k:'ATK',     w:['ATTACK', 'POWER'] },
  { k:'ATK',     w:['ATK'] },
  { k:'BOW',     w:['BOWMAN'] },
  { k:'IED',     w:['IGNORE', 'DEFENSE'] },
  { k:'IED',     w:['IGNORE', 'DEFENCE'] },
  { k:'BD',      w:['BOSS', 'DAMAGE'] },
  { k:'DMG',     w:['DAMAGE', 'ENHANCEMENT'] },
  { k:'CD',      w:['CRITICAL', 'DAMAGE'] },
  { k:'CD',      w:['CRIT', 'DMG'] },
  { k:'MAGE',    w:['MAGICIAN'] },
  { k:'MAGE',    w:['MAGE'] },
  { k:'PIRATE',  w:['PIRATE'] },
  { k:'THIEF',   w:['THIEF'] },
  { k:'WARRIOR', w:['WARRIOR'] }
];

/* 单个整词的相似度：3 字以内必须全对，4 字以上允许一个错字 */
function wordScore(a, t) {
  if (t === a) return 1;
  if (a.length < 3 || t.length < 3) return 0;
  if (Math.abs(a.length - t.length) > 1) return 0;
  if (a.length <= 3) return 0;
  const score = 1 - editDistance(a, t) / Math.max(a.length, t.length);
  return score >= 0.72 ? score : 0;
}

function tokensOf(ln) {
  const toks = [];
  const re = /[A-Z]+/g;
  let m;
  while ((m = re.exec(ln))) toks.push(m[0]);
  return toks;
}

/* 一行里能对上哪些词条（整词或相邻整词），每个词条只留最高分那处。
   同一段文字只能算一条：BOSS DAMAGE 与 DAMAGE ENHANCEMENT 会重叠，只留更像的那条 */
function matchTagsInLine(ln) {
  const toks = tokensOf(ln);
  const hits = [];
  TAG_ALIAS.forEach(al => {
    const n = al.w.length;
    for (let i = 0; i + n <= toks.length; i++) {
      let score = 1;
      for (let j = 0; j < n; j++) {
        const s = wordScore(al.w[j], toks[i + j]);
        if (!s) { score = 0; break; }
        if (s < score) score = s;
      }
      if (score > 0) hits.push({ k:al.k, score:score, at:i, len:n });
    }
  });
  /* 贪心去重叠：分高的、词多的、位置靠前的先占位 */
  hits.sort((a, b) => b.score - a.score || b.len - a.len || a.at - b.at);
  const taken = [];
  const kept = [];
  hits.forEach(h => {
    let clash = false;
    for (let i = 0; i < taken.length; i++) {
      if (h.at < taken[i].at + taken[i].len && taken[i].at < h.at + h.len) { clash = true; break; }
    }
    if (!clash) { taken.push(h); kept.push(h); }
  });
  const best = {};
  kept.forEach(h => {
    const cur = best[h.k];
    if (!cur || h.score > cur.score) best[h.k] = h;
  });
  return Object.keys(best).map(k => best[k]).sort((a, b) => a.at - b.at);
}

/* 折行的后半截（"Skill Lv. +1" / "ATT Enhancement Skill Lv. +1"）不能单独算一条词条 */
const CONT_WORDS = ['SKILL', 'ENHANCEMENT', 'LEVEL', 'LV', 'LY', 'ATT', 'ATK', 'MAGIC', 'POWER', 'ATTACK', 'AND', 'OF'];
function isContinuation(ln, hits) {
  if (hits && hits.length) return false;
  const toks = tokensOf(ln);
  if (!toks.length) return true;
  return CONT_WORDS.indexOf(toks[0]) >= 0;
}

/* 这一行像不像装备浮窗里的一条词条：写的是「… Attack Skill Lv. +1 / … Enhancement Skill Lv. +1」，
   Dimensional Leap / White Hole 不带 Hologram 前缀，按短行判断；一行里挤进两条也会被拆开 */
function lineIsTagLine(ln, hits) {
  hits = hits || matchTagsInLine(ln);
  const toks = tokensOf(ln);
  if (!toks.length) return false;
  /* 词条行一定带等级（"Lv. +1"）；能力值、Required Job、套装效果那些行不算 */
  const hasLv = /(LV|LY)\s*[.,]?\s*\+?\s*\d/.test(ln) || /(LV|LY)\s*\./.test(ln);
  const skillNum = /SKILL/.test(ln) && /\d/.test(ln);
  if (!hasLv && !skillNum) return false;
  const num = /\d/.test(ln) || /%/.test(ln);
  const skill = /SKILL/.test(ln) && (hasLv || num);
  if (hits.length >= 2) return true;
  if (hits.length === 1) {
    const h = hits[0];
    if (skill) return true;
    if (hasLv && !/SCROLL ENHANCEMENT/.test(ln)) return true;
    if ((h.k === 'DL' || h.k === 'WH') && toks.length <= 4) return true;
    return false;
  }
  /* 认不得的词条行（Other）：写着 Enhancement Skill / Attack Skill 又带等级或数值，且不是折行的后半截 */
  return skill && !isContinuation(ln, hits);
}

/* 把浮窗文字读成这件装备的词条：认得的按词条，认不得的记为 Other，不足 3 条用 Other 补齐。
   窄浮窗里一条词条会折成两行（"… Magic ATT Enhancement" / "Skill Lv. +1"），所以会和下一行拼一次再判 */
function parseItemTags(text) {
  const lines = String(text || '').toUpperCase().split(/[\r\n]+/);
  const rows = [];
  const used = {};
  const pushRow = (li, at, k, score, txt) => {
    rows.push({ line:li, at:at, k:k, score:score, text:txt });
  };
  for (let li = 0; li < lines.length; li++) {
    if (used[li]) continue;
    const ln = lines[li];
    const hits = matchTagsInLine(ln);
    if (lineIsTagLine(ln, hits)) {
      if (!hits.length) pushRow(li, 0, 'OTHER', 0.86, ln.trim());
      else hits.forEach(h => pushRow(li, h.at, h.k, h.score, ln.trim()));
      continue;
    }
    /* 折行：只有词条行才会折（带 Hologram 前缀、或以 Enhancement 结尾），才把下一行拼上来看 */
    const mergeable = /HOLOGR/.test(ln) || /ENHANCEMENT$/.test(ln.trim());
    if (!mergeable) continue;
    let merged = ln;
    for (let step = 1; step <= 2 && li + step < lines.length; step++) {
      if (used[li + step]) break;
      const next = lines[li + step];
      const nh = matchTagsInLine(next);
      if (nh.length && lineIsTagLine(next, nh)) break;
      merged = merged + ' ' + next;
      const mh = matchTagsInLine(merged);
      if (lineIsTagLine(merged, mh)) {
        if (!mh.length) pushRow(li, 0, 'OTHER', 0.86, merged.trim());
        else mh.forEach(h => pushRow(li, h.at, h.k, h.score, merged.trim()));
        for (let s = 1; s <= step; s++) used[li + s] = true;
        break;
      }
    }
  }
  const picked = rows.sort((a, b) => a.line - b.line || a.at - b.at).slice(0, 3);
  /* 一件装备不会有两条一样的词条：重复的那条按 Other 处理，避免读错时出现 REG/REG */
  const seenK = {};
  picked.forEach(r => {
    if (r.k === 'OTHER') return;
    if (seenK[r.k]) { r.k = 'OTHER'; r.score = Math.min(r.score, 0.86); }
    else seenK[r.k] = true;
  });
  const detected = picked.length;
  while (picked.length < 3) picked.push({ line:999, at:0, k:'OTHER', score:0.86, text:'' });
  const lines3 = picked.map(r => r.k);
  const score = Math.min.apply(null, picked.map(r => r.score));
  return { lines:lines3, detected:detected, score:score, rows:picked };
}

/* 部位关键词：读到装备名就自动判断部位，长词优先（先 CAPE 再 CAP） */
const SLOT_WORDS = (function () {
  const src = {
    hat:    ['headwear', 'helmet', 'bandana', 'circlet', 'beret', 'crown', 'hat', 'cap'],
    top:    ['overall', 'jacket', 'shirt', 'coat', 'vest', 'top'],
    bottom: ['trousers', 'bottom', 'pants', 'skirt', 'shorts'],
    cape:   ['mantle', 'cloak', 'cape'],
    glove:  ['gauntlet', 'gloves', 'glove', 'mitten'],
    shoe:   ['sneakers', 'sneaker', 'boots', 'shoes', 'boot', 'shoe', 'sandal']
  };
  const list = [];
  Object.keys(src).forEach(k => src[k].forEach(w => {
    const W = w.toUpperCase();
    list.push({ k:k, w:W, re:new RegExp('(^| )' + W + '(S|ES)?($| )') });
  }));
  return list.sort((a, b) => b.w.length - a.w.length);
})();

function detectSlot(text) {
  const raw = String(text || '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const packed = raw.replace(/[^A-Z]/g, '');
  if (!packed) return null;
  /* 分隔词边界优先，避免 WHAT 里的 HAT、TRAP 里的 CAP */
  for (let i = 0; i < SLOT_WORDS.length; i++) {
    if (SLOT_WORDS[i].re.test(' ' + raw + ' ')) return SLOT_WORDS[i].k;
  }
  /* 单词被 OCR 粘在一起时退化为连续字母查找，长词优先 */
  for (let i = 0; i < SLOT_WORDS.length; i++) {
    const it = SLOT_WORDS[i];
    if (it.w.length >= 5 && packed.indexOf(it.w) >= 0) return it.k;
  }
  /* 再容忍一个错字 */
  for (let i = 0; i < SLOT_WORDS.length; i++) {
    const it = SLOT_WORDS[i];
    const L = it.w.length;
    if (L < 6) continue;
    for (let s = 0; s + L <= packed.length; s++) {
      if (editDistance(it.w, packed.substr(s, L)) <= 1) return it.k;
    }
  }
  return null;
}

function handleOcrText(text, source) {
  const raw = String(text || '');
  const clean = raw.replace(/[\u0000-\u0009\u000b-\u001f]/g, ' ').replace(/[ \t]+/g, ' ').trim();
  SCAN.raw = clean;
  const rawBox = $('#scanRaw');
  if (rawBox) {
    rawBox.hidden = !clean;
    rawBox.textContent = '最后一次识别（' + source + '）：' + (clean || '（空）');
  }
  const item = parseItemTags(raw);
  const slot = detectSlot(raw);
  const slotInfo = $('#scanSlotInfo');
  if (slotInfo) slotInfo.textContent = slot ? ('部位：' + slotLabel(slot)) : '部位：未认出（看装备名）';
  dlog('解析：部位=' + (slot ? slotLabel(slot) : '未认出')
    + ' 词条=' + item.lines.join('/') + '（读到 ' + item.detected + ' 条，把握 '
    + Math.round(item.score * 100) + '%）');
  if (!item.detected) {
    /* 浮窗划走时截到的是背景，别弹提示；只有确实看到浮窗文字却没读全才提醒 */
    if (/SKILL|HOLOGR|SUPERCHARGED/.test(raw.toUpperCase())) {
      scanNote('看到了浮窗但没把词条读全，把浮窗在画面上停稳一点再等一秒。');
    }
    return;
  }
  /* 共享窗口时，浮窗里连一个词条字样都没有（多半截到的是套装加成面板/界面文字），别记 */
  if (source === '窗口' && !/SKILL|ENHANCEMENT|HOLOGRAM|DIMENSIONAL|WHITE HOLE|REGISTRY/.test(raw.toUpperCase())) {
    dlog('没读到词条字样，这次不记');
    return;
  }
  addScanRecord({
    slot:slot, lines:item.lines, detected:item.detected, score:item.score, source:source,
    /* 共享窗口时必须是完整浮窗（读到装备名）才自动入库；截图是你自己选的图，默认信它 */
    named:(source === '窗口') ? /SUPERCHARGED|LIBAE/.test(raw.toUpperCase()) : true
  });
}

/* --- 填进「加一件装备」这一格 --- */
function fillPick(slot, lines) {
  if (slot) state.pick.slot = slot;
  state.pick.lines = lines.slice(0, 3);
  renderSlotTabs();
  renderTagGrid();
  renderPreview();
}

/* 批量识别的进度提示 */
function scanProgress(prefix) {
  const added = SCAN.sessionAdded;
  const dup = SCAN.skipped;
  scanNote((prefix ? prefix + ' ' : '本次共享已录入 ' + added + ' 件'
    + (dup ? '，跳过重复 ' + dup + ' 次' : '') + '。') + (SCAN.stream ? '继续划过装备，点「停止」结束。' : ''));
}

function addScanRecord(o) {
  const lines = o.lines.slice();
  const label = lines.map(k => TAGMAP[k].name).join(' / ');
  const detected = (typeof o.detected === 'number') ? o.detected : 3;
  const padNote = detected < 3 ? '（只读到 ' + detected + ' 条，其余记 Other）' : '';
  /* 认不出部位也先把词条填好，用户点一下上面的部位就能「加入库存」 */
  if (!o.slot) {
    fillPick(null, lines);
    scanNote('词条已经填好（' + label + '）' + padNote + '，但没认出部位：点一下上面的部位，再按「加入库存」。');
    return;
  }

  const sig = scanSig(lines);
  const key = o.slot + '|' + sig;
  const inInv = (state.inv[o.slot] || []).some(it => scanSig(it.lines) === sig);
  /* 同一件装备反复划过只留一件，直到换下一件；重复的也记一笔，同一个只记一次、累计次数 */
  if (inInv || SCAN.seen[key]) {
    SCAN.seen[key] = true;
    SCAN.skipped++;
    let dupRec = SCAN.dups[key];
    if (dupRec) {
      dupRec.times = (dupRec.times || 1) + 1;
    } else {
      dupRec = {
        id: ++SCAN.seq, slot:o.slot, lines:lines.slice(), detected:detected,
        score:o.score, source:o.source, added:false, pending:false, dup:true, times:1
      };
      SCAN.records.unshift(dupRec);
      if (SCAN.records.length > 60) SCAN.records.length = 60;
      SCAN.dups[key] = dupRec;
    }
    dlog('跳过重复：' + slotLabel(o.slot) + ' ' + sig.replace(/\|/g, '/') + ' ×' + dupRec.times);
    const slotInfo = $('#scanSlotInfo');
    if (slotInfo) slotInfo.textContent = '部位：' + slotLabel(o.slot) + '（重复，已跳过）';
    scanProgress();
    renderScanLog();
    return;
  }

  const rec = {
    id: ++SCAN.seq, slot:o.slot, lines:lines, detected:detected,
    score:o.score, source:o.source, added:false, pending:false
  };
  SCAN.sessionRecognized++;
  SCAN.records.unshift(rec);
  if (SCAN.records.length > 60) SCAN.records.length = 60;

  /* 没读到装备名说明截到的可能不是完整浮窗：宁可先填表让你确认 */
  if (SCAN.auto && o.score >= 0.72 && o.named !== false) {
    state.inv[o.slot].push({ lines:lines.slice() });
    state.demo = false;
    rec.added = true;
    SCAN.sessionAdded++;
    SCAN.seen[key] = true;
    state.solIndex = 0;
    state.pick.lines = [];
    dlog('已入库：' + slotLabel(o.slot) + ' ' + sig.replace(/\|/g, '/'));
    scanProgress('已录入 ' + slotLabel(o.slot) + ' · ' + label + padNote);
    renderAll();
  } else {
    rec.pending = true;
    fillPick(o.slot, lines);
    dlog('待确认：' + label + ' 把握 ' + Math.round(o.score * 100) + '%'
      + (o.named === false ? '（没读到装备名）' : ''));
    scanNote('已填好 ' + slotLabel(o.slot) + ' · ' + label + padNote
      + (o.named === false ? '（这张图里没读到装备名，先别入库）' : '')
      + '，核对无误按「加入库存」，或点记录里的「入库」。');
  }
  renderScanLog();
}

function slotLabel(key) {
  const s = SLOTS.filter(x => x.key === key)[0];
  return s ? s.label : key;
}

function acceptScanRecord(id) {
  const rec = SCAN.records.filter(r => r.id === id)[0];
  if (!rec || rec.added || !rec.slot) return;
  state.inv[rec.slot].push({ lines:rec.lines.slice() });
  state.demo = false;
  rec.pending = false;
  rec.added = true;
  SCAN.sessionAdded++;
  state.solIndex = 0;
  scanNote('已存入' + slotLabel(rec.slot) + '：' + rec.lines.map(k => TAGMAP[k].name).join(' / '));
  renderAll();
}

function undoScanRecord(id) {
  const rec = SCAN.records.filter(r => r.id === id)[0];
  if (!rec) return;
  if (!rec.added) { rec.pending = false; renderScanLog(); return; }
  const list = state.inv[rec.slot] || [];
  const sig = scanSig(rec.lines);
  for (let i = list.length - 1; i >= 0; i--) {
    if (scanSig(list[i].lines) === sig) { list.splice(i, 1); break; }
  }
  rec.added = false;
  rec.undo = true;
  SCAN.sessionAdded = Math.max(0, SCAN.sessionAdded - 1);
  /* 撤销后这件就不在库存里了，下次再划到它要能重新入库：
     清掉重复标记，并让「还是同一件浮窗」的判定失效，否则同一张浮窗不会再触发识别 */
  delete SCAN.seen[rec.slot + '|' + sig];
  SCAN.lastSig = null;
  SCAN.lastHash = '';
  state.solIndex = 0;
  renderAll();
}

/* --- 渲染 --- */
function renderScanLog() {
  const box = $('#scanLog');
  if (!box) return;
  box.innerHTML = '';
  const logPill = $('#scanLogPill');
  if (logPill) {
    logPill.textContent = SCAN.sessionAdded + ' 件已入库';
    logPill.dataset.state = SCAN.records.some(r => r.pending) ? 'part' : (SCAN.records.length ? 'ok' : 'zero');
  }
  if (!SCAN.records.length) {
    box.appendChild(el('p', 'empty', '还没有识别记录。连上窗口后，每读到一件装备就会出现在这里。'));
    return;
  }
  SCAN.records.forEach(rec => {
    const row = el('div', 'scan-row');
    const metaTxt = '#' + rec.id + ' · ' + (rec.slot ? slotLabel(rec.slot) : '部位待定')
      + (rec.detected && rec.detected < 3 ? ' · 读到 ' + rec.detected + ' 条' : '');
    row.appendChild(el('span', 'meta', metaTxt));
    const chips = el('div', 'chips');
    rec.lines.forEach(k => chips.appendChild(chipNode(k, false)));
    row.appendChild(chips);

    const flag = el('span', 'flag');
    if (rec.added) { flag.textContent = '已入库'; }
    else if (rec.undo) { flag.textContent = '已撤销'; flag.className = 'flag mute'; }
    else if (rec.dup) {
      flag.textContent = '已存在' + ((rec.times || 1) > 1 ? ' ×' + rec.times : '');
      flag.className = 'flag mute';
    }
    else { flag.textContent = '待确认 ' + Math.round(rec.score * 100) + '%'; flag.className = 'flag warn'; }
    row.appendChild(flag);

    if (rec.pending) {
      const okBtn = el('button', 'ghost', '入库');
      okBtn.onclick = () => acceptScanRecord(rec.id);
      row.appendChild(okBtn);
    }
    if (rec.added) {
      const unBtn = el('button', 'ghost', '撤销');
      unBtn.onclick = () => undoScanRecord(rec.id);
      row.appendChild(unBtn);
    }
    box.appendChild(row);
  });
}

function renderScan() {
  renderScanLog();
  const autoBox = $('#scanAuto');
  if (autoBox) autoBox.checked = SCAN.auto;
  const region = $('#scanRegion');
  if (region) {
    region.textContent = SCAN.rect
      ? ('区域：宽 ' + Math.round(SCAN.rect.w * 100) + '% · 高 ' + Math.round(SCAN.rect.h * 100) + '%')
      : '区域：整窗（框选一块会更快更准）';
  }
}

/* --- 框选 --- */
function drawRectOverlay() {
  const box = $('#scanRect');
  if (!box) return;
  if (!SCAN.rect || !SCAN.stream) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.style.left = (SCAN.rect.x * 100) + '%';
  box.style.top = (SCAN.rect.y * 100) + '%';
  box.style.width = (SCAN.rect.w * 100) + '%';
  box.style.height = (SCAN.rect.h * 100) + '%';
}

function bindScanRect() {
  const stage = $('#scanStage');
  if (!stage) return;
  const at = e => {
    const r = stage.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    };
  };
  stage.addEventListener('pointerdown', e => {
    if (!SCAN.stream || e.target.closest('button') || e.button !== 0) return;
    e.preventDefault();
    SCAN.drag = at(e);
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
  });
  stage.addEventListener('pointermove', e => {
    if (!SCAN.drag) return;
    const cur = at(e), st = SCAN.drag;
    const r = {
      x: Math.min(st.x, cur.x), y: Math.min(st.y, cur.y),
      w: Math.abs(cur.x - st.x), h: Math.abs(cur.y - st.y)
    };
    if (r.w > 0.12 && r.h > 0.12) {
      SCAN.rect = r;
      drawRectOverlay();
      const region = $('#scanRegion');
      if (region) region.textContent = '区域：宽 ' + Math.round(r.w * 100) + '% · 高 ' + Math.round(r.h * 100) + '%';
    }
  });
  const end = () => {
    if (!SCAN.drag) return;
    SCAN.drag = null;
    if (SCAN.rect) scanNote('框好了，把鼠标停在装备上看词条。');
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
}

/* --- 截图识别 --- */
async function scanImageFile(file) {
  if (!file) return;
  if (!/^image\//.test(file.type || '')) { scanNote('这个文件不是图片。'); return; }
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { scanNote('这张图读不出来，换一张试试。'); return; }
  const canvas = $('#scanCanvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  canvas.getContext('2d').drawImage(bmp, 0, 0);
  canvas.hidden = false;
  $('#scanHint').hidden = true;
  $('#scanRect').style.display = 'none';
  const shot = $('#scanShotPill');
  if (shot) {
    shot.textContent = bmp.width + ' × ' + bmp.height;
    shot.dataset.state = 'ok';
  }
  setScanPill('截图识别', 'part');
  scanNote('正在读这张图…');
  dlog('截图识别：' + (file.name || 'image') + ' ' + bmp.width + 'x' + bmp.height);
  try {
    await ensureWorker();
    const r = await SCAN.worker.recognize(canvas);
    handleOcrText(r.data.text, '截图');
  } catch (e) {
    setEngine('不可用（需要联网）');
    dlog('截图识别失败：' + ((e && e.message) || e));
    scanNote('识别引擎没加载起来：' + ((e && e.message) || e));
  }
}

function setScanPanel(open) {
  SCAN.panelOpen = !!open;
  const body = $('#scanBody');
  const btn = $('#btnScanToggle');
  if (body) body.hidden = !SCAN.panelOpen;
  if (btn) {
    btn.setAttribute('aria-expanded', SCAN.panelOpen ? 'true' : 'false');
    const lbl = btn.querySelector('.lbl');
    if (lbl) lbl.textContent = SCAN.panelOpen ? '收起识别' : '识别游戏窗口';
    else btn.textContent = SCAN.panelOpen ? '收起识别' : '识别游戏窗口';
  }
  if (!SCAN.panelOpen && SCAN.stream) stopScan();
}

function bootScan() {
  $('#btnScanToggle').onclick = () => {
    setScanPanel(!SCAN.panelOpen);
    if (SCAN.panelOpen && !SCAN.stream) {
      scanNote('点「开始共享」，在弹出的列表里选游戏窗口，再在画面上框住整个浮窗。');
    }
  };
  $('#btnScanStart').onclick = startScan;
  $('#btnScanStop').onclick = stopScan;
  $('#btnScanRect').onclick = () => {
    SCAN.rect = null;
    drawRectOverlay();
    renderScan();
    scanNote('旧框已清掉，在画面上重新拖一个方框。');
  };
  $('#scanAuto').onchange = e => {
    SCAN.auto = e.target.checked;
    scanNote(SCAN.auto ? '读到的装备直接加入库存。' : '读到的先填进下面这格，你按「加入库存」确认。');
  };
  bindScanRect();

  const copyBtn = $('#btnDiagCopy');
  if (copyBtn) copyBtn.onclick = async () => {
    const txt = SCAN.diag.join('\n') || '（还没有日志）';
    const pill = $('#scanDiagPill');
    try {
      await navigator.clipboard.writeText(txt);
      if (pill) pill.textContent = '已复制到剪贴板';
    } catch (e) {
      const box = $('#scanDiagBody');
      if (box) { box.focus(); box.select(); try { document.execCommand('copy'); if (pill) pill.textContent = '已复制'; } catch (e2) { if (pill) pill.textContent = '复制失败，手动全选'; } }
    }
  };
  const clearBtn = $('#btnDiagClear');
  if (clearBtn) clearBtn.onclick = () => {
    SCAN.diag = [];
    const box = $('#scanDiagBody');
    if (box) box.value = '';
    const pill = $('#scanDiagPill');
    if (pill) pill.textContent = '已清空';
  };
  dlog('页面就绪：' + location.protocol + '（' + (window.isSecureContext ? '安全上下文' : '非安全上下文') + '），'
    + '窗口共享=' + (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia ? '可用' : '不可用'));
  dlog('浏览器：' + navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90));

  const drop = $('#scanDrop');
  const file = $('#scanFile');
  $('#btnScanShot').onclick = () => file.click();
  drop.onclick = () => file.click();
  file.onchange = e => {
    const f = e.target.files && e.target.files[0];
    if (f) scanImageFile(f);
    e.target.value = '';
  };
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.dataset.over = '1'; });
  drop.addEventListener('dragleave', () => { drop.dataset.over = '0'; });
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.dataset.over = '0';
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) scanImageFile(f);
  });
  document.addEventListener('paste', e => {
    if (!SCAN.panelOpen || state.page !== 'solve') return;
    const items = (e.clipboardData && e.clipboardData.items) || [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image/') === 0) {
        const f = items[i].getAsFile();
        if (f) { scanImageFile(f); e.preventDefault(); }
        return;
      }
    }
  });
}

/* ===== 启动 ===== */
function boot() {
  if (!load()) {
    state.inv = normalizeInv(demoInv());
    state.demo = true;
  }
  $('#addBtn').onclick = addPiece;
  $('#btnDemo').onclick = loadDemo;
  $('#btnClear').onclick = () => {
    if (state.inv && Object.values(state.inv).some(a => a.length) && !confirm('清空全部装备？')) return;
    clearInv();
  };
  $('#btnExport').onclick = exportJson;
  $('#btnImport').onclick = () => $('#fileInput').click();
  $('#fileInput').onchange = e => {
    const f = e.target.files && e.target.files[0];
    if (f) importJson(f);
    e.target.value = '';
  };
  $('#btnApply').onclick = applyCustom;
  $('#btnAddPreset').onclick = addPreset;
  $('#btnDelPreset').onclick = delPreset;
  $('#btnPresetZero').onclick = () => {
    const p = activePreset();
    if (p.builtin) return;
    TAGS.forEach(t => { p.targets[t.k] = 0; });
    state.solIndex = 0;
    renderAll();
    $('#custNote').textContent = '已把「' + p.name + '」的目标全部清零。';
  };
  $('#custName').onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); commitField('name', $('#custName').value); }
  };
  $('#custName').onchange = () => commitField('name', $('#custName').value);
  $('#custDesc').onkeydown = e => {
    if (e.key === 'Enter') { e.preventDefault(); commitField('desc', $('#custDesc').value); }
  };
  $('#custDesc').onchange = () => commitField('desc', $('#custDesc').value);
  bootScan();
  renderAll();
}
document.addEventListener('DOMContentLoaded', boot);
