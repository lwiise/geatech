// Dashboard logic: Supabase Auth login + listing/filtering/exporting/deleting
// the form submissions. Reads/deletes only work for a logged-in user (enforced
// by Row Level Security on the database), so the data stays private.
(function () {
  if (!window.supabase || !window.SUPA_CONFIG) {
    alert('Configuration Supabase manquante. Modifiez js/supabase-config.js.');
    return;
  }

  var sb = window.supabase.createClient(window.SUPA_CONFIG.url, window.SUPA_CONFIG.anonKey);

  // ---- Elements ----
  var loginView = document.getElementById('login-view');
  var dashView = document.getElementById('dash-view');
  var loginForm = document.getElementById('login-form');
  var loginBtn = document.getElementById('login-btn');
  var loginError = document.getElementById('login-error');
  var who = document.getElementById('who');
  var rowsEl = document.getElementById('rows');
  var countEl = document.getElementById('count');
  var stateLoading = document.getElementById('state-loading');
  var stateEmpty = document.getElementById('state-empty');
  var filterType = document.getElementById('filter-type');
  var filterText = document.getElementById('filter-text');

  var currentRows = []; // last loaded dataset (for client-side text filter + CSV)

  // ---- Auth view switching ----
  function showLogin() {
    loginView.classList.remove('hidden');
    dashView.classList.add('hidden');
  }
  function showDash(email) {
    loginView.classList.add('hidden');
    dashView.classList.remove('hidden');
    who.textContent = email || '';
    loadData();
  }

  sb.auth.getSession().then(function (res) {
    var session = res.data.session;
    if (session) showDash(session.user.email); else showLogin();
  });
  sb.auth.onAuthStateChange(function (_event, session) {
    if (session) showDash(session.user.email); else showLogin();
  });

  // ---- Login ----
  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginError.textContent = '';
    loginBtn.disabled = true;
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    sb.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      loginBtn.disabled = false;
      if (res.error) {
        loginError.textContent = 'E-mail ou mot de passe incorrect.';
      }
      // success handled by onAuthStateChange
    });
  });

  document.getElementById('logout-btn').addEventListener('click', function () {
    sb.auth.signOut();
  });

  // ---- Data ----
  function loadData() {
    stateEmpty.classList.add('hidden');
    stateLoading.classList.remove('hidden');
    rowsEl.innerHTML = '';

    var q = sb.from('submissions').select('*').order('created_at', { ascending: false });
    if (filterType.value !== 'all') q = q.eq('form_type', filterType.value);

    q.then(function (res) {
      stateLoading.classList.add('hidden');
      if (res.error) {
        stateEmpty.textContent = 'Erreur de chargement : ' + res.error.message;
        stateEmpty.classList.remove('hidden');
        return;
      }
      currentRows = res.data || [];
      render();
    });
  }

  function visibleRows() {
    var term = filterText.value.trim().toLowerCase();
    if (!term) return currentRows;
    return currentRows.filter(function (r) {
      return [r.name, r.email, r.message, r.query, r.page_url]
        .filter(Boolean)
        .some(function (v) { return v.toLowerCase().indexOf(term) !== -1; });
    });
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    return d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function render() {
    var rows = visibleRows();
    countEl.textContent = rows.length + (rows.length === 1 ? ' soumission' : ' soumissions');
    rowsEl.innerHTML = '';

    if (!rows.length) {
      stateEmpty.textContent = 'Aucune soumission pour l’instant.';
      stateEmpty.classList.remove('hidden');
      return;
    }
    stateEmpty.classList.add('hidden');

    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      var emailCell = r.email
        ? '<a class="email-link" href="mailto:' + esc(r.email) + '">' + esc(r.email) + '</a>'
        : '';
      var content = r.form_type === 'search' ? esc(r.query) : esc(r.message);
      tr.innerHTML =
        '<td class="date">' + esc(fmtDate(r.created_at)) + '</td>' +
        '<td><span class="type-badge t-' + esc(r.form_type) + '">' + esc(r.form_type) + '</span></td>' +
        '<td>' + esc(r.name) + '</td>' +
        '<td>' + emailCell + '</td>' +
        '<td class="msg">' + content + '</td>' +
        '<td class="page">' + esc(r.page_url) + '</td>' +
        '<td><button class="del-btn" data-id="' + esc(r.id) + '">Suppr.</button></td>';
      rowsEl.appendChild(tr);
    });
  }

  // ---- Delete ----
  rowsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.del-btn');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    if (!confirm('Supprimer cette soumission ?')) return;
    btn.disabled = true;
    sb.from('submissions').delete().eq('id', id).then(function (res) {
      if (res.error) {
        alert('Suppression impossible : ' + res.error.message);
        btn.disabled = false;
        return;
      }
      currentRows = currentRows.filter(function (r) { return r.id !== id; });
      render();
    });
  });

  // ---- CSV export ----
  function toCsv(rows) {
    var cols = ['created_at', 'form_type', 'name', 'email', 'message', 'query', 'page_url'];
    var head = cols.join(',');
    var lines = rows.map(function (r) {
      return cols.map(function (c) {
        var v = r[c] == null ? '' : String(r[c]);
        return '"' + v.replace(/"/g, '""') + '"';
      }).join(',');
    });
    return head + '\n' + lines.join('\n');
  }
  document.getElementById('csv-btn').addEventListener('click', function () {
    var rows = visibleRows();
    if (!rows.length) { alert('Rien à exporter.'); return; }
    var blob = new Blob(['﻿' + toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'geatech-formulaires-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ---- Filters ----
  filterType.addEventListener('change', loadData);
  filterText.addEventListener('input', render);
  document.getElementById('refresh-btn').addEventListener('click', loadData);
})();
