# DenkerAI

Learn German with AI-generated flashcards and an Anki-style spaced repetition system.
Plain HTML, CSS and vanilla JavaScript (ES modules) on the front end; Vercel Serverless
Functions, Prisma and PostgreSQL on the back end. Built by Yessine Ghariani.

## How it works

| Area | Files |
| --- | --- |
| Pages | `public/*.html`, one script per page in `public/js/` |
| Design tokens and components | `public/css/style.css` |
| Auth (bcryptjs cost 12, JWT in httpOnly cookie, 30 days) | `api/auth/*`, `api/_lib/auth.js` |
| AI calls (Anthropic Messages API, server-side) | `api/_lib/ai.js` |
| Spaced repetition (SM-2, Anki defaults) | `api/_lib/srs.js` (tested in `test/srs.test.mjs`) |
| Level test bank (12 questions) | `api/_lib/levelBank.js` |
| Database | `prisma/schema.prisma` |

Flow: sign up, choose level, optional test, first collection, dashboard, practice.
Every protected page calls `GET /api/me` and redirects to `login.html` on 401.

## Run locally

```bash
npm install                 # also runs prisma generate
cp .env.example .env        # fill in the four values
npx prisma db push          # creates the tables
npx vercel dev              # serves /public and /api on http://localhost:3000
npm test                    # SRS scheduler tests
```

`vercel dev` is needed because the `/api` folder uses Vercel's function format.
Note: the session cookie is marked `Secure`; browsers accept it on `localhost`, but not on a plain-HTTP LAN address.

## Deploy (GitHub + Vercel + Neon)

1. Create a database at [neon.tech](https://neon.tech). Copy the pooled connection string (`DATABASE_URL`) and the direct one (`DIRECT_URL`).
2. Push this folder to a new GitHub repository.
3. On [vercel.com](https://vercel.com) choose Add New, Project, and import the repository. No framework preset and no build command are needed.
4. Under Settings, Environment Variables add `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `AI_API_KEY` and `AI_MODEL` (see `.env.example`).
5. Create the tables once from your machine with the same variables in `.env`: `npx prisma db push`.
6. Deploy. Every push to `main` redeploys automatically.

Using Vercel Postgres instead of Neon works the same way: copy its two connection strings into `DATABASE_URL` and `DIRECT_URL`.

## Decisions

Choices the specification left open:

- **JWT secret:** a fifth environment variable, `JWT_SECRET` (32+ characters).
- **Study day:** the "20 new cards per day" limit resets at midnight UTC, counted per collection from the review log.
- **Collection size:** the AI is asked for exactly 20 cards. Cards that are empty or duplicated are dropped; at least 5 must remain.
- **Quick test grading:** the answer key stays on the server. `/api/level/questions` sends questions without answers and `/api/level/estimate` grades them. If the AI call fails, a rule-based estimate (highest level with 2 of 3 correct) is used.
- **Due today:** cards in learning or review whose time has come, plus the new cards still allowed today.
- **Learning cards in a session:** a card still in learning that is due within 20 minutes returns later in the same session; others wait for their due time.
- **Fuzz:** review intervals of 3 days or more get a random spread of plus or minus 5%.
- **Lapses:** Anki's default, a lapsed card restarts at 1 day after relearning.
- **Avatar:** clicking the avatar logs out (no separate menu in the mockups).
- **Delete collection:** `DELETE /api/collections/[id]` exists, but the mockups show no delete button, so the UI does not expose it yet.
- **Pronunciation:** the browser's speech synthesis (German voice) on button press. No autoplay.
- **Security headers:** a strict Content-Security-Policy in `vercel.json`. `style-src` allows inline styles because the pages use a few `style=""` attributes.
- **Privacy page:** written for a student project; check it with the real hosting details before a public launch.
- **Rate limiting:** not included. Add it before opening sign-ups to the public, since each new collection costs one AI call.

## Security notes

- Secrets only come from environment variables; the AI key never reaches the browser.
- All user text is rendered with `textContent`, never `innerHTML`.
- State-changing routes accept only POST or DELETE, and the cookie is `SameSite=Lax`.
- Every query on collections and cards is filtered by the logged-in user's id.
