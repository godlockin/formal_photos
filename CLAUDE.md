# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Formal Photos - A professional headshot/image generation application that uses Google Gemini AI to analyze user photos and generate professional portrait images with various poses and styles.

**Architecture**: Full-stack application with:
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + Zustand
- **Backend**: Cloudflare Pages Functions (serverless edge functions)
- **AI Models**: Google Gemini for analysis/review and image generation
- **Face Detection**: face-api.js for client-side face detection

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start full development environment (Vite on port 3000 + Functions on port 8788) |
| `npm run dev:frontend` | Start only Vite frontend (port 3000) |
| `npm run build` | TypeScript compile + Vite build |
| `npm run preview` | Preview production build locally |
| `npm run test` | Run Jest tests |
| `npm run test:watch` | Run Jest in watch mode |
| `npm run test:coverage` | Run Jest with coverage report |

## Project Structure

```
src/                    # Frontend React application
├── App.tsx             # Main application component (multi-step workflow)
├── store.ts            # Zustand state management
├── types.ts            # TypeScript type definitions
├── api.ts              # API client (standard)
├── api.secure.ts       # API client with HMAC signature (optional)
└── face-api.ts         # Face detection setup

functions/              # Cloudflare Pages Functions
└── api/
    ├── gemini.ts       # Main API handler (standard)
    ├── gemini.secure.ts # Secure API handler with HMAC
    └── [[path]].ts     # Catch-all route handler

public/models/          # face-api.js models (static assets)
```

## Architecture Details

### Frontend Workflow
Multi-step wizard managed by Zustand store (`src/store.ts`):
```
invite → consent → upload → pose_select → processing → result
```

### API Flow (per pose)
1. `analyze` - Upload image, get `Person` analysis
2. `design` - Generate design recommendations
3. `reviewPrompt` - Validate/optimize prompt (iterates up to 3 times if rejected)
4. `generate` - Generate professional photo (iterates up to 3 times if rejected)
5. `reviewResult` - Evaluate generated photo quality

### Key Data Types (src/types.ts)
- `Person` - Gender, age, skin tone, face shape, unique features to preserve
- `Prompt` - Text prompt + technical/ style parameters
- `ReviewResult` - Quality scores, recommendations, iteration tracking
- `Photo` - Generated result with review data

### API Endpoints
All actions go to `/api/gemini` (or `VITE_API_URL` override):
```json
{
  "code": "INVITE_CODE",
  "action": "analyze|design|generate|review|reviewPrompt|reviewResult|processAll",
  "image": "data:image/jpeg;base64,...",
  "data": { "...": "..." }
}
```

## Environment Variables

### Frontend
- `VITE_API_URL` - Custom API URL (default: `/api/gemini`)

### Backend (Cloudflare Functions)
Required:
- `GEMINI_API_KEY` - Google Gemini API key

Optional:
- `INVITE_CODES` - Comma-separated invite codes (default: `PHOTO2026,VIP001,EARLY2026`)
- `API_SECRET` - HMAC signature secret (for secure mode)
- `ANALYSIS_MODEL` / `GENERATE_MODEL` - Model selection
- `REVIEW_PASS_THRESHOLD` / `PHOTO_APPROVAL_THRESHOLD` - Quality thresholds

### Local Development
- Copy `.dev.vars.example` to `.dev.vars` for local secrets
- `.dev.vars` is gitignored and never committed

## Build Configuration

### Vite (vite.config.ts)
- Port: 3000
- Proxy: `/api` → `http://localhost:8788` (Cloudflare Functions)
- Output: `dist/`

### Wrangler (wrangler.toml)
- Compatibility date: 2024-04-01
- Pages build output: `./dist`
- Functions route: `/api/gemini`

### Jest (package.json)
- Preset: `ts-jest/presets/default-esm`
- Environment: `jsdom`
- Test match: `**/__tests__/**/*.test.{ts,tsx}`

## Security Notes

- All API keys and secrets are server-side only (Cloudflare Functions)
- Prompts and model versions are generated server-side, never exposed to frontend
- Invite code validation required for all API calls
- Optional HMAC signing available (`api.secure.ts` + `gemini.secure.ts`)
- Security headers configured in `functions/_headers`
