# Shipping the WB Blends Portal

You want to share the portal with people on your team so they can open it in
a browser and click around. The fastest way is **Vercel** — it's free, it's
the company that builds Next.js, and it auto-detects everything in this repo.

## Path A — One-time deploy from your laptop (fastest, ~5 minutes)

Use this if you just want a shareable URL and don't want to deal with GitHub
yet. Each time you change something, you'll re-run `vercel` from this folder
to push a new version.

1. **Sign up for Vercel** (free)
   Go to https://vercel.com/signup and create an account. Log in with GitHub,
   Google, or email — any of those work.

2. **Install the Vercel command-line tool** in any terminal (PowerShell or
   the Bash shell). Just once on your machine:

   ```powershell
   npm install -g vercel
   ```

3. **From this project folder, deploy**:

   ```powershell
   cd C:\Users\devin\OneDrive\Desktop\wb-blends-portal
   vercel
   ```

   It will ask a few questions — **press Enter** to accept the default for
   each. The first time it'll ask:
   - "Set up and deploy?" → Y
   - "Which scope?" → your account
   - "Link to existing project?" → N
   - "What's your project's name?" → wb-blends-portal (or anything)
   - "In which directory is your code located?" → ./

4. **Send the URL to your team.** When it finishes you'll see a link that
   looks like `https://wb-blends-portal-abc123.vercel.app`. That's the
   shareable URL. Anyone with that link can open it in their browser. Tell
   them the demo login: `dsimmons` / `test`.

5. **To push updates later**, just `cd` back into this folder and run
   `vercel` again. Run `vercel --prod` to overwrite the production URL
   instead of creating a preview link.

## Path B — Connect to GitHub (auto-deploy on every change)

Use this if you want changes to deploy automatically every time you save the
project. More setup up front, less work later.

1. **Make a GitHub account** at https://github.com/signup if you don't
   already have one.

2. **Create a new empty repo** at https://github.com/new — name it
   `wb-blends-portal`, leave everything else default, click Create.

3. **Push this project to it.** From PowerShell in this folder:

   ```powershell
   git init
   git add .
   git commit -m "Initial WB Blends portal"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/wb-blends-portal.git
   git push -u origin main
   ```

   GitHub may ask you to log in the first time.

4. **Import to Vercel.** Go to https://vercel.com/new, pick your GitHub
   repo, and click Deploy. Vercel detects Next.js automatically — no
   configuration needed.

5. **Your URL is live.** Vercel shows it on the dashboard, e.g.
   `https://wb-blends-portal.vercel.app`. From now on, every time you push
   a change to GitHub, Vercel rebuilds and the URL updates within ~60 seconds.

## Locking it down

The portal requires sign-in for everything except `/login` and the public
auth pages. Things to do before sharing externally:

- **Change the demo password.** Sign in as `dsimmons` / `test`, then go to
  Account → Security to enroll 2FA, or use Forgot password to set a real
  one. Once you do, also delete the "Demo credentials" hint from
  `app/login/login-form.tsx`.
- **Add real users from the admin UI.** Sign in as an admin and go to
  Admin → Users → New user. Each user gets an email with a link to set their
  own password — no manual JSON editing needed.
- **Vercel Deployment Protection** (paid feature) — adds a Vercel-managed
  password gate in front of the whole site. Configure in Project Settings
  → Deployment Protection.
- **Recommend 2FA for admins.** Each user can enroll a TOTP authenticator at
  Account → Security.

## Production environment variables

Set these in Vercel: Project → Settings → Environment Variables. See
`.env.example` for the full annotated list. The must-haves:

- `SESSION_SECRET` — long random string used to sign auth cookies. Generate
  with `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`.
- `DATABASE_URL` + `DATABASE_AUTH_TOKEN` — Vercel can't write to disk, so
  point at a hosted LibSQL. [Turso](https://turso.tech) has a generous free
  tier and is the easiest path.
- `RESEND_API_KEY` + `EMAIL_FROM` — needed for invite + password-reset
  emails. The sender domain (`wbcustomerportal.com` by default) must be
  verified in Resend before mail will deliver to inboxes.
- `PUBLIC_BASE_URL` — your Vercel URL or custom domain, used to build links
  in outbound emails.

Without `RESEND_API_KEY` the app still runs, but invite/reset emails print
to the server console instead of being sent.

## Custom domain (optional)

Once it's live on a `*.vercel.app` URL, you can point a real domain at it:

1. In Vercel: Project → Settings → Domains → Add `portal.wbblends.com` (or
   whatever subdomain you want).
2. Vercel gives you a CNAME record. Add it to your DNS provider (Cloudflare,
   Squarespace, GoDaddy, etc.).
3. ~5 minutes later, the custom URL works and Vercel auto-issues an HTTPS
   certificate.

## What it costs

Vercel's free Hobby plan covers everything we're using: Next.js hosting,
image optimization, custom domain, HTTPS. The only time you'd need to pay is
if you start sending hundreds of thousands of visits a month or want
Deployment Protection. For a customer portal with placeholder data shared
with your team, free is enough.

## When real APIs are ready

When Acumatica + the proprietary system are wired in, you'll need to:

1. Add their API credentials as **environment variables** in Vercel
   (Project → Settings → Environment Variables — never put secrets in code).
2. Replace the mock implementations in `lib/data/*.ts` with real API
   calls. Pages and components don't need to change.

That part is for whoever is wiring the integrations — none of it affects the
deploy flow above.
