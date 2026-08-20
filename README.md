# School Management System

A full-featured school management SaaS built with Next.js, Prisma, and PostgreSQL — covering academics, admissions, attendance, fees, HR/payroll, transport, hostel, library, exams, and more, with role-based dashboards for admins, teachers, and parents.

## Tech Stack

- **Framework:** Next.js 15 (App Router, Turbopack)
- **Language:** TypeScript, React 19
- **Database:** PostgreSQL via Prisma ORM
- **UI:** Tailwind CSS, Radix UI, shadcn-style components
- **Auth:** JWT (jose), bcrypt
- **AI:** Genkit + Google Gemini
- **Email:** Nodemailer (SMTP)
- **Messaging:** WhatsApp Cloud API
- **Hosting:** Firebase App Hosting

## Getting Started

### Prerequisites

- Node.js 22+
- A PostgreSQL database

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables and fill in values
cp .env.example .env

# Apply the database schema
npx prisma migrate deploy   # or: npx prisma db push
npx prisma generate

# (optional) seed initial users
npm run seed:users

# Run the dev server
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Build for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run seed:users` | Seed initial users into the database |

## Environment Variables

See [`.env.example`](.env.example) for the full list, including database, JWT, SMTP, and WhatsApp Cloud API configuration.

## Project Structure

```
src/
  app/
    (public)/       # Login, admissions apply, contact, etc.
    (dashboard)/    # Feature modules: academics, fees, hr, transport, etc.
    actions/        # Server actions (data mutations/queries)
    api/            # API routes (webhooks, cron)
  components/       # Shared UI components
  lib/               # Utilities (auth, email, whatsapp, etc.)
  ai/                # Genkit AI flows
prisma/
  schema.prisma      # Database schema
```

## CI/CD

GitHub Actions workflows live in [`.github/workflows`](.github/workflows):

- **`ci.yml`** — runs on every push/PR to `main` and `dev`: installs dependencies, generates the Prisma client, lints, type-checks, and builds the app.
- **`deploy.yml`** — runs on push to `main`: builds the app and deploys to Firebase App Hosting.

### Required repository secrets

| Secret | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | CI, Deploy | PostgreSQL connection string |
| `JWT_SECRET` | CI, Deploy | JWT signing secret |
| `GEMINI_API_KEY` | CI, Deploy | Google Gemini API key |
| `FIREBASE_SERVICE_ACCOUNT` | Deploy | Firebase service account JSON for deployment |
| `FIREBASE_PROJECT_ID` | Deploy | Firebase project ID |

Configure these under **Repo Settings → Secrets and variables → Actions**.

## License

Private/proprietary — all rights reserved.
