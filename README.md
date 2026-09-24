# NestJS starter

Monorepo starter with NestJS, Prisma, PostgreSQL, Redis, React, Vite, and Tailwind CSS. The API includes JWT authentication, role-based access, and user management. The client is intentionally a single Hello world page.

## Requirements

- Node.js 24 and pnpm 11
- Docker with Compose

## Start locally

1. Copy `.env.sample` to `.env`. Set `JWT_SECRET` and the `SEED_USER_*` values before sharing the environment with anyone.
2. Run `pnpm install`.
3. Run `pnpm setup`. It starts PostgreSQL and Redis, applies the initial migration, generates Prisma Client, and creates one SUPERADMIN user. Repeating it does not create another user.
4. Run `pnpm dev`. The API is at `http://localhost:3000`, its docs at `http://localhost:3000/docs`, and the client at `http://localhost:3001`.

The API serves the built client from `apps/client/dist` when it exists. Run `pnpm build` then `pnpm start:prod` to use one server for both. Set `DATABASE_URL`, `REDIS_URL`, and JWT values in the runtime environment for non-local deployments.

## Commands

| Command                                              | Purpose                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm setup`                                         | Start local services, migrate, generate, and seed                  |
| `pnpm dev`                                           | Run API and client with watch mode                                 |
| `pnpm dev:api` / `pnpm dev:client`                   | Run one app                                                        |
| `pnpm build` / `pnpm start:prod`                     | Build and run the API with the built client                        |
| `pnpm lint` / `pnpm typecheck` / `pnpm test`         | Verify the workspace                                               |
| `pnpm db:up` / `pnpm db:down`                        | Start or stop local PostgreSQL and Redis; `db:down` keeps data     |
| `pnpm db:migrate` / `pnpm db:deploy`                 | Apply migrations in development or deployment                      |
| `pnpm db:generate` / `pnpm db:seed` / `pnpm db:view` | Generate Prisma Client, seed the first user, or open Prisma Studio |

The initial migration contains only the `User` table and `Role` enum. It is for a **new, empty database**. Do not apply it to a database from an earlier application; no data migration is provided.

## API

All API endpoints are under `/api`. Use `POST /api/auth/login` with the seeded email and password to obtain access and refresh tokens. Send the access token as `Authorization: Bearer <token>`. `POST /api/auth/refresh` renews the token pair and `GET /api/auth/me` returns the current user.

`/api/user` contains the user management endpoints. Creating, listing, reading, changing roles, and deleting users require `SUPERADMIN`. Any authenticated user can update their own profile and password. The browser page intentionally has no authentication UI; use the API docs or an API client.
