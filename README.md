# SaaS Backend Template

[![Node](https://img.shields.io/badge/Node-24+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![pnpm](https://img.shields.io/badge/pnpm-Enabled-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 Table of Contents
- [SaaS Backend Template](#saas-backend-template)
  - [📋 Table of Contents](#-table-of-contents)
  - [🎯 Overview](#-overview)
  - [✨ Features](#-features)
  - [🛠 Tech Stack](#-tech-stack)
  - [🚀 Quick Start](#-quick-start)
    - [Prerequisites](#prerequisites)
    - [Local Development](#local-development)
  - [🔔 Stripe Webhook Setup (Local)](#-stripe-webhook-setup-local)
  - [🐳 Docker](#-docker)
    - [Development (DB only)](#development-db-only)
    - [Production](#production)
  - [🧪 Testing](#-testing)
    - [Unit Tests](#unit-tests)
    - [E2E Tests](#e2e-tests)
  - [🏗 Project Structure](#-project-structure)
  - [🔧 Environment Variables](#-environment-variables)
  - [🔄 Development Workflow](#-development-workflow)
  - [📄 License](#-license)

---

## 🎯 Overview

A production-ready SaaS backend template architected with **NestJS 11** and **Fastify**. This project serves as a comprehensive foundation for subscription-based products, implementing industry-standard patterns for payments, security, and scalability. Implements webhook idempotency, transaction-based resource limits, and secure session management. Fully typed with Prisma, linted with Biome, and documented with Swagger.

---

## ✨ Features

- 🔐 **Advanced Auth**: JWT-based Access/Refresh token rotation with database-backed session revocation.
- 💳 **Stripe Lifecycle**: Full integration with Stripe Billing (Plans, Subscriptions, Checkout, and Customer Portal).
- 🛡️ **Webhook Idempotency**: Robust `WebhookEvent` tracking ensures Stripe events are processed exactly once.
- 📊 **Tiered Resource Limits**: Atomic enforcement of plan limits using database transactions to prevent race conditions.
- 🛠️ **Admin Suite**: Dedicated administrative endpoints for user management and system oversight.
- 🚀 **High Performance**: Fastify adapter for faster request handling compared to Express.
- 🧪 **Test Driven**: Comprehensive E2E and Unit test suites using Jest and Prisma mocks.
- 🐳 **Dockerized**: Multi-stage Docker build for production.

---

## 🛠 Tech Stack

| Category | Technology | Version |
| :--- | :--- | :--- |
| **Framework** | [NestJS](https://nestjs.com/) | 11.0.1 |
| **HTTP Server** | [Fastify](https://www.fastify.io/) | 5.7.4 |
| **ORM** | [Prisma](https://www.prisma.io/) | 7.4.1 |
| **Database** | [PostgreSQL](https://www.postgresql.org/) | 18.3 (Alpine) |
| **Payments** | [Stripe](https://stripe.com/) | 20.4.0 |
| **Security** | Argon2, JWT, Helmet | - |
| **Validation** | Class-validator, Joi | - |
| **Tooling** | [Biome](https://biomejs.dev/), Husky | 2.4.4 |

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v24+
- [pnpm](https://pnpm.io/) v9+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Stripe CLI](https://stripe.com/docs/stripe-cli) (for local webhook testing)

### Local Development

1. **Clone & Install**:
```bash
git clone https://github.com/skleyzi/saas-backend.git
cd saas-backend
pnpm install
```

2. **Environment**:
```bash
cp .env.example .env
# Fill in all required values
```

3. **Start Database**:
```bash
docker compose up -d db
```

4. **Run Migrations**:
```bash
pnpm prisma migrate dev
```

5. **Start App**:
```bash
pnpm dev
```

- **API Docs**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **Health Check**: [http://localhost:3000/health/live](http://localhost:3000/health/live)

---

## 🔔 Stripe Webhook Setup (Local)

To test Stripe events locally, forward webhook events to your running app using the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/webhook/stripe
```

Copy the webhook signing secret printed by the CLI (`whsec_...`) and set it as `STRIPE_WEBHOOK_SECRET` in your `.env`.

To manually replay a missed event:
```bash
stripe events resend evt_xxxxx
```

---

## 🐳 Docker

### Development (DB only)

Run only the database in Docker and the app locally:
```bash
docker compose up -d db
pnpm prisma migrate dev
pnpm dev
```

### Production

Run the full stack (app + database) in Docker:
```bash
docker compose up --build
```

The app container automatically runs `prisma migrate deploy` on startup before accepting traffic.

To run in the background:
```bash
docker compose up --build -d
docker compose logs -f app   # follow logs
```

To stop:
```bash
docker compose down      # stop containers
docker compose down -v   # stop and delete DB data
```

---

## 🧪 Testing

### Unit Tests

```bash
pnpm test           # run all unit tests
pnpm test:cov       # with coverage report
```

### E2E Tests

E2E tests run against a real PostgreSQL test database.

1. **Setup test environment**:
```bash
cp .env.test.example .env.test.local
# Set DATABASE_URL to a separate test database
```

2. **Create test database** (first time only):
```bash
docker compose up -d db
# Make sure your test DATABASE_URL points to a different DB than dev
```

3. **Run E2E tests**:
```bash
pnpm test:e2e
```

> **Note**: E2E tests automatically run `prisma migrate deploy` against the test database before the suite starts and clean up data between each test. Never point `DATABASE_URL` in `.env.test.local` at your development database.

---

## 🏗 Project Structure

```text
src/
├── common/
│   ├── configs/          # Fastify and Pino logger configuration
│   ├── decorators/       # @CurrentUser, @Public
│   ├── dto/              # Shared DTOs (pagination)
│   ├── filters/          # Global exception filter with Prisma error mapping
│   ├── guards/           # AuthGuard, AdminGuard, ThrottlerGuard
│   ├── test/             # Shared unit test mock factories
│   ├── types/            # TypeScript types (RequestUser, JWT payloads)
│   └── utils/            # JWT and crypto helpers
├── modules/
│   ├── admin/            # Admin endpoints (user management)
│   ├── auth/             # JWT auth, session management, refresh token rotation
│   ├── billing/          # Stripe Checkout, Portal, subscription management
│   ├── health/           # /health/live and /health/ready endpoints
│   ├── prisma/           # PrismaService with lifecycle hooks
│   ├── resources/        # Core feature with plan limit enforcement
│   ├── stripe/           # Stripe SDK wrapper
│   ├── users/            # User profile management
│   └── webhook/          # Idempotent Stripe webhook processing
├── app.module.ts
└── main.ts
test/
├── helpers/              # E2E app bootstrap, DB seed/cleanup, auth helpers
├── auth.e2e-spec.ts
├── billing.e2e-spec.ts
├── resources.e2e-spec.ts
└── webhook.e2e-spec.ts
prisma/
├── migrations/           # Prisma migration history
└── schema.prisma         # Database schema
prisma.config.ts          # Prisma client configuration
```

---

## 🔧 Environment Variables

Copy `.env.example` to `.env` and fill in the values. All variables are required.

| Key | Description | Example |
| :--- | :--- | :--- |
| `POSTGRES_USER` | PostgreSQL username | `postgres` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `postgres` |
| `POSTGRES_DB` | PostgreSQL database name | `saas_dev` |
| `DATABASE_URL` | Full PostgreSQL connection string | `postgresql://postgres:postgres@db:5432/saas_dev` |
| `JWT_ACCESS_SECRET` | Secret for signing access tokens | `your-access-secret` |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | `your-refresh-secret` |
| `JWT_ACCESS_EXPIRES_IN_SECONDS` | Access token lifetime in seconds | `900` (15 minutes) |
| `JWT_REFRESH_EXPIRES_IN_SECONDS` | Refresh token lifetime in seconds | `604800` (7 days) |
| `STRIPE_SECRET_KEY` | Stripe secret API key | `sk_test_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | `whsec_...` |
| `SUCCESS_URL` | Redirect URL after successful checkout | `http://localhost:3000/success` |
| `CANCEL_URL` | Redirect URL after cancelled checkout | `http://localhost:3000/cancel` |
| `BILLING_SETTINGS_URL` | Return URL from Stripe customer portal | `http://localhost:3000/billing` |
| `FRONTEND_URL` | Frontend origin for CORS | `http://localhost:3000` |

> **Note**: `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` are only needed when running via Docker Compose. If using an external database, only `DATABASE_URL` is required.

---

## 🔄 Development Workflow

- **Commit Hooks**: Pre-commit linting (Biome) and commit-msg validation (Commitlint) via Husky.
- **Database Changes**: Modify `prisma/schema.prisma` → `pnpm prisma migrate dev`.
- **Formatting**: `pnpm biome check --write .`.

---

## 📄 License

This project is licensed under the MIT License.