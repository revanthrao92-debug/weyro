import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { ENVIRONMENTS } from '../lib/config';
import { WeyroEnvStack } from '../lib/env-stack';
import { WeyroSharedStack } from '../lib/shared-stack';

const env = { account: '123456789012', region: 'ap-south-1' };
const build = (name: 'staging' | 'production') =>
  Template.fromStack(
    new WeyroEnvStack(new App(), `Test${name}`, { env, config: ENVIRONMENTS[name], imageTag: 'abc123', alertEmail: 'a@b.c' }),
  );
const staging = build('staging');
const production = build('production');

describe('safety of each environment', () => {
  it.each([
    ['staging', staging],
    ['production', production],
  ])('%s: the database is private, encrypted, PostgreSQL 16 and forces SSL', (_name, t) => {
    t.hasResourceProperties('AWS::RDS::DBInstance', {
      PubliclyAccessible: false,
      StorageEncrypted: true,
      Engine: 'postgres',
      EngineVersion: Match.stringLikeRegexp('^16\\.'),
    });
    t.hasResourceProperties('AWS::RDS::DBParameterGroup', { Parameters: { 'rds.force_ssl': '1' } });
  });

  it.each([
    ['staging', staging],
    ['production', production],
  ])('%s: the files bucket is fully private and HTTPS-only', (_name, t) => {
    t.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    t.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Effect: 'Deny', Condition: { Bool: { 'aws:SecureTransport': 'false' } } }),
        ]),
      },
    });
  });

  it.each([
    ['staging', staging],
    ['production', production],
  ])('%s: the load balancer has no public address and only CloudFront may reach it', (_name, t) => {
    t.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', { Scheme: 'internal' });
    t.hasResourceProperties('AWS::EC2::SecurityGroupIngress', { FromPort: 80, ToPort: 80, Description: 'Only CloudFront reaches the load balancer' });
    // No open-to-the-world rule on any security group.
    for (const sg of Object.values(t.findResources('AWS::EC2::SecurityGroup'))) {
      for (const rule of (sg as any).Properties.SecurityGroupIngress ?? []) expect(rule.CidrIp).not.toBe('0.0.0.0/0');
    }
  });

  it.each([
    ['staging', staging],
    ['production', production],
  ])('%s: no NAT gateway (cost), HTTPS for viewers, API responses never cached', (_name, t) => {
    t.resourceCountIs('AWS::EC2::NatGateway', 0);
    t.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'redirect-to-https',
          CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad', // AWS managed CachingDisabled
        }),
      }),
    });
  });

  it.each([
    ['staging', staging],
    ['production', production],
  ])('%s: a failing release rolls itself back and the old version keeps serving', (_name, t) => {
    t.hasResourceProperties('AWS::ECS::Service', {
      DeploymentConfiguration: Match.objectLike({
        DeploymentCircuitBreaker: { Enable: true, Rollback: true },
        MinimumHealthyPercent: 100,
      }),
    });
  });

  it.each([
    ['staging', staging],
    ['production', production],
  ])('%s: no storage keys: the API uses its role for S3', (_name, t) => {
    const [taskDef] = Object.values(t.findResources('AWS::ECS::TaskDefinition')) as any[];
    const container = taskDef.Properties.ContainerDefinitions[0];
    const names = [...container.Environment, ...container.Secrets].map((e: { Name: string }) => e.Name);
    expect(names).not.toContain('STORAGE_ACCESS_KEY');
    expect(names).not.toContain('STORAGE_SECRET_KEY');
    expect(names).toEqual(expect.arrayContaining(['DB_PASSWORD', 'JWT_ACCESS_SECRET', 'OTP_HASH_SECRET', 'STORAGE_BUCKET']));
    expect(container.Environment).toEqual(expect.arrayContaining([{ Name: 'TRUST_PROXY', Value: '2' }]));
  });
});

describe('production is stricter than staging', () => {
  it('production keeps its database on delete and protects it; staging does not', () => {
    production.hasResource('AWS::RDS::DBInstance', { DeletionPolicy: 'Snapshot', Properties: Match.objectLike({ DeletionProtection: true }) });
    staging.hasResource('AWS::RDS::DBInstance', { DeletionPolicy: 'Delete', Properties: Match.objectLike({ DeletionProtection: false }) });
    production.hasResourceProperties('AWS::RDS::DBInstance', { BackupRetentionPeriod: 14 });
  });

  it('both run the real services in production mode (staging with test keys), with an explicit CORS list', () => {
    const envOf = (t: Template) =>
      (Object.values(t.findResources('AWS::ECS::TaskDefinition'))[0] as any).Properties.ContainerDefinitions[0].Environment;
    for (const t of [production, staging]) {
      expect(envOf(t)).toEqual(
        expect.arrayContaining([
          { Name: 'NODE_ENV', Value: 'production' },
          { Name: 'PAYMENT_GATEWAY', Value: 'razorpay' },
          { Name: 'SMS_PROVIDER', Value: 'msg91' },
          expect.objectContaining({ Name: 'CORS_ORIGINS' }),
        ]),
      );
    }
  });
});

describe('shared stack', () => {
  const shared = Template.fromStack(new WeyroSharedStack(new App(), 'TestShared', { env, alertEmail: 'a@b.c', monthlyBudgetUsd: 100 }));

  it('only this repository\'s staging/production GitHub environments can deploy', () => {
    shared.hasResourceProperties('AWS::IAM::Role', {
      AssumeRolePolicyDocument: {
        Statement: [
          Match.objectLike({
            Condition: {
              StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
              StringLike: {
                'token.actions.githubusercontent.com:sub': [
                  'repo:revanthrao92-debug/weyro:environment:aws-staging',
                  'repo:revanthrao92-debug/weyro:environment:aws-production',
                ],
              },
            },
          }),
        ],
      },
    });
  });

  it('images are immutable and scanned; a monthly budget emails at 80% forecast and 100% actual', () => {
    shared.hasResourceProperties('AWS::ECR::Repository', { ImageTagMutability: 'IMMUTABLE', ImageScanningConfiguration: { ScanOnPush: true } });
    shared.hasResourceProperties('AWS::Budgets::Budget', {
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({ Notification: Match.objectLike({ NotificationType: 'FORECASTED', Threshold: 80 }) }),
        Match.objectLike({ Notification: Match.objectLike({ NotificationType: 'ACTUAL', Threshold: 100 }) }),
      ]),
    });
  });
});
