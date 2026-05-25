// Captures every form submission on the site and saves it to Supabase.
//
// Why a capture-phase listener: Webflow's own JavaScript binds a submit handler
// that bubbles. By listening on `document` in the CAPTURE phase we run BEFORE
// Webflow's handler and are immune to stopPropagation, so we always get the
// field values. We do NOT call preventDefault(), so nothing about the existing
// page behaviour changes; on a successful save we just show the form's built-in
// "thank you" message (Webflow's own network call usually fails on an exported
// site, so this also fixes the success message).
(function () {
  if (!window.supabase || !window.SUPA_CONFIG) {
    console.warn('[supabase] config or library not loaded; form capture disabled');
    return;
  }

  var sb = window.supabase.createClient(window.SUPA_CONFIG.url, window.SUPA_CONFIG.anonKey);

  // Read the first non-empty value among a list of possible field names.
  function read(form, names) {
    for (var i = 0; i < names.length; i++) {
      var el = form.querySelector('[name="' + names[i] + '"]');
      if (el && el.value && el.value.trim()) return el.value.trim();
    }
    return null;
  }

  // Identify which form was submitted, by its id / action (not field names,
  // which differ from page to page).
  function classify(form) {
    if (form.id === 'email-form-footer') return 'footer';
    if (form.id === 'email-form-subscribe') return 'newsletter';
    if (form.id === 'email-form') return 'contact';
    if (form.getAttribute('action') === '/search') return 'search';
    return null;
  }

  function buildRow(form, type) {
    var base = { form_type: type, page_url: location.pathname + location.search };
    if (type === 'contact') {
      base.name = read(form, ['name', 'name-3', 'Name']);
      base.email = read(form, ['email', 'email-2', 'Email']);
      base.message = read(form, ['field', 'field-2']);
    } else if (type === 'newsletter') {
      base.email = read(form, ['email-2']);
    } else if (type === 'footer') {
      base.email = read(form, ['Email', 'Email-3']);
    } else if (type === 'search') {
      base.query = read(form, ['query']);
    }
    return base;
  }

  // Show the form's built-in success message and hide the form + error message.
  function showDone(form) {
    var wrap = form.closest('.w-form');
    if (!wrap) return;
    var done = wrap.querySelector('.w-form-done');
    var fail = wrap.querySelector('.w-form-fail');
    if (done) done.style.display = 'block';
    if (fail) fail.style.display = 'none';
    form.style.display = 'none';
  }

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement)) return;

    var type = classify(form);
    if (!type) return;

    var row = buildRow(form, type);
    // Skip empty submissions (nothing meaningful to store).
    if (!row.email && !row.query && !row.message && !row.name) return;

    sb.from('submissions').insert(row).then(function (res) {
      if (res.error) {
        console.warn('[supabase] insert failed', res.error);
        return;
      }
      if (type !== 'search') showDone(form); // keep the search box usable
    });
  }, true); // <-- capture phase
})();
