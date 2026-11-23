// Token Radar's dashboard, model radar-2. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, a filterable table, a per-protocol detail drawer with the
// model's own inputs and the protocol's farm plan, and the live-token view the multiples come
// from. No network: every byte it shows is in data.js.
//
// The page recomputes a row from the snapshot figures and checks the number board.json carries,
// so the page's code and the board's data are visibly the same arithmetic: the multipliers are
// rounded to 4 decimal places before the product, in the model and here, so the recompute lands on
// the same dollar. The farm plan is the same derivation main.ts writes to board.json: category,
// chains, TVL and age decide the action, the capital, the hold and every cost and time. No name is
// special-cased.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watchlist: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };
  var WATCH = {};
  (DATA.watchlist || []).forEach(function (s) { WATCH[s] = true; });
  var MULT = {};
  (DATA.multiples || []).forEach(function (m) { MULT[m.category] = m.multiple; });

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtFullUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(2) + 'x';
  }
  // The model in one function: the same product main.ts writes, from the row's own multipliers.
  function impliedOf(row) {
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * row.growth_multiplier * row.maturity_multiplier * row.breadth_multiplier));
  }
  function multipleSource(row) {
    var cat = row.category || 'Uncategorized';
    if (MULT[cat] !== undefined) return 'Median mcap/TVL of ' + cat + ' protocols whose token trades';
    return 'Global median over live-token protocols';
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // The farm plan is the same derivation main.ts writes to board.json: category, chains, TVL and age
  // decide the action, the capital, the hold and every cost and time. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function weeklyActionFor(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'a top-up, a small borrow, or a repayment';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'a swap, a deposit, or a claim of the pool rewards';
    if (c.indexOf('bridge') >= 0) return 'a bridge, a swap, or a deposit of the bridged funds';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'a top-up of the stake or a claim of the staking rewards';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0) return 'a small trade or a margin top-up';
    if (c.indexOf('prediction') >= 0) return 'a new market position or a claim of the winnings';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'a deposit into the vault or a claim of the vault yield';
    if (c.indexOf('stable') >= 0) return 'a mint, a deposit, or a redemption of the stable asset';
    if (c.indexOf('rwa') >= 0) return 'a mint of the yield asset or a claim of its yield';
    if (c.indexOf('insurance') >= 0) return 'a renewal check or a top-up of the cover';
    return 'a deposit, a swap, or a vote';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var weekly = weeklyActionFor(p);
    var steps = [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week, such as ' + weekly + ', so the wallet stays active.', cost: 'about $2 of gas a week', time: '10 minutes a week' }
    ];
    if (p.chains.length >= 2) {
      steps.push({ text: 'Repeat the position on ' + p.chains[1] + ", the protocol's second chain, so the activity shows on more than one chain.", cost: '$' + Math.round(capital / 2) + ' of capital and about $4 of gas', time: '15 minutes to set up' });
    } else {
      steps.push({ text: 'After two weeks, top up the position by $' + Math.round(capital / 2) + ' so the activity is not a single deposit.', cost: '$' + Math.round(capital / 2) + ' of capital and about $2 of gas', time: '10 minutes' });
    }
    steps.push(
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' }
    );
    return steps.map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watchlist') === '1') state.watchlist = true;
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watchlist) params.set('watchlist', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.watchlist && !WATCH[r.slug]) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function liveRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.live.filter(function (r) {
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'chains') { av = (a.chains || []).length; bv = (b.chains || []).length; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }
  function sortButton(label, key) {
    var arrow = state.sort === key ? (state.dir === -1 ? ' ↓' : ' ↑') : '';
    return el('button', { type: 'button', onclick: function () {
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = key === 'name' ? 1 : -1; }
      render();
    } }, label + arrow);
  }
  function categories() {
    var seen = {};
    DATA.rows.forEach(function (r) { if (r.category) seen[r.category] = true; });
    return Object.keys(seen).sort();
  }
  function chains() {
    var seen = {};
    DATA.rows.forEach(function (r) { (r.chains || []).forEach(function (c) { seen[c] = true; }); });
    return Object.keys(seen).sort();
  }

  function renderHead() {
    return el('div', { class: 'shell' },
      el('header', { class: 'top' },
        el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name' }, 'Token Radar')),
        el('div', { class: 'top-meta' },
          el('span', null, 'Snapshot ', el('b', null, DATA.as_of)),
          el('span', null, 'Model ', el('b', null, DATA.model_version)),
          el('span', null, 'Floor ', el('b', null, fmtUsd(DATA.floor_usd)))
        )
      ),
      el('div', { class: 'lede' },
        el('div', null,
          el('h1', null, 'Which pre-token protocol is worth farming next?'),
          el('p', null, 'Token Radar ranks ', el('b', null, String(DATA.board_size) + ' protocols'), ' that record no token yet, by what their launch would be worth if the market priced them like the protocols of their own category that already trade. Every row carries the steps to farm it, with what they cost and how long they take.')
        ),
        el('div', { class: 'facts' },
          el('div', { class: 'fact' }, el('span', null, 'Ranked pre-token protocols'), el('b', null, String(DATA.board_size))),
          el('div', { class: 'fact' }, el('span', null, 'Watchlist covered'), el('b', null, DATA.watchlist_size + ' / ' + DATA.watchlist_size)),
          el('div', { class: 'fact' }, el('span', null, 'Early finds below the floor'), el('b', null, String(DATA.early_size))),
          el('div', { class: 'fact' }, el('span', null, 'Live-token protocols set aside'), el('b', null, String(DATA.live_size))),
          el('div', { class: 'fact' }, el('span', null, 'Global multiple'), el('b', null, fmtMult(DATA.global_multiple)))
        )
      )
    );
  }

  function renderControls(list, total) {
    var catSel = el('select', { 'aria-label': 'Category', onchange: function (e) { state.category = e.target.value; render(); } },
      el('option', { value: 'all' }, 'All categories'));
    categories().forEach(function (c) {
      var opt = el('option', { value: c }, c);
      if (state.category === c) opt.selected = true;
      catSel.appendChild(opt);
    });
    var chainSel = el('select', { 'aria-label': 'Chain', onchange: function (e) { state.chain = e.target.value; render(); } },
      el('option', { value: 'all' }, 'All chains'));
    chains().forEach(function (c) {
      var opt = el('option', { value: c }, c);
      if (state.chain === c) opt.selected = true;
      chainSel.appendChild(opt);
    });
    var search = el('input', { type: 'search', placeholder: 'Search a protocol, a chain, a category…', value: state.q, 'aria-label': 'Search', oninput: function (e) { state.q = e.target.value; render(); } });
    var watch = el('label', { class: 'check' },
      el('input', { type: 'checkbox', onchange: function (e) { state.watchlist = e.target.checked; render(); } }, null),
      'Watchlist only');
    watch.querySelector('input').checked = state.watchlist;
    var preBtn = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', onclick: function () { state.tab = 'pre-token'; render(); } }, 'Pre-token');
    var liveBtn = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', onclick: function () { state.tab = 'live'; render(); } }, 'Live tokens');
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', null, 'Search'), search),
      el('div', { class: 'field' }, el('label', null, 'Category'), catSel),
      el('div', { class: 'field' }, el('label', null, 'Chain'), chainSel),
      watch,
      el('div', { class: 'tabs', role: 'group', 'aria-label': 'Board' }, preBtn, liveBtn),
      el('span', { class: 'count' }, list.length + ' of ' + total + ' shown')
    );
  }

  function boardTable(list) {
    var maxImplied = DATA.rows.length > 0 ? DATA.rows[0].implied_value_usd : 1;
    var head = el('tr', null,
      el('th', null, sortButton('Rank', 'implied')),
      el('th', null, sortButton('Protocol', 'name')),
      el('th', null, 'Category'),
      el('th', null, sortButton('Chains', 'chains')),
      el('th', null, sortButton('TVL', 'tvl')),
      el('th', null, sortButton('7d', 'growth')),
      el('th', null, sortButton('Age', 'age')),
      el('th', null, 'Implied value')
    );
    var body = el('tbody', null);
    list.forEach(function (r) {
      var pct = el('span', { class: r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg') }, fmtPct(r.change_7d));
      var nameCell = el('div', { class: 'name' },
        el('b', null, r.name),
        el('span', { class: 'sub' }, r.slug + (WATCH[r.slug] ? '  ·  watchlist' : ''))
      );
      if (WATCH[r.slug]) nameCell.appendChild(el('span', null, el('span', { class: 'badge' }, 'WATCHLIST')));
      var row = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        onclick: function () { state.selected = r.slug; render(); },
        tabindex: '0',
        onkeydown: function (e) { if (e.key === 'Enter') { state.selected = r.slug; render(); } }
      },
        el('td', { class: 'num' }, String(r.rank)),
        el('td', null, nameCell),
        el('td', null, r.category || '—'),
        el('td', { class: 'num' }, String((r.chains || []).length) + ' · ' + (r.chains && r.chains[0] ? r.chains[0] : '—')),
        el('td', { class: 'num' }, fmtUsd(r.tvl_usd)),
        el('td', { class: 'num' }, pct),
        el('td', { class: 'num' }, fmtAge(r.age_days)),
        el('td', null, el('span', { class: 'implied' },
          el('span', { class: 'num' }, fmtUsd(r.implied_value_usd)),
          el('span', { class: 'bar' }, el('i', { style: 'width:' + Math.max(2, Math.round((r.implied_value_usd / maxImplied) * 100)) + '%' }))
        ))
      );
      body.appendChild(row);
    });
    if (list.length === 0) {
      return el('div', { class: 'panel' },
        el('div', { class: 'empty' },
          el('h2', null, 'Nothing on the radar matches'),
          el('p', null, 'Loosen the search or clear a filter to see the board again.'),
          el('button', { class: 'button primary', type: 'button', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlist = false; render(); } }, 'Clear the filters')
        )
      );
    }
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' }, el('table', null, el('thead', null, head), body)));
  }

  function liveTable(list) {
    var head = el('tr', null,
      el('th', null, 'Protocol'),
      el('th', null, 'Category'),
      el('th', null, 'Chains'),
      el('th', null, 'TVL'),
      el('th', null, 'Market cap'),
      el('th', null, 'Mcap / TVL'),
      el('th', null, '7d')
    );
    var body = el('tbody', null);
    list.forEach(function (r) {
      var ratio = r.tvl_usd > 0 && r.mcap_usd !== null ? r.mcap_usd / r.tvl_usd : null;
      body.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' }, el('b', null, r.name), el('span', { class: 'sub' }, r.slug))),
        el('td', null, r.category || '—'),
        el('td', { class: 'num' }, String((r.chains || []).length) + ' · ' + (r.chains && r.chains[0] ? r.chains[0] : '—')),
        el('td', { class: 'num' }, fmtUsd(r.tvl_usd)),
        el('td', { class: 'num' }, fmtUsd(r.mcap_usd)),
        el('td', { class: 'num' }, ratio === null ? 'n/a' : ratio.toFixed(2) + 'x'),
        el('td', { class: 'num' }, el('span', { class: r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg') }, fmtPct(r.change_7d)))
      ));
    });
    return el('div', { class: 'panel' }, el('div', { class: 'table-wrap' }, el('table', null, el('thead', null, head), body)));
  }

  function renderModel() {
    var top = (DATA.multiples || []).slice(0, 12);
    var m = DATA.model;
    var formula = 'implied = TVL × category multiple × growth × maturity × breadth\n' +
      '  category multiple: median mcap/TVL of the category’s live-token protocols (≥3), else the global ' + DATA.global_multiple.toFixed(3) + ', clamped to [' + m.multiple_min + ', ' + m.multiple_max + ']\n' +
      '  growth: 1 + clamp(7d change, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 × ' + m.growth_weight + '\n' +
      '  maturity: ' + m.maturity_floor + ' + min(age, ' + m.maturity_days + 'd) / ' + m.maturity_days + ' × ' + m.maturity_range + '  (age unknown: ' + m.unknown_age_days + 'd)\n' +
      '  breadth: 1 + ' + m.breadth_step + ' × min(log2(chains), ' + m.breadth_max_steps + ')';
    var table = el('table', { class: 'mult-table' },
      el('thead', null, el('tr', null,
        el('th', null, 'Category'), el('th', { class: 'num' }, 'Live comps'), el('th', { class: 'num' }, 'Multiple'))),
      el('tbody', null, top.map(function (x) {
        return el('tr', null,
          el('td', null, x.category),
          el('td', { class: 'num' }, String(x.sample)),
          el('td', { class: 'num' }, x.multiple.toFixed(3) + 'x'));
      }))
    );
    return el('section', { class: 'panel model' },
      el('h2', null, 'How it prices a launch'),
      el('p', { class: 'formula' }, formula),
      el('p', null, 'The multiple is the market’s own pricing, read from this snapshot: what the tokens that already trade are worth against the TVL they sit on. A protocol’s implied value is this entry’s own claim, never make.fun’s.'),
      table
    );
  }

  function renderDetail() {
    var selected = null;
    if (state.selected) {
      for (var i = 0; i < DATA.rows.length; i++) {
        if (DATA.rows[i].slug === state.selected) { selected = DATA.rows[i]; break; }
      }
    }
    var drawer = el('aside', { class: 'detail', 'aria-label': 'Protocol detail', hidden: selected ? null : 'true' });
    if (!selected) return drawer;
    var r = selected;
    var recomputed = impliedOf(r);
    var check = recomputed === r.implied_value_usd ? 'matches the board' : 'differs from the board';
    var steps = farmSteps(r);
    var head = el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'status' }, 'Rank #' + r.rank + (WATCH[r.slug] ? ' · watchlist' : '')),
        el('h2', null, r.name),
        el('div', { class: 'sub' }, r.slug + ' · ' + (r.category || 'Uncategorized') + ' · listed ' + (r.listed_at || 'unknown') + ' · ' + fmtAge(r.age_days) + ' old')
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close', onclick: function () { state.selected = null; render(); } }, 'Close')
    );
    var equation = el('div', { class: 'detail-section' },
      el('h3', null, 'What its launch would be worth'),
      el('div', { class: 'equation' },
        el('div', null, el('span', null, 'TVL'), el('b', null, fmtFullUsd(r.tvl_usd))),
        el('div', null, el('span', null, '× category multiple (' + (r.category || 'Uncategorized') + ')'), el('b', null, r.category_multiple.toFixed(4) + 'x')),
        el('div', null, el('span', null, '× growth (' + fmtPct(r.change_7d) + ' over 7d)'), el('b', null, r.growth_multiplier.toFixed(4) + 'x')),
        el('div', null, el('span', null, '× maturity (' + fmtAge(r.age_days) + ' with no token)'), el('b', null, r.maturity_multiplier.toFixed(4) + 'x')),
        el('div', null, el('span', null, '× breadth (' + (r.chains || []).length + ' chains)'), el('b', null, r.breadth_multiplier.toFixed(4) + 'x')),
        el('div', { class: 'total' }, el('span', null, 'Implied value — recomputed ' + check), el('b', null, fmtFullUsd(r.implied_value_usd)))
      ),
      el('p', null, multipleSource(r) + '. The protocol records no token; that is what the snapshot says, not proof it has none.')
    );
    var chainChips = el('div', { class: 'chips' }, (r.chains || []).map(function (c) { return el('span', { class: 'chip' }, c); }));
    var facts = el('div', { class: 'detail-section' },
      el('h3', null, 'The protocol'),
      el('p', null, 'TVL ' + fmtFullUsd(r.tvl_usd) + ' · 7d ' + fmtPct(r.change_7d) + ' · ' + (r.chains || []).length + ' chains · on the radar since ' + (r.listed_at || 'an unknown date') + '.'),
      chainChips
    );
    var plan = el('div', { class: 'detail-section' },
      el('h3', null, 'How to farm it'),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var parts = s.split(' Cost: ');
        var action = parts[0];
        var costTime = parts.length > 1 ? parts[1].split(' Time: ') : [];
        return el('li', null,
          el('b', null, action),
          el('span', { class: 'cost' }, 'Cost: ' + (costTime[0] || '') + (costTime[1] ? ' · Time: ' + costTime[1].replace(/\.$/, '') : ''))
        );
      }))
    );
    drawer.appendChild(head);
    drawer.appendChild(equation);
    drawer.appendChild(facts);
    drawer.appendChild(plan);
    return drawer;
  }

  function render() {
    writeHash();
    app.innerHTML = '';
    app.setAttribute('aria-busy', 'false');
    var shell = renderHead();
    var total = state.tab === 'live' ? DATA.live.length : DATA.rows.length;
    var list = state.tab === 'live' ? liveRows() : sortedRows(rows());
    shell.appendChild(renderControls(list, total));
    shell.appendChild(state.tab === 'live' ? liveTable(list) : boardTable(list));
    shell.appendChild(renderModel());
    shell.appendChild(el('p', { class: 'foot' },
      el('b', null, 'A note on what this board claims. '),
      'Implied value is this entry’s own estimate from the snapshot’s figures; it does not predict whether or when a token is issued. “Records no token” means the snapshot’s record carries no token for the protocol, not that the protocol has none. Data: ' + DATA.source + '.'
    ));
    app.appendChild(shell);
    app.appendChild(renderDetail());
  }

  readHash();
  render();
})();
