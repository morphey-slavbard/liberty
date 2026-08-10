# Search Preview v2

Demo storefront for Dynamic Yield search, Visual Search, and Shopping Muse.

## Requirements

- Node.js

## Local Setup

1. Install dependencies:
   `npm install`
2. Create `.env.local` with:
   - `VISUALSEARCH_API_KEY=...`
   - `SHOPPINGMUSE_API_KEY=...`
3. Start dev server:
   `npm run dev`

## Build

- Production build:
  `npm run build`

## Notes

- Search settings are configurable from the in-app config panel.
- The same environment variables must be available in deployment.
