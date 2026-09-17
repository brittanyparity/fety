# BudgetingOS

Personal finance budgeting app exported from [Figma Make](https://www.figma.com/), built with React 19, Vite 8, and Tailwind CSS v4.

## Local development

Requires Node.js 22 and [pnpm](https://pnpm.io/) 10.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) (or the port Vite prints if 5173 is in use).

## Deploy on Vercel

1. Push this repository to GitHub (or connect your existing `fety` repo).
2. In [Vercel](https://vercel.com/new), import the repository.
3. Vercel should auto-detect **Vite**; confirm:
   - **Install command:** `pnpm install`
   - **Build command:** `pnpm build`
   - **Output directory:** `dist`
4. Deploy. No environment variables are required for a standard static deploy.

Site title, description, and meta tags come from `.figma/make/site.json` via `vite.config.ts`.

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `pnpm dev`     | Development server       |
| `pnpm build`   | Production build to `dist` |
| `pnpm preview` | Preview production build |
