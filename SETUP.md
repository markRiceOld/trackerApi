# Tracker API – Setup & Run

## What needs to be running

### Current setup: **SQLite** (default)

- **No extra services.** SQLite uses a file (`prisma/dev.db`), so you don’t need a database server.
- You only need **Node.js** (and npm) installed.

### Optional: **PostgreSQL** (for local testing like before)

If you want to use Postgres instead:

1. **Install and start PostgreSQL** (e.g. via [postgresql.org](https://www.postgresql.org/download/) or Docker).
2. **Create a database and user**, e.g.:
   - Database: `tracker`
   - User: `tracker_user` (or whatever you use in your connection string)
3. **Switch the schema to PostgreSQL:**
   - In `prisma/schema.prisma`, comment out the SQLite `datasource` and uncomment the PostgreSQL one:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
   - Comment out or remove the `provider = "sqlite"` block.
4. **Set `.env`:**
   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/tracker"
   ```
5. **Re-run migrations** (see below). With a new provider you may need to reset:  
   `npx prisma migrate reset` (warning: deletes data) or create a new migration.

---

## Commands to run before (and when) running the project

From the **project root** (`tracker-api/`):

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Ensure you have a `.env` file in the project root (same folder as `package.json`).

- **SQLite (default):**
  ```env
  DATABASE_URL="file:./dev.db"
  PORT=4000
  ```
  Optional: `JWT_SECRET=your-secret` (defaults to `dev-secret` if omitted).

- **PostgreSQL:**  
  Use your Postgres URL and the same `PORT` / `JWT_SECRET` if you want.

### 3. Database migrations

Generate the Prisma client and apply migrations (creates/updates the database):

```bash
npx prisma generate
npx prisma migrate dev
```

- `prisma generate` – updates the Prisma client to match the schema.
- `prisma migrate dev` – applies pending migrations (and creates the DB file for SQLite if needed).

If you get errors about migrations already applied or schema drift, you can try:

```bash
npx prisma migrate deploy
```

(for a clean “just apply” without prompting for a new migration).

### 4. Run the API

```bash
npm run dev
```

Runs with nodemon; the API will be at **http://localhost:4000/graphql** (or whatever `PORT` you set).

---

## Quick reference (copy-paste)

**First time or after pull:**

```bash
cd tracker-api
npm install
# Ensure .env exists with DATABASE_URL (and optionally PORT, JWT_SECRET)
npx prisma generate
npx prisma migrate dev
npm run dev
```

**Later (no schema/dependency changes):**

```bash
npm run dev
```

**After changing `prisma/schema.prisma`:**

```bash
npx prisma generate
npx prisma migrate dev --name describe_your_change
npm run dev
```

---

## Summary

| You’re using | What must be running | Before first run |
|--------------|----------------------|-------------------|
| **SQLite** (default) | Nothing (just Node) | `npm install` → `npx prisma generate` → `npx prisma migrate dev` → `npm run dev` |
| **PostgreSQL** | PostgreSQL server | Same, plus create DB/user and set `DATABASE_URL` in `.env` |
