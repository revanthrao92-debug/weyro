# Contributing to Weyro

Thank you for contributing to the Weyro automotive marketplace platform. Follow these guidelines to maintain production quality, security, and architectural integrity.

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js**: v22.x LTS
- **Docker & Docker Compose**: For local PostgreSQL 16 + PostGIS runtime
- **Expo CLI**: Included in dependencies; invoke via `npx expo <command>`

### Initial Setup
```bash
# 1. Install dependencies across all monorepo packages
npm install

# 2. Boot PostgreSQL + PostGIS container
docker-compose up -d

# 3. Build shared packages & deploy database schema
npm run build:packages
npx prisma migrate deploy --schema packages/database/prisma/schema.prisma

# 4. Boot development servers
npm run build && (cd apps/api && npm run start:dev &) && npx expo start
```

---

## 🌿 Branching & Commit Conventions

Weyro strictly enforces [Conventional Commits](https://www.conventionalcommits.org/):

Format: `<type>(<scope>): <short description>`

### Types
- `feat`: A new feature (e.g., `feat(payments): add razorpay upi support`)
- `fix`: A bug fix (e.g., `fix(chat): handle participant authorization properly`)
- `refactor`: Code reorganization with no behavior changes (e.g., `refactor(mobile): decompose quotes screen`)
- `ci`: CI workflows and pipeline modifications (e.g., `ci(github): add expo-doctor check`)
- `docs`: Documentation updates (e.g., `docs(adr): document postgis spatial indexes`)

---

## 🧪 Pre-Commit Quality Checks

Before submitting a Pull Request, all of the following commands must execute cleanly with zero errors:

```bash
# 1. Monorepo TypeScript verification
npm run typecheck:all

# 2. ESLint code quality & hooks conformance
npm run lint

# 3. Backend unit and integration test suite
npm run test -w @weyro/api

# 4. Expo SDK & dependency compatibility check
npx expo-doctor

# 5. Prisma schema validity
npx prisma validate --schema packages/database/prisma/schema.prisma
```

---

## 🔒 Architectural Rules

1. **No Mock Secrets in Production**: Hardcoded fallback passwords, test tokens, or dummy users are forbidden in production codepaths.
2. **Deterministic State Transitions**: Never mutate booking, quotation, or payment statuses without passing through the state machines in `apps/api/src/common/state-machines/`.
3. **Screen Size Constraint**: Mobile screens in `src/app/` must remain modular and focused (≤ 250 lines). Extract reusable components into `src/components/<feature>/`.
4. **Localization**: All currencies must use INR (`₹`), phone numbers must conform to Indian formats (+91), and payment flows must prioritize UPI and Indian cards.
