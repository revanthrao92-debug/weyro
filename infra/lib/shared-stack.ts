import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { ECR_REPOSITORY, GITHUB_REPO } from './config';

export interface SharedStackProps extends StackProps {
  /** Who gets budget and alarm emails. */
  alertEmail: string;
  /** Monthly budget in USD: an email at 80% (forecast) and at 100% (actual). */
  monthlyBudgetUsd: number;
}

/**
 * Account-wide pieces used by both environments: the API image repository, the keyless
 * GitHub Actions deploy role (OIDC, no AWS keys stored in GitHub) and the monthly budget alarm.
 */
export class WeyroSharedStack extends Stack {
  readonly repository: ecr.Repository;

  constructor(scope: Construct, id: string, props: SharedStackProps) {
    super(scope, id, props);

    this.repository = new ecr.Repository(this, 'ApiRepository', {
      repositoryName: ECR_REPOSITORY,
      imageScanOnPush: true,
      imageTagMutability: ecr.TagMutability.IMMUTABLE, // a tag always means the same image
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [{ description: 'Keep the last 30 images', maxImageCount: 30 }],
    });

    // GitHub's OIDC identity provider: one per AWS account.
    const github = new iam.OpenIdConnectProvider(this, 'GitHubOidc', {
      url: 'https://token.actions.githubusercontent.com',
      clientIds: ['sts.amazonaws.com'],
    });

    // Only workflows running in this repository's GitHub "aws-staging" / "aws-production"
    // environments can assume the role. Production's environment requires a reviewer.
    const deployRole = new iam.Role(this, 'GitHubDeployRole', {
      roleName: 'weyro-github-deploy',
      maxSessionDuration: Duration.hours(1),
      assumedBy: new iam.WebIdentityPrincipal(github.openIdConnectProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        StringLike: {
          'token.actions.githubusercontent.com:sub': [
            `repo:${GITHUB_REPO}:environment:aws-staging`,
            `repo:${GITHUB_REPO}:environment:aws-production`,
          ],
        },
      }),
    });
    // Push images, and deploy through the CDK bootstrap roles (which hold the real permissions).
    this.repository.grantPullPush(deployRole);
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['ecr:GetAuthorizationToken'],
        resources: ['*'],
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      }),
    );

    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: 'weyro-monthly',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.monthlyBudgetUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        {
          notification: { notificationType: 'FORECASTED', comparisonOperator: 'GREATER_THAN', threshold: 80 },
          subscribers: [{ subscriptionType: 'EMAIL', address: props.alertEmail }],
        },
        {
          notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 100 },
          subscribers: [{ subscriptionType: 'EMAIL', address: props.alertEmail }],
        },
      ],
    });

    new CfnOutput(this, 'RepositoryUri', { value: this.repository.repositoryUri });
    new CfnOutput(this, 'GitHubDeployRoleArn', { value: deployRole.roleArn });
  }
}
