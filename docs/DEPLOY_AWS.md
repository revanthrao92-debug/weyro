# Weyro on AWS (Mumbai, `ap-south-1`)

The backend runs on AWS, defined as code in `infra/` (AWS CDK, TypeScript). This replaces Railway
and Supabase (`DEPLOY_RAILWAY.md` is kept until the switch is complete).

```
Phone apps ──HTTPS──▶ CloudFront ──(AWS private network, VPC origin)──▶ private load balancer
                                                                          │
                                         Fargate API tasks (Docker image from ECR) ──▶ RDS PostgreSQL 16 + PostGIS
                                                │                                     (private, encrypted, SSL only)
                                                ├──▶ S3 files bucket (private; no keys, task role)
                                                └──▶ Valkey (off until 2+ API tasks)
```

| Stack | What | Deploy |
|---|---|---|
| `WeyroShared` | Image repository (ECR), GitHub deploy role (OIDC), monthly budget alarm | Once |
| `WeyroStaging` | A full copy for testing and load tests | By hand from GitHub Actions |
| `WeyroProduction` | The live system | After CI passes on `main`, once a reviewer approves |

**Why these choices** (more in the plan this came from):
- **Fargate:** App Runner stopped taking new customers in April 2026.
- **CloudFront:** gives HTTPS without a domain, and keeps the load balancer private.
- **No NAT gateway:** saves about $35/month; tasks get a public IP for outbound calls but accept traffic only from the load balancer.

## 0. Account safety (owner, once, before anything is built)

1. **Root user:**
   - sign in, turn on MFA (Security credentials → Assign MFA);
   - don't use the root user again after this.
2. **IAM Identity Center** (pick **Mumbai** as its region):
   - enable it;
   - create a user for yourself with the `AdministratorAccess` permission set.
3. **Billing → Budgets:**
   - the `WeyroShared` stack creates a budget alarm, but add one by hand now as well;
   - for example, $50 with email.
4. **Billing preferences:** turn on "Receive Free Tier usage alerts".
5. **AWS Activate:** apply at https://aws.amazon.com/startups/credits.
6. **On this Mac:**
   ```bash
   brew install awscli
   aws configure sso          # Mumbai, your Identity Center start URL
   ! aws sso login            # in Claude Code, prefix with ! to log in yourself
   aws sts get-caller-identity
   ```

## 1. First deploy (in this order)

```bash
cd infra && npm ci
export CDK_DEFAULT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
npx cdk bootstrap aws://$CDK_DEFAULT_ACCOUNT/ap-south-1          # once per account and region
npx cdk deploy WeyroShared -c alertEmail=<you@example.com> -c budgetUsd=100
```

Confirm the SNS and budget emails AWS sends. Then:

1. **GitHub → Settings → Environments:**
   - create `aws-staging`;
   - create `aws-production` with **you as required reviewer**, and allow only `main`.
2. **GitHub → Settings → Variables (repository):**
   - `AWS_DEPLOY_ROLE_ARN`: the `GitHubDeployRoleArn` output of `WeyroShared`;
   - `ALERT_EMAIL`;
   - `MONTHLY_BUDGET_USD` (optional, default 100);
   - `AWS_DEPLOY_ENABLED=true`, set this last.
3. **GitHub → Actions → "Deploy to AWS" → Run workflow → `staging`.**
   - The first run builds the image, creates the staging stack and starts the API. The stack creation takes about 15–20 minutes, mostly the database and CloudFront.
4. **Fill in the provider keys.**
   - Where: Secrets Manager → `weyro-staging/providers`.
   - Staging uses Razorpay **test** keys and real MSG91 keys.
   - The API refuses to start in production mode without them; empty values are ignored at start-up.
   - **Then:** ECS → `weyro-staging` → service → **Update → Force new deployment**.
5. **Point a staging app build at it.** Use the `ApiUrl` stack output (`https://<id>.cloudfront.net/api/v1`) as `EXPO_PUBLIC_API_URL` in the `staging` profile of `apps/mobile/eas.json`.
6. **Production:** repeat steps 3–5 with `production`. Use **live** Razorpay keys only when payments are switched on for real.

## 2. Everyday deploys

- **Production:**
  1. merge to `main`;
  2. CI passes;
  3. approve the "aws-production" deployment;
  4. the workflow builds the image (tagged with the commit) and runs `cdk deploy` with it.
- **How a new version goes live:**
  - New tasks run `prisma migrate deploy`, then start.
  - **ECS keeps the old version serving until the new one passes `/api/v1/ready`.**
  - **If the new version fails, ECS rolls back by itself** (circuit breaker).
  - A failed migration stops the new version, and the old one keeps serving.
- **Staging:** Actions → "Deploy to AWS" → Run workflow, from any branch.

## 3. Operating it

| Task | How |
|---|---|
| Logs | CloudWatch → Log groups → `/weyro/<env>/api` (kept 14 days staging, 30 days production) |
| Alerts | Email for: 10+ server errors in 5 min, an unhealthy API task, database CPU above 80% for 15 min, database under 2 GB free, budget at 80% forecast or 100% actual |
| Roll back by hand | Run the deploy workflow on the previous good commit (images are kept, last 30) |
| Database restore | RDS → automated backups, point-in-time restore (7 days staging, 14 days production). Restores create a new instance; point the stack at it only with care |
| Scale up | `infra/lib/config.ts`: `desiredCount: 2`, `redis: true` (required with 2+ tasks), and `dbMultiAz: true` before real traffic |
| Change a secret | Secrets Manager, then Force new deployment of the ECS service |
| Stop staging to save money | Set its `desiredCount` to 0 and stop the RDS instance (RDS restarts itself after 7 days) |

## 4. Costs (Mumbai; estimates, check the AWS Pricing Calculator)

| Setup | ≈ USD / month |
|---|---|
| Production pilot (1 task 0.5 vCPU/1 GB, load balancer, CloudFront, RDS `db.t4g.small`, S3, logs, 4 secrets) | 60–80 |
| Staging while running (1 task, `db.t4g.micro`) | 15–35 |
| Growth (2–3 tasks, Multi-AZ database, Valkey) | 180–300 |

## 5. Before real users (must do)

1. **Domain:** buy one (Route 53, about $12–20 a year), add `api.<domain>` on CloudFront with a free certificate (ACM in `us-east-1`), and point the store builds at it.
   - Store builds must not depend on the `cloudfront.net` address, which changes if the distribution is replaced.
2. **Database:** `dbMultiAz: true` in production (survives a zone outage; doubles database cost).
3. **Load test** against staging (see the plan in the project notes).
4. **Privacy policy:** mention the anonymised activity history (docs/DATA.md).

## 6. Switching off the old providers (owner, after production on AWS is verified)

1. **Supabase:**
   - production has test data only;
   - still, take a final dump if you want a copy (`pg_dump`);
   - then pause or delete the project.
2. **Railway:** delete the API and Redis services.
3. **Cloudflare R2:** if a bucket was used, copy anything worth keeping to S3 first.
4. **Repository:** remove `railway.json` and move `DEPLOY_RAILWAY.md` to `docs/archive/`.

## Checks that protect this setup

- **`infra/test/stacks.test.ts`** (runs in CI). It checks that:
  - the database is private, encrypted and SSL-only;
  - the bucket is fully private and HTTPS-only;
  - the load balancer is internal and only CloudFront may reach it;
  - no security group is open to the world;
  - there is no NAT gateway;
  - API responses are never cached;
  - failing releases roll back;
  - no storage keys exist;
  - production keeps its database on delete;
  - only this repository's two GitHub environments can deploy;
  - images are immutable and scanned;
  - the budget alarm exists.
- **The start command was tested in the real API image** against an SSL-only PostGIS 16 database:
  - migrations ran and are safe to repeat;
  - the server became ready;
  - a failed migration prevents start-up.
