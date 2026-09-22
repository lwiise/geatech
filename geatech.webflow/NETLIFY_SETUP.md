# Netlify Forms — Setup Guide

Every form on the site now posts to **Netlify Forms**. Submissions are stored in
your Netlify dashboard and Netlify e-mails you as soon as one arrives.

The code side is done. What is left is the one-time setup below, in the Netlify
dashboard (steps 1–3), which takes about five minutes.

---

## The three forms

| Netlify form name | Where it is                          | Fields sent            |
| ----------------- | ------------------------------------ | ---------------------- |
| `contact`         | Contact page + home page             | name, email, message   |
| `newsletter`      | "Vous souhaitez être informé…" block | email                  |
| `footer`          | Footer of every page                 | email                  |

The forms are declared twice: once in the real Webflow markup on the pages, and
once in the plainest possible HTML on **`forms.html`**, a hidden page nobody
visits. Netlify merges form definitions by name, so the copies on `forms.html`
guarantee the three forms get registered even if Netlify's detector cannot read
Webflow's dense exported markup. **If you rename or add a field, change it in
both places.**

Every submission also carries a `page` field (which page it came from) and a
`subject` field, which Netlify uses as the **subject line of the notification
e-mail**. To change a subject line, edit the `value=""` of the hidden
`subject` input inside that form in the HTML.

The site's search box is **not** a Netlify form — it still just searches.

---

## 1. Deploy the site to Netlify

1. Go to https://app.netlify.com and sign in.
2. **Add new site → Import an existing project** and pick this Git repository
   (or **Deploy manually** and drag the `geatech.webflow` folder in).
3. Leave the build settings as they are: `netlify.toml` in the repository
   already tells Netlify to publish the `geatech.webflow` folder and that there
   is no build command.
4. Click **Deploy**.

## 2. Turn on form detection

Netlify only looks for forms when this is switched on.

1. Open your site → **Project configuration → Forms**.
2. Under **Form detection**, click **Enable form detection**.
3. Go to **Deploys → Trigger deploy → Deploy site** to redeploy.
   Form detection happens *during a deploy*, so this redeploy is required —
   without it the forms list stays empty. Watch for a **new row at the top of
   the deploy list** and wait for it to say *Published*: if no new row appears,
   the deploy did not run and detection still has not happened.
   (Any push to `main` also triggers a deploy, which does the same job.)
4. Open **Forms**: `contact`, `newsletter` and `footer` should now be listed.

## 3. Turn on e-mail notifications

1. Still in **Project configuration → Forms**, scroll to **Form notifications**.
2. Click **Add notification → Email notification**.
3. Fill in:
   - **Event to listen for**: *New form submission*
   - **Form**: `contact`
   - **Email to notify**: `info@geatech.ch` (several addresses, comma separated,
     also work)
4. **Save**.
5. Repeat steps 2–4 for `newsletter` and `footer` — one notification per form,
   so you can send them to different people if you want.

That's it. Every submission now lands in your inbox, and the e-mail's
**Reply** button answers the visitor directly (Netlify uses the submitted
`email` field as the reply-to address).

---

## Testing it works

1. Open the deployed site (not the local files — form posts only work on
   Netlify) and send a test message from the contact page.
2. You should stay on the page and see the green "thank you" message.
3. **Forms → contact** in Netlify shows the submission, and the notification
   e-mail arrives within a minute.
4. If nothing arrives, check your spam folder first, then
   **Forms → Usage** (see limits below).

## Good to know

- **Free plan limits**: 100 submissions per month across all forms, and 100 MB
  of uploads. Above that Netlify pauses form handling until the next month or
  until you upgrade (Forms Level 1) — submissions over the limit are lost, so
  keep an eye on **Forms → Usage** if the site gets busy.
- **Spam**: every form contains a hidden "honeypot" field (`bot-field`). Bots
  fill it in, humans never see it, and Netlify drops those submissions
  automatically. Netlify also runs Akismet spam filtering; anything it flags
  lands in **Forms → Spam** instead of your inbox.
- **Stronger protection**: if spam still gets through, add reCAPTCHA 2 — one
  line of HTML per form (`data-netlify-recaptcha="true"` plus a
  `<div data-netlify-recaptcha="true"></div>` before the submit button). Ask
  and it can be added.
- **Exporting**: **Forms → [form name] → Download as CSV** exports everything.

## How it works, in short

- `js/netlify-forms.js` intercepts the submit, sends the fields to Netlify with
  `fetch()`, and then shows the form's own "thank you" message. The visitor
  never leaves the page, and Webflow's exported form script (which tries to
  call Webflow's servers and fails on an exported site) is bypassed.
- Netlify itself discovers the forms by reading the deployed HTML — that is
  what the `data-netlify="true"` attribute and the hidden `form-name` field in
  each form are for. This is why **a redeploy is needed after any change to a
  form's fields**, otherwise Netlify keeps the old field list.

## Troubleshooting

**First, is the current code even deployed?** Open `/netlify-check.html` on your
site. If Netlify answers **Page not found**, the deploy you are looking at is
older than these changes — check **Deploys** in Netlify (is the site linked to
this Git repository and the `main` branch? did the last deploy succeed?). Until
that page loads, the form is still running the old Webflow code, whose error
message looks exactly the same.

**Then: open `/netlify-check.html`** (e.g.
`https://your-site.netlify.app/netlify-check.html`) and click *Run the check*.
It sends a test submission to each form and tells you in plain language what is
wrong and how to fix it. It is not linked from the site and is hidden from
search engines. The three test submissions it creates show up as *NETLIFY
CHECK* in **Forms** — delete them once you've seen them.

| Symptom                                       | Fix                                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Forms list is empty in Netlify                 | Form detection was off during the last deploy → enable it (step 2) and redeploy.                   |
| `/netlify-check.html` gives a 404              | The deployed site is older than these changes. Check **Deploys**: repository, branch, and that the last deploy succeeded. |
| Red "Oops! Something went wrong" on the site   | Run `/netlify-check.html` (above). Usually: you are testing the local files, or step 2 hasn't been done yet. The browser console also prints the exact reason. |
| Submissions arrive, no e-mail                  | The notification is per form — check that one exists for *that* form, and look in spam.            |
| A new field doesn't show up in the e-mail      | Redeploy the site; Netlify refreshes the field list only during a deploy.                          |
