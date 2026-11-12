# DenkerAI - AI German Flashcards & Spaced Repetition

> **Hallo!** Ich bewerbe mich für eine Ausbildung. This is a language learning web application I built.

## About the Project
DenkerAI is a full-stack web application designed to help people learn German. Instead of manually creating study materials, the app uses an LLM to generate custom flashcard collections and an Anki-style spaced repetition system (SRS) to schedule when you should review them.

I built this using pure Vanilla JavaScript on the frontend to prove I can handle complex state and API communication without relying on heavy frameworks like React or Next.js. 

## The Tech Stack
* **Frontend:** Plain HTML, CSS, and Vanilla JavaScript (ES modules).
* **Backend:** Vercel Serverless Functions (Node.js).
* **Database:** PostgreSQL (hosted on Neon) managed with Prisma ORM.
* **AI & External APIs:** Anthropic Messages API (Server-side) and Browser Speech Synthesis API for German pronunciation.

## Core Technical Features
* **Spaced Repetition Engine:** Implements the Anki default SM-2 algorithm. It handles fuzzy review intervals, tracking daily limits (20 new cards/day resets at midnight UTC), and managing learning steps (re-showing a card within 20 minutes if forgotten).
* **AI Generation pipeline:** The server requests exactly 20 flashcards from Anthropic. I built validation logic to drop empty or duplicated cards before saving them to the database.
* **Custom Authentication:** Built from scratch using `bcryptjs` (cost 12) and JWTs stored in `httpOnly`, `Secure`, and `SameSite=Lax` cookies. 
* **Placement Testing:** A 12-question diagnostic test graded by a custom backend algorithm to estimate the user's starting level.

## How I Built It (My Role)
As with my other projects, my main focus was on the system architecture, database design, and prompt engineering. I used AI coding tools to accelerate writing the actual code while I managed the logic and integration. 

The biggest technical challenges I solved were:
1. **The SRS Math:** Translating Anki's complex scheduling rules (like interval fuzzing and lapse resets) into a reliable backend API. 
2. **AI Reliability:** Ensuring the server-side Anthropic API calls didn't crash the app. If the AI fails during a placement test, I built a rule-based fallback algorithm to grade the test locally so the user experience isn't interrupted.
3. **Security:** Keeping the AI API keys strictly on the server, enforcing a strict Content-Security-Policy (CSP), and ensuring all user data queries in Prisma are strictly filtered by the logged-in user's ID.

## Run it locally

1. Clone the repository and install dependencies (this also runs `prisma generate`):
   ```bash
   npm install
