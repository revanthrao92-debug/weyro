import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cwActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as cr from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { ECR_REPOSITORY, type EnvConfig } from './config';

export interface EnvStackProps extends StackProps {
  config: EnvConfig;
  /** Image tag to run (the git commit, set by the deploy workflow). */
  imageTag: string;
  alertEmail: string;
}

const API_PORT = 4000;
const DB_NAME = 'weyro';
/** Provider keys the owner fills in (Secrets Manager console). Empty ones are left unset at start-up. */
const PROVIDER_KEYS = [
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'MSG91_AUTH_KEY',
  'MSG91_OTP_TEMPLATE_ID',
  'MSG91_SENDER_ID',
  'SENTRY_DSN',
] as const;

/**
 * One Weyro environment (staging or production) in Mumbai:
 * CloudFront (HTTPS) → private load balancer (CloudFront VPC origin, no public address) →
 * Fargate API tasks → RDS PostgreSQL + PostGIS, optional Valkey, private S3.
 */
export class WeyroEnvStack extends Stack {
  constructor(scope: Construct, id: string, props: EnvStackProps) {
    super(scope, id, props);
    const { config } = props;
    const prefix = `weyro-${config.name}`;

    // ── Network: no NAT gateway (saves ~$35/month). Tasks get a public IP for outbound calls
    // (MSG91, Razorpay, Sentry, ECR), but accept traffic only from the load balancer.
    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: 'private', subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
    });

    const albSg = new ec2.SecurityGroup(this, 'AlbSg', { vpc, description: 'Private load balancer', allowAllOutbound: true });
    const apiSg = new ec2.SecurityGroup(this, 'ApiSg', { vpc, description: 'API tasks', allowAllOutbound: true });
    const dbSg = new ec2.SecurityGroup(this, 'DbSg', { vpc, description: 'PostgreSQL', allowAllOutbound: false });
    apiSg.addIngressRule(albSg, ec2.Port.tcp(API_PORT), 'Only the load balancer reaches the API');
    dbSg.addIngressRule(apiSg, ec2.Port.tcp(5432), 'Only the API reaches the database');

    // ── Database: PostgreSQL 16 + PostGIS 3.4 (same as local and CI). Password managed by RDS,
    // without characters that would need escaping in a connection URL.
    const db = new rds.DatabaseInstance(this, 'Database', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16_13 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE4_GRAVITON, ec2.InstanceSize[config.dbInstance.toUpperCase() as 'MICRO']),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [dbSg],
      databaseName: DB_NAME,
      credentials: rds.Credentials.fromGeneratedSecret('weyro', {
        secretName: `${prefix}/database`,
        excludeCharacters: ` %+~\`#$&*()|[]{}:;<>?!'/@"\\=,^`,
      }),
      multiAz: config.dbMultiAz,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      publiclyAccessible: false,
      backupRetention: Duration.days(config.dbBackupDays),
      deletionProtection: config.protectData,
      removalPolicy: config.protectData ? RemovalPolicy.SNAPSHOT : RemovalPolicy.DESTROY,
      enablePerformanceInsights: true, // 7-day retention is free
      autoMinorVersionUpgrade: true,
      parameterGroup: new rds.ParameterGroup(this, 'DbParams', {
        engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16_13 }),
        parameters: { 'rds.force_ssl': '1' },
      }),
    });

    // ── Redis (Valkey), only when more than one API server runs (shared rate limits, sockets).
    let redisUrl: string | undefined;
    if (config.redis) {
      const redisSg = new ec2.SecurityGroup(this, 'RedisSg', { vpc, description: 'Valkey', allowAllOutbound: false });
      redisSg.addIngressRule(apiSg, ec2.Port.tcp(6379), 'Only the API reaches Redis');
      const subnets = new elasticache.CfnSubnetGroup(this, 'RedisSubnets', {
        description: 'Valkey private subnets',
        subnetIds: vpc.isolatedSubnets.map((s) => s.subnetId),
      });
      const redis = new elasticache.CfnReplicationGroup(this, 'Redis', {
        replicationGroupDescription: `${prefix} Valkey`,
        engine: 'valkey',
        cacheNodeType: 'cache.t4g.micro',
        numCacheClusters: 1,
        transitEncryptionEnabled: true,
        atRestEncryptionEnabled: true,
        cacheSubnetGroupName: subnets.ref,
        securityGroupIds: [redisSg.securityGroupId],
      });
      redisUrl = `rediss://${redis.attrPrimaryEndPointAddress}:${redis.attrPrimaryEndPointPort}`;
    }

    // ── Files: private bucket for uploads and the nightly dataset (docs/DATA.md).
    const bucket = new s3.Bucket(this, 'Files', {
      bucketName: `${prefix}-files-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: config.protectData ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !config.protectData,
      lifecycleRules: [
        {
          id: 'datasets-to-cheaper-storage',
          prefix: 'datasets/',
          transitions: [{ storageClass: s3.StorageClass.GLACIER_INSTANT_RETRIEVAL, transitionAfter: Duration.days(90) }],
        },
        { id: 'abandoned-uploads', abortIncompleteMultipartUploadAfter: Duration.days(2) },
      ],
      cors: [
        {
          // The web app uploads photos straight to S3 with short-lived signed URLs.
          allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
          maxAge: 3000,
        },
      ],
    });

    // ── Secrets: three generated by AWS, one the owner fills with provider keys.
    const generated = (name: string) =>
      new secretsmanager.Secret(this, name, {
        secretName: `${prefix}/${name}`,
        generateSecretString: { passwordLength: 48, excludePunctuation: true },
        removalPolicy: RemovalPolicy.RETAIN,
      });
    const jwtAccess = generated('jwt-access');
    const jwtRefresh = generated('jwt-refresh');
    const otpHash = generated('otp-hash');
    const providers = new secretsmanager.Secret(this, 'Providers', {
      secretName: `${prefix}/providers`,
      description: 'Fill in: Razorpay, MSG91 and Sentry keys (empty values are ignored at start-up).',
      generateSecretString: {
        secretStringTemplate: JSON.stringify(Object.fromEntries(PROVIDER_KEYS.map((k) => [k, '']))),
        generateStringKey: 'placeholder',
      },
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // ── API on Fargate.
    const cluster = new ecs.Cluster(this, 'Cluster', { vpc, clusterName: prefix });
    const repository = ecr.Repository.fromRepositoryName(this, 'ApiRepository', ECR_REPOSITORY);
    const taskDef = new ecs.FargateTaskDefinition(this, 'ApiTask', {
      cpu: config.taskCpu,
      memoryLimitMiB: config.taskMemoryMb,
      runtimePlatform: { cpuArchitecture: ecs.CpuArchitecture.X86_64, operatingSystemFamily: ecs.OperatingSystemFamily.LINUX },
    });
    bucket.grantReadWrite(taskDef.taskRole); // the server's role: no storage keys anywhere

    const logGroup = new logs.LogGroup(this, 'ApiLogs', {
      logGroupName: `/weyro/${config.name}/api`,
      retention: config.logRetentionDays as logs.RetentionDays,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Load balancer first: CloudFront's address is the API's public URL.
    const alb = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: false, // reachable only through CloudFront's VPC origin
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroup: albSg,
      idleTimeout: Duration.seconds(65),
    });
    const distribution = new cloudfront.Distribution(this, 'Cdn', {
      comment: `${prefix} API`,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_200, // includes India edge locations
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: origins.VpcOrigin.withApplicationLoadBalancer(alb, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY, // AWS-internal hop; viewers always use HTTPS
          readTimeout: Duration.seconds(60),
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED, // an API: never cache responses
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    });
    const publicUrl = `https://${distribution.distributionDomainName}`;

    // Only CloudFront's VPC-origin security group may reach the load balancer. Its id isn't
    // exposed by CloudFormation, so it's read once the distribution exists.
    const cfSg = new cr.AwsCustomResource(this, 'CloudFrontOriginSg', {
      onCreate: {
        service: 'EC2',
        action: 'describeSecurityGroups',
        parameters: {
          Filters: [
            { Name: 'vpc-id', Values: [vpc.vpcId] },
            { Name: 'group-name', Values: ['CloudFront-VPCOrigins-Service-SG'] },
          ],
        },
        physicalResourceId: cr.PhysicalResourceId.of(`${prefix}-cf-origin-sg`),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({ resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE }),
      installLatestAwsSdk: false,
    });
    cfSg.node.addDependency(distribution);
    // A separate rule resource (not inline on the group): the group must exist before the load
    // balancer and CloudFront, while this rule can only be added after them.
    new ec2.CfnSecurityGroupIngress(this, 'AlbFromCloudFront', {
      groupId: albSg.securityGroupId,
      sourceSecurityGroupId: cfSg.getResponseField('SecurityGroups.0.GroupId'),
      ipProtocol: 'tcp',
      fromPort: 80,
      toPort: 80,
      description: 'Only CloudFront reaches the load balancer',
    });

    const secret = (s: secretsmanager.ISecret, field?: string) => ecs.Secret.fromSecretsManager(s, field);
    taskDef.addContainer('api', {
      image: ecs.ContainerImage.fromEcrRepository(repository, props.imageTag),
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'api' }),
      portMappings: [{ containerPort: API_PORT }],
      environment: {
        NODE_ENV: 'production',
        PORT: String(API_PORT),
        API_PUBLIC_URL: publicUrl,
        TRUST_PROXY: '2', // CloudFront, then the load balancer
        DB_HOST: db.dbInstanceEndpointAddress,
        DB_NAME,
        DATABASE_POOL_MAX: '10',
        STORAGE_DRIVER: 's3',
        STORAGE_BUCKET: bucket.bucketName,
        STORAGE_REGION: this.region,
        PAYMENT_GATEWAY: 'razorpay', // staging uses Razorpay test keys
        SMS_PROVIDER: 'msg91',
        // The API's own address is always allowed, plus any web app listed in config.
        CORS_ORIGINS: [publicUrl, ...config.corsOrigins].join(','),
        SENTRY_ENVIRONMENT: config.name,
        SENTRY_RELEASE: props.imageTag,
        ...(redisUrl ? { REDIS_URL: redisUrl } : {}),
      },
      secrets: {
        DB_USER: secret(db.secret!, 'username'),
        DB_PASSWORD: secret(db.secret!, 'password'),
        JWT_ACCESS_SECRET: secret(jwtAccess),
        JWT_REFRESH_SECRET: secret(jwtRefresh),
        OTP_HASH_SECRET: secret(otpHash),
        ...Object.fromEntries(PROVIDER_KEYS.map((k) => [k, secret(providers, k)])),
      },
      // Build the connection URL, drop provider keys not filled in yet, migrate, then start.
      // A failed migration stops the new version; the old one keeps serving (rolling deploy).
      entryPoint: ['sh', '-c'],
      command: [
        [
          'export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:5432/$DB_NAME?sslmode=require"',
          'export DIRECT_URL="$DATABASE_URL"',
          // `if` (not `[ ] && unset`): a filled-in last key must not make the loop "fail" and stop start-up.
          `for k in ${PROVIDER_KEYS.join(' ')}; do eval "v=\\$$k"; if [ -z "$v" ]; then unset "$k"; fi; done`,
          'npm run db:migrate:deploy',
          'exec node apps/api/dist/main.js',
        ].join(' && '),
      ],
    });

    const service = new ecs.FargateService(this, 'ApiService', {
      cluster,
      serviceName: `${prefix}-api`,
      taskDefinition: taskDef,
      desiredCount: config.desiredCount,
      assignPublicIp: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [apiSg],
      minHealthyPercent: 100, // keep the old version serving until the new one is healthy
      maxHealthyPercent: 200,
      circuitBreaker: { enable: true, rollback: true }, // a failing release rolls itself back
      healthCheckGracePeriod: Duration.minutes(3), // migrations + start-up
      enableExecuteCommand: false,
    });
    const listener = alb.addListener('Http', { port: 80, open: false });
    const targets = listener.addTargets('Api', {
      port: API_PORT,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [service],
      deregistrationDelay: Duration.seconds(20),
      healthCheck: { path: '/api/v1/ready', interval: Duration.seconds(15), healthyThresholdCount: 2, unhealthyThresholdCount: 3 },
    });

    // ── Alarms → email.
    const topic = new sns.Topic(this, 'Alerts', { displayName: `Weyro ${config.name} alerts` });
    topic.addSubscription(new subs.EmailSubscription(props.alertEmail));
    const alarm = (id: string, metric: cloudwatch.IMetric, threshold: number, description: string, evaluationPeriods = 1) =>
      new cloudwatch.Alarm(this, id, {
        metric,
        threshold,
        evaluationPeriods,
        alarmDescription: description,
        comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }).addAlarmAction(new cwActions.SnsAction(topic));
    alarm(
      'Api5xx',
      targets.metrics.httpCodeTarget(elbv2.HttpCodeTarget.TARGET_5XX_COUNT, { period: Duration.minutes(5), statistic: 'Sum' }),
      10,
      'The API returned 10+ server errors in 5 minutes',
    );
    alarm('ApiUnhealthy', targets.metrics.unhealthyHostCount({ period: Duration.minutes(5) }), 1, 'An API server is failing its health check', 2);
    alarm('DbCpu', db.metricCPUUtilization({ period: Duration.minutes(5) }), 80, 'Database CPU above 80% for 15 minutes', 3);
    new cloudwatch.Alarm(this, 'DbStorageLow', {
      metric: db.metricFreeStorageSpace({ period: Duration.minutes(15) }),
      threshold: 2 * 1024 ** 3,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      alarmDescription: 'Database has less than 2 GB free',
    }).addAlarmAction(new cwActions.SnsAction(topic));

    new CfnOutput(this, 'ApiUrl', { value: `${publicUrl}/api/v1`, description: 'EXPO_PUBLIC_API_URL for this environment' });
    new CfnOutput(this, 'FilesBucket', { value: bucket.bucketName });
    new CfnOutput(this, 'ProvidersSecret', { value: providers.secretName, description: 'Fill in Razorpay, MSG91 and Sentry keys here' });
    new CfnOutput(this, 'LogGroup', { value: logGroup.logGroupName });
  }
}
