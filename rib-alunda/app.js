// Gemensam logik för RIB Alunda-sidorna.

var GROUP_COLORS = ['var(--g1)', 'var(--g2)', 'var(--g3)', 'var(--g4)'];
var MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli',
  'augusti', 'september', 'oktober', 'november', 'december'];

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// "076-80 666 38" -> <a href="tel:0768066638">…</a>. Flera nummer separeras med "/".
function telLinks(tel) {
  return String(tel || '').split('/').map(function (t) {
    t = t.trim();
    return '<a href="tel:' + t.replace(/[^\d+]/g, '') + '">' + esc(t) + '</a>';
  }).join(' / ');
}

// ISO 8601-vecka: { year, week } för ett datum.
function isoWeek(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7) };
}

// Måndag i given ISO-vecka.
function mondayOfWeek(year, week) {
  var jan4 = new Date(year, 0, 4);
  var monday = new Date(jan4);
  monday.setDate(jan4.getDate() - ((jan4.getDay() || 7) - 1) + (week - 1) * 7);
  return monday;
}

function weeksInYear(year) {
  return isoWeek(new Date(year, 11, 28)).week;
}

function shortDate(d) {
  return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3);
}

function parseDate(s) {
  var p = String(s).split('-');
  return new Date(+p[0], +p[1] - 1, +p[2]);
}

function longDate(s) {
  var d = parseDate(s);
  return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

function today() {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// "43NS Niklas Söderberg" -> { kod: "43NS", namn: "Niklas Söderberg" }
function splitName(s) {
  var m = String(s).match(/^(\S*\d\S*)\s+(.+)$/);
  return m ? { kod: m[1], namn: m[2] } : { kod: '', namn: s };
}

function groupForWeek(data, week) {
  for (var i = 0; i < data.grupper.length; i++) {
    if (data.grupper[i].veckor.indexOf(week) !== -1) return i;
  }
  return -1;
}

function holidayForWeek(data, week) {
  var h = (data.storhelger || []).filter(function (x) { return x.vecka === week; });
  return h.map(function (x) { return x.namn; }).join(', ');
}

function staffTable(personal, withCode) {
  return '<table><thead><tr><th>Roll</th>' + (withCode ? '<th>Kod</th>' : '') +
    '<th>Namn</th><th>Telefon</th></tr></thead><tbody>' +
    personal.map(function (p) {
      var n = splitName(p.namn);
      return '<tr><td class="role">' + esc(p.roll) + '</td>' +
        (withCode ? '<td>' + esc(n.kod) + '</td><td>' : '<td><span class="muted">' + esc(n.kod) + '</span> ') +
        esc(n.namn) + '</td><td class="tel">' + telLinks(p.tel) + '</td></tr>';
    }).join('') + '</tbody></table>';
}

// Beredskapsdata saknas om data/beredskap.js inte finns – då visas exempeldata.
function withBeredskap(cb) {
  if (window.BEREDSKAP) return cb(window.BEREDSKAP, false);
  var s = document.createElement('script');
  s.src = 'data/beredskap.exempel.js';
  s.onload = function () { cb(window.BEREDSKAP, true); };
  document.head.appendChild(s);
}

var EXAMPLE_NOTICE = '<div class="notice"><b>Exempeldata visas.</b> Lägg den riktiga ' +
  'beredskapsfilen som <code>data/beredskap.js</code> – se README.</div>';

/* ---------- Startsida: beredskap ---------- */

function renderBeredskap(data, isExample) {
  var now = isoWeek(today());
  var maxWeek = weeksInYear(data.ar);
  var selected = now.year === data.ar ? now.week : 1;
  if (isExample) document.getElementById('notice').innerHTML = EXAMPLE_NOTICE;

  function renderNow() {
    var gi = groupForWeek(data, selected);
    var mon = mondayOfWeek(data.ar, selected);
    var sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    var isCurrent = now.year === data.ar && now.week === selected;
    var hol = holidayForWeek(data, selected);
    var g = data.grupper[gi];
    document.getElementById('now').innerHTML =
      '<div class="now-head"><div>' +
      '<div class="muted">' + (isCurrent ? 'I beredskap denna vecka' : 'Beredskap') +
      ' · ' + shortDate(mon) + ' – ' + shortDate(sun) + '</div>' +
      '<p class="now-title">Vecka ' + selected + ' ' +
      (g ? '<span class="badge" style="background:' + GROUP_COLORS[gi] + '">' + esc(g.namn) + '</span>' : '') +
      (hol ? ' <span class="holiday">' + esc(hol) + '</span>' : '') + '</p></div>' +
      '<div class="week-nav"><button id="prev" aria-label="Föregående vecka">‹ Föreg.</button>' +
      (isCurrent || now.year !== data.ar ? '' : '<button id="cur">Idag</button>') +
      '<button id="next" aria-label="Nästa vecka">Nästa ›</button></div></div>' +
      (g ? staffTable(g.personal) : '<p class="muted">Ingen grupp schemalagd denna vecka.</p>');
    document.getElementById('prev').onclick = function () { select(Math.max(1, selected - 1)); };
    document.getElementById('next').onclick = function () { select(Math.min(maxWeek, selected + 1)); };
    var cur = document.getElementById('cur');
    if (cur) cur.onclick = function () { select(now.week); };
  }

  function renderYear() {
    var html = '';
    for (var w = 1; w <= maxWeek; w++) {
      var gi = groupForWeek(data, w);
      var hol = holidayForWeek(data, w);
      var cls = 'wk' + (now.year === data.ar && w === now.week ? ' current' : '') +
        (w === selected ? ' selected' : '') + (hol ? ' hol' : '');
      html += '<div class="' + cls + '" data-w="' + w + '" title="Vecka ' + w +
        (gi >= 0 ? ' – ' + esc(data.grupper[gi].namn) : '') + (hol ? ' – ' + esc(hol) : '') +
        '" style="background:' + (gi >= 0 ? GROUP_COLORS[gi] : 'var(--muted)') + '">' +
        w + '<small>' + (gi >= 0 ? 'G' + (gi + 1) : '–') + '</small></div>';
    }
    var year = document.getElementById('year');
    year.innerHTML = html;
    year.onclick = function (e) {
      var el = e.target.closest('.wk');
      if (el) select(+el.dataset.w);
    };
    document.getElementById('legend').innerHTML = data.grupper.map(function (g, i) {
      return g.veckor.length ? '<span><i class="dot" style="background:' + GROUP_COLORS[i] + '"></i>' + esc(g.namn) + '</span>' : '';
    }).join('') + '<span>● i hörnet = storhelg</span>';
  }

  function select(w) {
    selected = w;
    renderNow();
    renderYear();
  }

  document.getElementById('year-title').textContent = 'Årsöversikt ' + data.ar;
  select(selected);

  document.getElementById('helger').innerHTML = (data.storhelger || []).map(function (h) {
    var gi = groupForWeek(data, h.vecka);
    return '<li><b>' + esc(h.namn) + '</b><br><span class="date">Vecka ' + h.vecka +
      (gi >= 0 ? ' · ' + esc(data.grupper[gi].namn) : '') + '</span></li>';
  }).join('');
}

/* ---------- Kommande aktiviteter / senaste nyheter (kortlistor) ---------- */

function upcomingActivities(n) {
  var t = today();
  return (window.AKTIVITETER || []).filter(function (a) { return parseDate(a.datum) >= t; })
    .sort(function (a, b) { return a.datum < b.datum ? -1 : 1; }).slice(0, n);
}

function renderUpcomingList(el, n) {
  var items = upcomingActivities(n);
  el.innerHTML = items.length ? items.map(function (a) {
    return '<li><b>' + esc(a.titel) + '</b><br><span class="date">' + longDate(a.datum) +
      (a.tid ? ' · ' + esc(a.tid) : '') + (a.plats ? ' · ' + esc(a.plats) : '') + '</span></li>';
  }).join('') : '<li class="muted">Inga kommande aktiviteter.</li>';
}

function renderLatestNews(el, n) {
  var items = (window.NYHETER || []).slice().sort(function (a, b) { return a.datum < b.datum ? 1 : -1; }).slice(0, n);
  el.innerHTML = items.length ? items.map(function (p) {
    return '<li><a href="nyheter.html#' + esc(p.id) + '"><b>' + esc(p.titel) + '</b></a><br>' +
      '<span class="date">' + longDate(p.datum) + '</span></li>';
  }).join('') : '<li class="muted">Inga nyhetsbrev ännu.</li>';
}

/* ---------- Nyhetsbrev ---------- */

function renderNyheter(el) {
  var items = (window.NYHETER || []).slice().sort(function (a, b) { return a.datum < b.datum ? 1 : -1; });
  el.innerHTML = items.length ? items.map(function (p) {
    var body = String(p.text || '').split(/\n\s*\n/).map(function (para) {
      return '<p>' + esc(para.trim()).replace(/\n/g, '<br>') + '</p>';
    }).join('');
    return '<article class="card post" id="' + esc(p.id) + '">' +
      '<h2>' + esc(p.titel) + '</h2><div class="date">' + longDate(p.datum) +
      (p.forfattare ? ' · ' + esc(p.forfattare) : '') + '</div>' +
      '<div class="body">' + body + '</div>' +
      (p.lank ? '<a href="' + esc(p.lank) + '">' + esc(p.lankText || 'Läs hela nyhetsbrevet') + ' →</a>' : '') +
      '</article>';
  }).join('') : '<p class="muted">Inga nyhetsbrev ännu.</p>';
}

/* ---------- Aktiviteter ---------- */

function renderAktiviteter(el) {
  var t = today();
  var items = (window.AKTIVITETER || []).slice().sort(function (a, b) { return a.datum < b.datum ? -1 : 1; });
  var showPast = document.getElementById('show-past');
  function draw() {
    var html = '', month = '';
    items.forEach(function (a) {
      var d = parseDate(a.datum);
      var past = d < t;
      if (past && !showPast.checked) return;
      var m = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
      if (m !== month) { html += '<h2 class="month">' + m + '</h2>'; month = m; }
      html += '<div class="event' + (past ? ' past' : '') + '">' +
        '<div class="day"><b>' + d.getDate() + '</b><span>' + MONTHS[d.getMonth()].slice(0, 3) + '</span></div>' +
        '<div class="card"><h3>' + esc(a.titel) + '</h3><div class="date">' +
        [a.tid, a.plats, a.ansvarig && 'Ansvarig: ' + a.ansvarig].filter(Boolean).map(esc).join(' · ') +
        '</div>' + (a.beskrivning ? '<p>' + esc(a.beskrivning) + '</p>' : '') + '</div></div>';
    });
    el.innerHTML = html || '<p class="muted">Inga kommande aktiviteter.</p>';
  }
  showPast.onchange = draw;
  draw();
}

/* ---------- Telefonbok ---------- */

function renderTelefonbok(data, isExample) {
  if (isExample) document.getElementById('notice').innerHTML = EXAMPLE_NOTICE;
  var el = document.getElementById('phonebook');
  var search = document.getElementById('search');

  function matches(q, p) {
    return !q || (p.namn + ' ' + p.roll + ' ' + p.tel).toLowerCase().indexOf(q) !== -1 ||
      p.tel.replace(/\D/g, '').indexOf(q.replace(/\D/g, '') || '\u0000') !== -1;
  }

  function draw() {
    var q = search.value.trim().toLowerCase();
    var html = '';
    var important = (data.viktigaNummer || []).filter(function (p) { return matches(q, { namn: p.namn, roll: '', tel: p.tel }); });
    if (important.length) {
      html += '<h2>Viktiga nummer</h2><div class="card"><table><tbody>' + important.map(function (p) {
        return '<tr><td>' + esc(p.namn) + '</td><td class="tel">' + telLinks(p.tel) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
    }
    data.grupper.forEach(function (g) {
      var people = g.personal.filter(function (p) { return matches(q, p); });
      if (people.length) html += '<h2>' + esc(g.namn) + '</h2><div class="card">' + staffTable(people, true) + '</div>';
    });
    el.innerHTML = html || '<p class="muted">Inga träffar.</p>';
  }
  search.oninput = draw;
  draw();
}
