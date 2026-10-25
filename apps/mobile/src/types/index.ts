export * from '@weyro/api-contracts';

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  user: import('@weyro/api-contracts').User;
};
