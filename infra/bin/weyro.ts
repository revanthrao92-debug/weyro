#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { ENVIRONMENTS, REGION } from '../lib/config';
import { WeyroEnvStack } from '../lib/env-stack';
import { WeyroSharedStack } from '../lib/shared-stack';

/**
 * Stacks:
 *   WeyroShared      image repository, GitHub deploy role, monthly budget (deploy once)
 *   WeyroStaging     a full copy for testing and load tests
 *   WeyroProduction  the live system
 *
 * Context (cdk ... -c key=value):
 *   alertEmail   where budget and alarm emails go (required to deploy)
 *   budgetUsd    monthly budget, default 100
 *   imageTag     the API image to run, set by the deploy workflow (git commit)
 */
const app = new App();
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: REGION };
const alertEmail = app.node.tryGetContext('alertEmail') ?? 'alerts@example.com';
const imageTag = app.node.tryGetContext('imageTag') ?? 'not-deployed-yet';

new WeyroSharedStack(app, 'WeyroShared', {
  env,
  alertEmail,
  monthlyBudgetUsd: Number(app.node.tryGetContext('budgetUsd') ?? 100),
});
new WeyroEnvStack(app, 'WeyroStaging', { env, config: ENVIRONMENTS.staging, imageTag, alertEmail });
new WeyroEnvStack(app, 'WeyroProduction', { env, config: ENVIRONMENTS.production, imageTag, alertEmail });
