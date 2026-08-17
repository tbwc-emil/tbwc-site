/* Shared Orders grid — used by admin.html (mode: 'admin', full columns, add/edit)
   and portal.html (mode: 'rep', 8-column subset, read-only — RLS filters rows to
   the signed-in rep's own orders via orders.rep_id = auth.uid()).
   One column/format/sort/filter definition lives here so both pages stay in sync. */
(function () {
  'use strict';

  // Canonical column list. `repVisible` marks the 8 columns reps are allowed to see.
  var ALL_COLUMNS = [
    { key: 'customer', label: 'Customer' },
    { key: 'build_notes', label: 'Build Notes' },
    { key: 'exp', label: 'Exp' },
    { key: 'inv_stat', label: 'Invoice Status', repVisible: true },
    { key: 'tbwc_number', label: 'TBWC#', repVisible: true },
    { key: 'po_number', label: 'PO#', repVisible: true },
    { key: 'received_date', label: "Rec'd", type: 'date', repVisible: true },
    { key: 'ship_nlt', label: 'Ship NLT' },
    { key: 'shipment_date', label: 'Ship Status', repVisible: true },
    { key: 'rep', label: 'Rep', repVisible: true },
    { key: 'rep_id', label: 'Assigned Rep', type: 'rep' },
    { key: 'job_name', label: 'Job Name', repVisible: true },
    { key: 'jay', label: 'Jay' },
    { key: 'notes', label: 'Notes', repVisible: true },
    { key: 'dnc', label: 'DNC', type: 'money' },
    { key: 'sold_for', label: 'Sold For', type: 'money' },
    { key: 'comm_15', label: 'Comm 15%', type: 'money' },
    { key: 'ovg_75_25', label: 'OVG 75/25', type: 'money' },
    { key: 'proj_adm', label: 'Proj Adm', type: 'money' },
    { key: 'comm_total', label: 'Comm Total', type: 'money' },
    { key: 'trade_ally', label: 'Trade Ally' },
    { key: 'su', label: 'SU' }
  ];

  // Rep-facing view: exactly these 8 columns, in this order.
  var REP_VIEW_KEYS = ['inv_stat', 'shipment_date', 'tbwc_number', 'po_number', 'received_date', 'job_name', 'rep', 'notes'];

  function colByKey(key) {
    return ALL_COLUMNS.filter(function (c) { return c.key === key; })[0];
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function fmtMoney(v) {
    if (v === null || v === undefined || v === '') return '';
    return '$' + Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Plain "YYYY-MM-DD" from the db — format as calendar date, not a UTC instant
  // (new Date('2026-01-02') + toLocaleDateString would shift a day back in US zones).
  function fmtPlainDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
    if (!m) return '';
    var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function injectStyles() {
    if (document.getElementById('og-styles')) return;
    var style = document.createElement('style');
    style.id = 'og-styles';
    style.textContent =
      '.og__wrap{border:1px solid var(--rule-2);border-radius:10px;overflow-x:auto;background:var(--bg)}' +
      '.og__table{width:100%;border-collapse:collapse;font-size:13px}' +
      '.og__table th{text-align:left;font-family:var(--f-mono);font-size:11px;text-transform:uppercase;' +
        'letter-spacing:.06em;color:var(--ink-3);padding:10px 12px;border-bottom:1px solid var(--rule-2);white-space:nowrap}' +
      '.og__table td{padding:12px;border-bottom:1px solid var(--rule);color:var(--ink-2);vertical-align:middle;white-space:nowrap}' +
      '.og__table tr:last-child td{border-bottom:0}' +
      '.og__sortable{cursor:pointer;user-select:none}' +
      '.og__sortable:hover{color:var(--ink)}' +
      '.og__sortarrow{font-size:9px}' +
      '.og__filterrow th{padding:6px 12px;border-bottom:1px solid var(--rule-2)}' +
      '.og__filterrow input{width:100%;box-sizing:border-box;font-size:11px;padding:4px 6px;' +
        'border:1px solid var(--rule-2);border-radius:5px;background:var(--bg)}' +
      '.og__table input[data-field],.og__table select[data-field]{width:100%;box-sizing:border-box;font-size:12px;' +
        'padding:4px 6px;border:1px solid var(--rule-2);border-radius:5px;background:var(--bg)}' +
      '.og__empty{padding:40px;text-align:center;color:var(--ink-3)}' +
      '.og__msg{font-size:13px;margin-bottom:16px}';
    document.head.appendChild(style);
  }

  // opts: { sb, mode: 'admin'|'rep', container, msgEl, countEl }
  function create(opts) {
    injectStyles();
    var sb = opts.sb;
    var editable = opts.mode === 'admin';
    var container = opts.container;
    var msgEl = opts.msgEl;
    var countEl = opts.countEl;

    var columns = editable ? ALL_COLUMNS.slice() : REP_VIEW_KEYS.map(colByKey);

    var rows = [];
    var editingId = null;        // null | 'new' | a row's id
    var NEW_ROW = { id: 'new' };
    var sortState = { key: 'received_date', dir: 'desc' };
    var repOptions = [];         // [{id,label}] — admin-only, for the Assigned Rep dropdown

    function showMsg(text, isError) {
      if (!msgEl) return;
      msgEl.textContent = text || '';
      msgEl.style.display = text ? 'block' : 'none';
      msgEl.style.color = isError ? '#c0392b' : '#1e7e34';
    }

    function repLabel(id) {
      var m = repOptions.filter(function (r) { return r.id === id; })[0];
      return m ? m.label : '';
    }

    function fmtCell(row, col) {
      var v = row[col.key];
      if (col.type === 'money') return fmtMoney(v);
      if (col.type === 'date') return v ? fmtPlainDate(v) : '';
      if (col.type === 'rep') return esc(v ? repLabel(v) : '');
      return esc(v == null ? '' : v);
    }

    function inputForCol(col, value) {
      var raw = value == null ? '' : value;
      if (col.type === 'rep') {
        var opts = '<option value="">—</option>' + repOptions.map(function (r) {
          return '<option value="' + esc(r.id) + '"' + (r.id === value ? ' selected' : '') + '>' + esc(r.label) + '</option>';
        }).join('');
        return '<select data-field="' + esc(col.key) + '">' + opts + '</select>';
      }
      var type = col.type === 'money' ? 'number' : (col.type === 'date' ? 'date' : 'text');
      var extra = col.type === 'money' ? ' step="0.01"' : '';
      return '<input type="' + type + '" data-field="' + esc(col.key) + '"' + extra + ' value="' + esc(raw) + '" />';
    }

    function compareRows(a, b) {
      var col = colByKey(sortState.key);
      var av = a[sortState.key], bv = b[sortState.key];
      var result;
      if (col && col.type === 'money') {
        result = (av == null ? -Infinity : Number(av)) - (bv == null ? -Infinity : Number(bv));
      } else if (col && col.type === 'rep') {
        result = repLabel(av).toLowerCase().localeCompare(repLabel(bv).toLowerCase());
      } else {
        // date columns are "YYYY-MM-DD" strings — lexical compare sorts them correctly too.
        result = String(av == null ? '' : av).toLowerCase().localeCompare(String(bv == null ? '' : bv).toLowerCase());
      }
      return sortState.dir === 'asc' ? result : -result;
    }

    function rowHtml(row, editing) {
      var cells = columns.map(function (col) {
        return '<td>' + (editing ? inputForCol(col, row[col.key]) : fmtCell(row, col)) + '</td>';
      }).join('');
      if (!editable) return '<tr data-row="' + esc(row.id) + '">' + cells + '</tr>';
      var action = editing
        ? '<button class="btn btn--primary btn--sm" data-save="' + esc(row.id) + '">Save</button> ' +
          '<button class="btn btn--ghost btn--sm" data-cancel>Cancel</button>'
        : '<button class="btn btn--ghost btn--sm" data-edit="' + esc(row.id) + '">Edit</button>';
      return '<tr data-row="' + esc(row.id) + '">' + cells + '<td>' + action + '</td></tr>';
    }

    function updateSortArrows() {
      container.querySelectorAll('[data-sort-arrow]').forEach(function (span) {
        var key = span.getAttribute('data-sort-arrow');
        span.textContent = key !== sortState.key ? '' : (sortState.dir === 'asc' ? '▲' : '▼');
      });
    }

    function renderRows() {
      var filters = {};
      container.querySelectorAll('[data-filter]').forEach(function (inp) {
        var val = inp.value.trim().toLowerCase();
        if (val) filters[inp.getAttribute('data-filter')] = val;
      });
      var visible = rows.filter(function (row) {
        return Object.keys(filters).every(function (key) {
          var col = colByKey(key);
          var cell = col && col.type === 'rep' ? repLabel(row[key]) : row[key];
          return String(cell == null ? '' : cell).toLowerCase().indexOf(filters[key]) !== -1;
        });
      }).sort(compareRows);

      var body = container.querySelector('[data-og-body]');
      var html = editable && editingId === 'new' ? rowHtml(NEW_ROW, true) : '';
      var colspan = columns.length + (editable ? 1 : 0);
      html += visible.length
        ? visible.map(function (row) { return rowHtml(row, editable && row.id === editingId); }).join('')
        : (editable && editingId === 'new' ? '' : '<tr><td colspan="' + colspan + '" class="og__empty">No matching orders.</td></tr>');
      body.innerHTML = html;
      if (countEl) countEl.textContent = visible.length + ' of ' + rows.length;
    }

    function readForm(tr) {
      var obj = {};
      columns.forEach(function (col) {
        var inp = tr.querySelector('[data-field="' + col.key + '"]');
        var val = inp.value;
        if (val === '') { obj[col.key] = null; return; }
        obj[col.key] = col.type === 'money' ? Number(val) : val;
      });
      return obj;
    }

    function onGridClick(e) {
      var sortTh = e.target.closest('[data-sort-col]');
      if (sortTh) {
        var key = sortTh.getAttribute('data-sort-col');
        if (sortState.key === key) sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
        else { sortState.key = key; sortState.dir = 'asc'; }
        updateSortArrows();
        renderRows();
        return;
      }
      if (!editable) return;
      var editBtn = e.target.closest('[data-edit]');
      if (editBtn) {
        var idAttr = editBtn.getAttribute('data-edit');
        var match = rows.filter(function (r) { return String(r.id) === idAttr; })[0];
        editingId = match ? match.id : idAttr;
        renderRows();
        return;
      }
      var cancelBtn = e.target.closest('[data-cancel]');
      if (cancelBtn) { editingId = null; renderRows(); return; }
      var saveBtn = e.target.closest('[data-save]');
      if (saveBtn) {
        var tr = saveBtn.closest('tr');
        var obj = readForm(tr);
        saveBtn.disabled = true;
        if (saveBtn.getAttribute('data-save') === 'new') {
          sb.from('order').insert(obj).select().single().then(function (res) {
            if (res.error) { saveBtn.disabled = false; showMsg(res.error.message, true); return; }
            rows.unshift(res.data);
            editingId = null;
            showMsg('Order added.', false);
            renderRows();
          });
        } else {
          var id = rows.filter(function (r) { return r.id === editingId; })[0].id;
          sb.from('order').update(obj).eq('id', id).select().single().then(function (res) {
            if (res.error) { saveBtn.disabled = false; showMsg(res.error.message, true); return; }
            var idx = rows.findIndex(function (r) { return r.id === id; });
            if (idx !== -1) rows[idx] = res.data;
            editingId = null;
            showMsg('Order saved.', false);
            renderRows();
          });
        }
      }
    }

    function paint() {
      container.innerHTML =
        '<table class="og__table"><thead><tr>' +
          columns.map(function (c) {
            return '<th class="og__sortable" data-sort-col="' + esc(c.key) + '">' + esc(c.label) +
              ' <span class="og__sortarrow" data-sort-arrow="' + esc(c.key) + '"></span></th>';
          }).join('') + (editable ? '<th></th>' : '') +
        '</tr><tr class="og__filterrow">' +
          columns.map(function (c) {
            return '<th><input type="text" data-filter="' + esc(c.key) + '" placeholder="Filter…" /></th>';
          }).join('') + (editable ? '<th></th>' : '') +
        '</tr></thead><tbody data-og-body></tbody></table>';
      container.querySelectorAll('[data-filter]').forEach(function (inp) {
        inp.addEventListener('input', renderRows);
      });
      container.addEventListener('click', onGridClick);
      updateSortArrows();
      renderRows();
    }

    function load() {
      container.innerHTML = '<div class="og__empty">Loading…</div>';
      var selectCols = ['id'].concat(columns.map(function (c) { return c.key; }));
      if (editable && selectCols.indexOf('rep_id') === -1) selectCols.push('rep_id');

      var repsReady = editable
        ? sb.from('users').select('id,first_name,last_name').eq('type', 'rep').then(function (res) {
            repOptions = (res.data || []).map(function (r) {
              return { id: r.id, label: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.id };
            });
          })
        : Promise.resolve();

      return repsReady.then(function () {
        return sb.from('order').select(selectCols.join(',')).order('received_date', { ascending: false });
      }).then(function (res) {
        if (res.error) {
          container.innerHTML = '<div class="og__empty">' + esc(res.error.message) + '</div>';
          return;
        }
        rows = res.data || [];
        paint();
      });
    }

    function addNew() {
      if (!editable) return;
      editingId = 'new';
      renderRows();
    }

    return { load: load, addNew: addNew };
  }

  window.TBWCOrdersGrid = { create: create };
})();
