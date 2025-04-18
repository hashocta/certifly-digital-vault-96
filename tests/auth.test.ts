
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Miniflare } from 'miniflare';
import { unstable_dev } from 'wrangler';

describe('Authentication API', () => {
  let mf;
  let worker;

  beforeAll(async () => {
    // Mock D1 database
    mf = new Miniflare({
      modules: true,
      scriptPath: './src/index.ts',
      bindings: {
        DB: {},
        CERT_BUCKET: {},
        JWT_SECRET: 'test_jwt_secret_that_is_at_least_32_characters',
        VERIFY_API_KEY: 'test_verify_api_key',
        R2_ACCESS_KEY_ID: 'test_access_key',
        R2_SECRET_ACCESS_KEY: 'test_secret_key',
        R2_ACCOUNT_ID: 'test_account_id',
        BUNDLR_URL: 'https://node1.bundlr.network',
        BUNDLR_CURRENCY: 'solana',
        BUNDLR_PRIVATE_KEY: 'test_private_key',
        SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
      },
    });

    // Set up database mocks
    const db = await mf.getD1Database('DB');
    await db.exec(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        full_name TEXT NOT NULL,
        wallet_address TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Start the worker
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
    });
  });

  afterAll(async () => {
    await worker.stop();
    await mf.dispose();
  });

  it('should require message, signature, and publicKey for login', async () => {
    // Mock missing parameters
    const resp = await worker.fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    expect(resp.status).toBe(400);

    const data = await resp.json();
    expect(data.error).toBeDefined();
    expect(data.error).toContain('Missing required parameters');
  });

  it('should return 401 for invalid signature', async () => {
    // Mock signature verification
    vi.mock('../src/utils/solana', () => ({
      verifySignature: () => false,
    }));

    const resp = await worker.fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Sign this message to authenticate',
        signature: 'invalid_signature',
        publicKey: 'test_public_key',
      }),
    });

    expect(resp.status).toBe(401);

    const data = await resp.json();
    expect(data.error).toBeDefined();
    expect(data.error).toContain('Invalid signature');
  });

  it('should require authorization for /api/auth/me endpoint', async () => {
    const resp = await worker.fetch('/api/auth/me');
    expect(resp.status).toBe(401);

    const data = await resp.json();
    expect(data.error).toBeDefined();
    expect(data.error).toContain('Unauthorized');
  });
});
