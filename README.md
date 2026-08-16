# PauseResume — Pause. Refine. Resume.

> "Your career already exists — tell us the job you want, and we turn your LinkedIn profile into a resume built for it."

Upload a LinkedIn PDF export, say what job you're targeting, and get a tailored, editable resume you can download as PDF or DOCX — no manual form-filling.

## Problem statement

AI Resume Generator: generates a professional resume from user-provided information (work history, skills, education, achievements), formatted into a clean, ready-to-use document. Built for the GenForge Generative AI Mini Challenge, shipped under the name PauseResume.

## Live demo / video

- App: `<add your deployed Vercel URL here>`
- Demo video: `<add your video link here>`
- Repo: `<add your GitHub link here>`

## Quick start (local)

Requirements: Node.js 18+, a Supabase project, an Anthropic API key.

```bash
npm install
cp .env.example .env.local   # fill in the three values below
npm run dev
```

`.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxx
```

Then in the Supabase SQL editor, run `supabase/schema.sql` once to create the `career_profiles` and `resumes` tables. Open http://localhost:3000.

**Fastest way to see it work end-to-end:** on the upload screen, click **"Try demo profile instead"** — it skips the file upload and runs a fictional sample profile through the real tailoring/export pipeline.

### Deploying

Push to GitHub, import into Vercel, add the three environment variables above in Project Settings, deploy. No other config needed — there's no auth to set up for this MVP.

## User flow

1. **Landing** — value prop + "Build my resume."
2. **Template** — pick Classic / Modern / Minimal (changeable again later, right up to export).
3. **Target role** — free text box: job title, short description, or a full pasted job description.
4. **Profile import** — upload a LinkedIn "Save to PDF" export, paste profile text, or (last resort) fill in a compact manual-entry form. A demo profile is also one click away.
5. **Extraction + tailoring** (`AIService.extractProfile` → `AIService.tailorResume`) — a loading screen runs while both real API calls happen; it never signals "done" before the actual work finishes.
6. **Review & edit** — a single unified, fully editable "sheet," with a small badge per field showing where it came from (from your profile / AI-tailored / add your own). Edits autosave to the `resumes` row.
7. **Preview & export** — renders the *actual* generated PDF in an iframe (not an approximation) before you download, so what you see is exactly what you get. Switch templates here too — the preview regenerates automatically. PDF and DOCX both come from the same `TailoredResume` object.

## Architecture

The UI design (colors, fonts, the "paper & ink" resume-sheet look, the landing page, source badges, inline-editable fields) is adapted from a v0.app prototype into this project's existing Next.js 14 / React 18 / Tailwind v3 stack — the visual layer and component structure were ported over, not a framework migration.

```
app/
  page.tsx                 wizard orchestrator: landing -> template -> role -> import -> extracting -> review -> export
  api/
    extract-profile/       PDF upload | pasted text | demo -> AIService.extractProfile -> career_profiles
    manual-profile/        manual-entry path, bypasses AI extraction entirely
    tailor-resume/         AIService.tailorResume -> resumes
    resumes/[id]/          PATCH: persist review-screen edits; GET: reload a resume
    export-pdf/            resume JSON -> PDF via @react-pdf/renderer (also used for the live preview)
    export-docx/           resume JSON -> DOCX via the docx package
components/
  TemplateStep, TargetRoleStep, UploadStep, ReviewForm, ExportStep   the 5 real wizard steps
  genforge/                 landing, logo (PauseResume branding), progress-stepper, source-badge, inline-field, extraction-loading
  ui/button.tsx              button variants (plain <button> + cva, no extra runtime dep)
lib/
  ai-service.ts             the ONE module that talks to the model (extractProfile, tailorResume)
  schemas.ts                zod schemas — every AI response is validated against these before use
  pdf-extract.ts            LinkedIn PDF -> plain text (with file-size/type validation)
  pdf-template.tsx           three PDF layouts (classic/modern/minimal), dispatched by templateId
  docx-export.ts             matching DOCX builder (same data as the PDF)
  supabase.ts                Supabase client (browser + server)
types/resume.ts              RawProfile / TailoredResume — the shared contract across AI, DB, and UI
data/demo-profile.ts         fictional profile for the zero-setup demo path
supabase/schema.sql          career_profiles + resumes tables
```

`app/globals.css` / `tailwind.config.ts` carry the oklch color tokens and font variables; `app/layout.tsx` loads Inter/Fraunces/JetBrains Mono via `next/font/google`.

**Preview before download.** The export step doesn't approximate the resume in HTML — it calls `/api/export-pdf` and renders the actual returned PDF in an `<iframe>`, so what's on screen is byte-for-byte what downloads. Switching templates there re-fetches automatically.

**Data model.** Deliberately un-normalized for the MVP: `career_profiles.profile_json` and `resumes.resume_json` are `jsonb` columns holding the exact `RawProfile` / `TailoredResume` shapes from `types/resume.ts`. This keeps the AI layer, the DB, and the review form all speaking the same schema with zero mapping code.

**No auth.** Demo mode only — an anonymous UUID is generated per browser (`localStorage`) and stored as `session_id`, purely so profiles/resumes are attributable in the DB. Row Level Security is enabled but left permissive; the schema file calls this out explicitly as something to tighten before any real deployment.

## AI integration

One `AIService` module (`lib/ai-service.ts`) is the only code that calls the model — nothing scattered through the UI, per the brief. Two methods:

- `extractProfile(text): Promise<RawProfile>`
- `tailorResume(profile, targetRole): Promise<TailoredResume>`

Both call Claude with a system prompt demanding **strict JSON only** (no prose, no markdown fences), then validate the parsed response against a `zod` schema (`lib/schemas.ts`) before it's allowed to touch the database or UI. If validation fails, the request fails loudly with a clear error rather than silently passing malformed data downstream — the brief explicitly requires this ("never parse free-form AI text for app logic").

**Guardrails against fabrication**, enforced in the system prompts themselves:

- Extraction is instructed to omit missing fields rather than guess them.
- Tailoring is explicitly told it may reorder, select, and rewrite wording — but may never introduce a company, title, date, skill, or metric that isn't already in the source `RawProfile`.
- Tailoring also returns `missingForRole`: a short list of things the target role likely wants that the source profile doesn't support. This is shown to the user on the review screen instead of the AI papering over the gap.
- The review screen carries a visible disclaimer that AI-generated content should be checked before use.

## Key design decisions

- **Single-page wizard instead of separate routes.** State (target role, profile id, resume id, the resume object itself) lives in one React component and is passed straight into each step and into the export calls. This avoids cross-page state-passing complexity and keeps the "upload → tailored resume" path fast for a judge to click through.
- **Extraction and tailoring are separate AI calls and separate DB writes.** This was a hard requirement in the brief (`career_profiles` stores the raw profile; `resumes` stores tailored output) so a profile can be re-tailored for a second role later without re-uploading.
- **PDF and DOCX render from one shared object**, never two independently-maintained templates, so they can't visually diverge.
- **Manual entry bypasses the AI extraction step entirely** — it writes a `RawProfile` directly — since there's no unstructured text to extract from in that path.

## Out of scope for this build (per the brief)

Multiple resume personas, version history/comparison, ATS keyword simulator, career gap detector, career story generator, advanced animations, real user accounts/auth.

## Known limitations / next steps

- PDF extraction (`pdf-parse`) is text-based; a purely scanned/image LinkedIn export won't extract — the paste/manual fallback covers that case.
- No retry/backoff on AI calls yet; a transient API error surfaces as an inline error message the user can retry from.
- RLS policies are open (demo mode) — swap for `auth.uid()`-scoped policies if this moves past a hackathon demo.
