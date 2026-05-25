# Form Dashboard — Setup Guide

This site now saves every form submission to **Supabase** and shows them in a
private, password-protected dashboard at **`dashboard.html`**.

You only need to do the one-time setup below. After that it works automatically.

---

## 1. Create a Supabase project

1. Go to https://supabase.com and sign in (free tier is enough).
2. Click **New project**. Give it a name (e.g. `geatech`), set a database
   password, and pick a region close to your visitors. Create it.
3. When it's ready, open **Settings → API** and copy these two values:
   - **Project URL** (looks like `https://abcd1234.supabase.co`)
   - **anon public** key (a long string)

   Both are safe to put in the website code — see "Is this secure?" below.

## 2. Create the database table

1. In the Supabase sidebar open **SQL Editor → New query**.
2. Paste **all** of the SQL below and click **Run**.

```sql
create table public.submissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  form_type   text not null check (form_type in ('contact','newsletter','footer','search')),
  name        text,
  email       text,
  message     text,
  query       text,
  page_url    text
);
create index submissions_created_at_idx on public.submissions (created_at desc);
create index submissions_form_type_idx  on public.submissions (form_type);

alter table public.submissions enable row level security;

create policy "anon can insert" on public.submissions
  for insert to anon, authenticated with check (true);
create policy "authenticated can read" on public.submissions
  for select to authenticated using (true);
create policy "authenticated can delete" on public.submissions
  for delete to authenticated using (true);
```

## 3. Create your dashboard login

1. Sidebar → **Authentication → Users → Add user → Create new user**.
2. Email: `hmhstudio.sa@gmail.com` (or whichever email you want to log in with).
   Set a password you'll remember. Tick **Auto Confirm User** if shown.
3. Sidebar → **Authentication → Providers → Email** and turn **OFF**
   "Allow new users to sign up" (so nobody else can register an account).

## 4. Connect the website

Open the file **`js/supabase-config.js`** and replace the two placeholders with
the values you copied in step 1:

```js
window.SUPA_CONFIG = {
  url: 'https://YOUR-PROJECT.supabase.co',   // <- your Project URL
  anonKey: 'YOUR-ANON-KEY'                    // <- your anon public key
};
```

Save the file. That's it.

---

## How to use it

- **Visitors** fill in any form on the site as normal. Each submission is saved
  automatically.
- **You** open `dashboard.html` (e.g. `https://your-site.com/dashboard.html`),
  log in with the email/password from step 3, and see everything:
  - Filter by form type (contact / newsletter / footer / search)
  - Search by name, email, or message text
  - Export everything to a CSV (Excel) file
  - Delete unwanted/spam rows

## Is this secure?

Yes. The `anon` key in the website can **only add** submissions — exactly like
any public web form. **Reading and deleting** submissions requires logging into
the dashboard (enforced by the database's Row Level Security policies in step 2).
So even though `dashboard.html` is a public file, it shows nothing until someone
logs in with your account.

> Never put the **`service_role`** key (also in Settings → API) into any website
> file — that one bypasses security. Only the **anon public** key belongs here.

## Testing it works

1. Open the contact page and submit the form → you should see the "thank you"
   message. In Supabase, **Table Editor → submissions** should show a new row.
2. Open `dashboard.html`, log in, and the submission should appear in the table.

## Notes

- Form fields differ between pages; the capture script already handles this. If
  you rename form fields later, update the name lists in
  `js/supabase-capture.js`.
- If spam submissions start appearing, ask to add a hidden "honeypot" anti-bot
  field — it's a small addition.
