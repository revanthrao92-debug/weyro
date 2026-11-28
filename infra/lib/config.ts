/**
 * Everything that differs between staging and production lives here; the stacks read only this.
 * Region is fixed to Mumbai so the API sits next to its users and its database.
 */
export const REGION = 'ap-south-1';
export const GITHUB_REPO = 'revanthrao92-debug/weyro';
export const ECR_REPOSITORY = 'weyro-api';

export type EnvName = 'staging' | 'production';

export interface EnvConfig {
  name: EnvName;
  /** RDS instance size (burstable Graviton). */
  dbInstance: 'micro' | 'small' | 'medium';
  dbMultiAz: boolean;
  dbBackupDays: number;
  /** Keep the database (and the files bucket) if the stack is deleted. */
  protectData: boolean;
  /** Fargate size: vCPU units (1024 = 1 vCPU) and memory in MB. */
  taskCpu: number;
  taskMemoryMb: number;
  desiredCount: number;
  /** Redis (Valkey). Needed once more than one API server runs. */
  redis: boolean;
  /**
   * Websites allowed to call the API from a browser (CORS). The phone apps don't need this; the
   * API refuses to start in production without an explicit list.
   */
  corsOrigins: string[];
  logRetentionDays: number;
}

/**
 * Both environments run in production mode with the real services (Razorpay, MSG91): the API
 * refuses mock payments and printed OTPs in production. Staging uses Razorpay TEST keys, so no
 * real money moves; MSG91 sends real codes to testers.
 */
export const ENVIRONMENTS: Record<EnvName, EnvConfig> = {
  staging: {
    name: 'staging',
    dbInstance: 'micro',
    dbMultiAz: false,
    dbBackupDays: 7,
    protectData: false,
    taskCpu: 512,
    taskMemoryMb: 1024,
    desiredCount: 1,
    redis: false,
    corsOrigins: [],
    logRetentionDays: 14,
  },
  production: {
    name: 'production',
    dbInstance: 'small',
    dbMultiAz: false, // turn on before real traffic: doubles database cost, survives a zone outage
    dbBackupDays: 14,
    protectData: true,
    taskCpu: 512,
    taskMemoryMb: 1024,
    desiredCount: 1,
    redis: false, // turn on together with desiredCount >= 2
    corsOrigins: [],
    logRetentionDays: 30,
  },
};
