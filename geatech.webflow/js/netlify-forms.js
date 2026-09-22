// Sends every public form on the site to Netlify Forms.
//
// Netlify picks up the forms at deploy time by reading the HTML (that is what
// the `data-netlify="true"` attribute and the hidden `form-name` field are
// for), but the submission itself is sent from here with fetch() instead of a
// normal page POST. Two reasons:
//   1. the visitor stays on the page and sees the form's own "thank you"
//      message, exactly like before;
//   2. Webflow's exported script binds its own submit handler that tries to
//      call Webflow's API (which fails on an exported site and shows the red
//      error box). We listen in the CAPTURE phase and stop propagation, so
//      Webflow's handler never runs.
(function () {
  'use strict';

  // Netlify accepts form posts on any path of the site; "/" is the documented
  // endpoint for JavaScript submissions.
  var ENDPOINT = '/';

  function wrapper(form) {
    return form.closest('.w-form');
  }

  // Netlify Forms only work on the deployed Netlify site, and only once form
  // detection has run during a deploy. When a submission fails, say which of
  // those it is instead of just "something went wrong".
  function diagnose(status) {
    if (location.protocol === 'file:' || /^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) {
      return 'This page is not running on Netlify (' + location.origin + '), so there is ' +
             'nothing to receive the form. Test on the deployed Netlify URL.';
    }
    if (status === 404) {
      return 'Netlify does not know this form yet. Turn on Project configuration -> ' +
             'Forms -> Form detection, then redeploy the site: detection only runs ' +
             'during a deploy. See NETLIFY_SETUP.md, step 2.';
    }
    if (status === 405) {
      return 'The server refused a POST, which means this site is not being served ' +
             'by Netlify (or Netlify form handling is off). See NETLIFY_SETUP.md, step 1.';
    }
    if (status === 0) {
      return 'The request never reached the server - no connection, or it was blocked ' +
             'by the browser.';
    }
    return 'Netlify answered with HTTP ' + status + '. Open /netlify-check.html on the ' +
           'deployed site for a full diagnosis.';
  }

  // Swap the submit button label for its data-wait text while sending.
  function startSending(form) {
    var btn = form.querySelector('[type="submit"]');
    if (!btn) return null;
    var wait = btn.getAttribute('data-wait');
    var label = btn.value;
    btn.disabled = true;
    if (wait) btn.value = wait;
    return function restore() {
      btn.disabled = false;
      btn.value = label;
    };
  }

  function showDone(form) {
    var wrap = wrapper(form);
    if (!wrap) return;
    var done = wrap.querySelector('.w-form-done');
    var fail = wrap.querySelector('.w-form-fail');
    if (done) done.style.display = 'block';
    if (fail) fail.style.display = 'none';
    form.style.display = 'none';
  }

  // Show the form's error box, with the reason underneath it. A bare "something
  // went wrong" is unactionable: whoever is looking at the page needs to know
  // whether Netlify rejected the form, never saw it, or was never asked.
  function showFail(form, detail) {
    var wrap = wrapper(form);
    if (!wrap) return;
    var fail = wrap.querySelector('.w-form-fail');
    if (!fail) return;
    fail.style.display = 'block';

    var note = fail.querySelector('.netlify-error-detail');
    if (!note) {
      note = document.createElement('div');
      note.className = 'netlify-error-detail';
      note.style.cssText = 'margin-top:8px;font-size:12px;line-height:1.5;opacity:.8;' +
                           'text-align:left;word-break:break-word;';
      fail.appendChild(note);
    }
    note.textContent = detail;
  }

  // Build the url-encoded body Netlify expects.
  function encode(form) {
    var data = new FormData(form);
    // Which page the visitor was on when they submitted (shown in the e-mail).
    data.set('page', location.pathname + location.search);
    // Safety net in case the hidden field is ever removed from the markup.
    if (!data.get('form-name')) data.set('form-name', form.getAttribute('name'));

    var params = new URLSearchParams();
    data.forEach(function (value, key) {
      if (typeof value === 'string') params.append(key, value);
    });
    return params.toString();
  }

  // Say out loud that this file is live and which forms it will handle. Without
  // it, a quiet console is ambiguous: it looks the same whether the handler is
  // working or was never loaded at all.
  var found = [].slice.call(document.querySelectorAll('form[data-netlify]'))
    .map(function (f) { return f.getAttribute('name'); });
  console.info('[netlify] form handler ready - ' +
    (found.length ? found.length + ' form(s) on this page: ' + found.join(', ')
                  : 'no Netlify form on this page'));

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.hasAttribute('data-netlify')) return;

    // Replaces both the browser's page POST and Webflow's own handler.
    e.preventDefault();
    e.stopPropagation();

    if (form.dataset.sending === 'true') return; // double-click guard
    form.dataset.sending = 'true';

    var restore = startSending(form);
    var body = encode(form);

    function send(path) {
      return fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      }).then(function (res) {
        if (res.ok) return res;
        var err = new Error('HTTP ' + res.status);
        err.status = res.status;
        throw err;
      });
    }

    // No retry on another path: a host that answers POST by serving the page
    // would return 200 and we would show "thank you" for a message nobody
    // received. A failure here is reported, never papered over.
    send(ENDPOINT)
      .then(function () {
        console.info('[netlify] "' + form.getAttribute('name') + '" accepted');
        showDone(form);
      })
      .catch(function (err) {
        var why = diagnose(err.status || 0);
        console.warn('[netlify] submission of form "' + form.getAttribute('name') +
                     '" failed: ' + err.message + '\n' + why);
        form.dataset.sending = 'false';
        if (restore) restore();
        showFail(form, 'Netlify: ' + err.message + ' — ' + why);
      });
  }, true); // <-- capture phase, before Webflow's handler
})();
