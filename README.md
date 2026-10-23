# Tally

Project budgets, funding with proof, expense claims and approvals — built from the *Expense Tracker* design.

- **Next.js 15** (App Router, server actions) — deploys to **Vercel**
- **Supabase** — Postgres with row-level security, Auth (email / SMS one-time codes), Storage (receipts and funding proof)

All money movement (funding, budget changes, claims, approvals, reimbursements) runs inside Postgres functions, so every change is atomic, checked against the rules and written to an audit log that cannot be edited or deleted.

## Screens

| Area | Route | Who |
| --- | --- | --- |
| Sign in (email or SMS code) | `/sign-in` | everyone |
| Create workspace (first sign-in) | `/onboarding` | new owner |
| Overview | `/overview` | owner, admin, approver |
| Projects / New project / Project ledger | `/projects`, `/projects/new`, `/projects/[id]` | approvers read, admins edit |
| Add funds with proof | `/funds/new` | admin |
| Change a budget | `/budget/change` | admin |
| Budget changes & sign-off | `/budget-changes` | admin |
| Approvals & review | `/approvals` | owner, admin, approver |
| All expenses | `/expenses` | owner, admin, approver |
| Reimbursements | `/reimbursements` | admin |
| Reports | `/reports` | owner, admin, approver |
| Team & roles | `/team` | admin |
| Audit log | `/audit` | admin |
| Settings | `/settings` | admin |
| My claims / New claim (worker app) | `/my`, `/my/new` | everyone |

Roles: **owner** and **admin** manage money and people, **approver** decides claims, **worker** submits claims. Anyone can also submit claims on projects they're a member of.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. **Database** — open *SQL Editor*, paste the whole of [`supabase/migrations/20261023000000_init.sql`](supabase/migrations/20261023000000_init.sql) and run it.
   (Or with the CLI: `npx supabase link --project-ref <ref>` then `npx supabase db push`.)
   This creates the tables, policies, functions and the private `proofs` storage bucket.
3. **Auth → Sign In / Providers**
   - *Email*: enabled. "Confirm email" can stay on.
   - *Phone* (only if workers sign in by SMS): enable it and connect an SMS provider (Twilio, MessageBird, Vonage or Textlocal). Without one, add workers with an email instead.
4. **Auth → Email Templates** — Tally signs in with a 6-digit code, so the templates must contain `{{ .Token }}`.
   Paste [`supabase/templates/magic_link.html`](supabase/templates/magic_link.html) into both **Magic Link** and **Confirm signup**
   (subject: `Your Tally sign-in code`).
5. **Auth → URL Configuration**
   - Site URL: your Vercel URL, e.g. `https://tally.vercel.app`
   - Redirect URLs: add `https://tally.vercel.app/auth/confirm` (and `http://localhost:3000/auth/confirm` for local dev)
6. **Auth → SMTP** (recommended for production): Supabase's built-in email is rate-limited to a few emails an hour. Add your own SMTP (Resend, Postmark, SES…).
7. Copy from **Project Settings → API**: the Project URL, the `anon` (or publishable) key and the `service_role` key.

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Name | Where it's used |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | server only — creates logins when an admin adds someone on *Team & roles*. Never expose it. |
| `NEXT_PUBLIC_SITE_URL` | your public URL |

## 3. Deploy to Vercel

1. Import the GitHub repo in Vercel (framework is detected as Next.js — no extra config needed).
2. Add the four environment variables above for Production (and Preview if you use it).
3. Deploy, then put the deployment URL into Supabase *Site URL* / *Redirect URLs* (step 1.5).

## 4. First run

1. Open the app and sign in with your email — you'll get a 6-digit code.
2. You're asked to create a workspace; you become its **owner**.
3. *Team & roles* → add admins/approvers (by email) and workers (by phone or email).
4. *Projects → New project* → set the opening budget (proof required) and who can spend.
5. Workers sign in, open *My claims → New claim*, photograph the receipt and submit.

## Local development

```bash
npm install
cp .env.example .env.local      # fill in your keys
npm run dev                     # http://localhost:3000
```

To run Supabase locally instead (needs Docker): `npx supabase start`, then use the printed API URL and keys in `.env.local`.
Emails (sign-in codes) appear in the local mail catcher at http://127.0.0.1:54324.

Checks: `npm run typecheck` and `npm run build`.

## How the rules work

- **Proof** — funding always needs a file. Claims above the *receipt required* amount without a file are flagged *No receipt*.
- **Auto-approve** — a claim with a file attached, under the auto-approve limit and with no flags is approved instantly (logged as "Tally").
- **Flags** — *Over {admin limit}*, *No receipt*, *Possible duplicate* (same amount and supplier within 30 days), *Over monthly limit*, *Over budget*.
- **Held** — pending claims are held against the budget: *available = budget − approved − held*.
- **Budget floor** — a budget can never go below what's already spent + held.
- **Second sign-off** — decreases/moves/sets that reduce a budget by more than the sign-off amount wait for a *different* admin.
- **Runway** — money left ÷ average approved spend per day over the last 14 days.
- **Reimbursements** — approved "own money" claims are listed per person until marked paid in a batch.

Company defaults live in *Settings*; each project can override them on its *Rules* tab.

## Not included yet

- Push / email notifications — the preferences are saved in *Settings*, but nothing sends them yet.
- Reading receipt totals automatically (OCR). Approvers compare the receipt image with the claim.
- "Export receipts (ZIP)". CSV exports are available on projects, ledgers, expenses, budget changes and the audit log; the Reports "PDF" uses the browser's print-to-PDF.
