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

### Verify the live site matches Git

After each deploy, open **Deployments** in Vercel and confirm the latest deployment succeeded and matches your Git commit; trigger **Redeploy** if the URL still serves an old build.

For **Figma Make** preview (not Vercel), sync Git in the Make file and run a fresh preview deploy (`.figma/make/deploy-preview`); the live dev iframe does not update automatically from GitHub pushes alone.

Site title, description, and meta tags come from `.figma/make/site.json` via `vite.config.ts`.

## Scripts

| Command        | Description              |
| -------------- | ------------------------ |
| `pnpm dev`     | Development server       |
| `pnpm build`   | Production build to `dist` |
| `pnpm preview` | Preview production build |
