/**
 * Runs before any module is imported by the e2e suite.
 *
 * The repo-root `.env` used for local development may contain real Razorpay
 * keys. Clearing them here (dotenv never overrides existing variables) keeps
 * e2e deterministic: the app selects MockPaymentGateway, and no test can
 * accidentally reach the live payment API.
 */
process.env.NODE_ENV = 'test';
process.env.RAZORPAY_KEY_ID = '';
process.env.RAZORPAY_KEY_SECRET = '';
process.env.RAZORPAY_WEBHOOK_SECRET = '';
