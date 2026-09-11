# Craftora AI — SIH 2026 Prototype

**From Artisan Craft to Global Market**

A full-stack React + TypeScript + Express prototype implementing the SIH demo flow:

Artisan signup/login → AI cataloging (photo + multilingual voice/text) → editable listing → pricing assistant → publish → persistent marketplace → buyer enquiry/demo order → artisan status update.

## Run locally

Requirements: Node.js 20+.

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

### Demo accounts
- Artisan: `artisan@craftora.demo` / `craftora`
- Buyer: `buyer@craftora.demo` / `craftora`

The server persists data in `server/data.json` so refresh/login/logout does not erase products, enquiries or orders.

## Gemini

The integration is server-side. Put the key in `.env`:

```env
GEMINI_API_KEY=your_key_here
```

Never put the key in React/client code. If the key is absent, the catalog endpoint deliberately falls back to a labelled demo generator so the SIH flow remains demonstrable.

## Voice

The cataloger uses the browser Web Speech API when available and maps the selected language to regional Indian locale codes for Hindi, English, Marathi, Gujarati, Bengali, Tamil, Telugu, Kannada, Malayalam, Punjabi, Odia and Assamese. If unsupported, the text box remains fully usable.

## Image Studio

The prototype includes real browser-side image preview and upload validation. It intentionally does not pretend to perform an external AI background-removal operation without a configured image-processing service. The UI can be extended with a provider once credentials are supplied.

## Architecture

- `client/` — React/Vite UI
- `server/index.ts` — Express API, auth, persistence, Gemini server-side action
- `server/data.json` — prototype persistent database
- `server/uploads/` — uploaded product images
- `public/assets/` — Craftora visual references/demo product imagery

For production SIH deployment, the JSON persistence layer can be replaced with Convex/Postgres without changing the UI workflow.
