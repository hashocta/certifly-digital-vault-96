
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Miniflare } from 'miniflare';
import { unstable_dev } from 'wrangler';
import { sign } from 'jsonwebtoken';

describe('Certificates API', () => {
  let mf;
  let worker;
  let token;

  beforeAll(async () => {
    // Create test JWT
    token = sign(
      { userId: 'test_user_id', walletAddress: 'test_wallet_address' },
      'test_jwt_secret_that_is_at_least_32_characters',
      { expiresIn: '1h' }
    );

    // Mock D1 database and R2 bucket
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
      
      CREATE TABLE certificates (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id),
        title TEXT NOT NULL,
        institution_name TEXT NOT NULL,
        program_name TEXT NOT NULL,
        issue_date TEXT NOT NULL,
        verification_url TEXT NOT NULL,
        certificate_url TEXT NOT NULL,
        arweave_url TEXT,
        nft_mint_address TEXT,
        verification_status TEXT NOT NULL DEFAULT 'pending',
        verification_details TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Insert test user
      INSERT INTO users (id, full_name, wallet_address) 
      VALUES ('test_user_id', 'Test User', 'test_wallet_address');
      
      -- Insert test certificate
      INSERT INTO certificates (
        id, user_id, title, institution_name, program_name, 
        issue_date, verification_url, certificate_url, verification_status
      )
      VALUES (
        'test_cert_id', 
        'test_user_id', 
        'Test Certificate', 
        'Test Institution', 
        'Test Program', 
        '2023-01-01', 
        'https://example.com/verify/test_cert_id',
        'https://example.com/certificates/test_cert_id.pdf',
        'pending'
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

  it('should require authentication for certificates endpoints', async () => {
    const resp = await worker.fetch('/api/certificates');
    expect(resp.status).toBe(401);
  });

  it('should list certificates for authenticated user', async () => {
    const resp = await worker.fetch('/api/certificates', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(resp.status).toBe(200);
    
    const data = await resp.json();
    expect(data.certificates).toBeDefined();
    expect(Array.isArray(data.certificates)).toBe(true);
    
    if (data.certificates.length > 0) {
      const cert = data.certificates[0];
      expect(cert.id).toBeDefined();
      expect(cert.title).toBeDefined();
      expect(cert.verification_status).toBeDefined();
    }
  });

  it('should validate certificate creation input', async () => {
    const resp = await worker.fetch('/api/certificates', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Missing required fields
        title: 'Test Certificate',
      }),
    });

    expect(resp.status).toBe(400);
    
    const data = await resp.json();
    expect(data.error).toBeDefined();
    expect(data.error).toContain('Validation error');
  });

  it('should get a specific certificate by ID', async () => {
    const resp = await worker.fetch('/api/certificates/test_cert_id', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(resp.status).toBe(200);
    
    const cert = await resp.json();
    expect(cert.id).toBe('test_cert_id');
    expect(cert.title).toBe('Test Certificate');
  });

  it('should return 404 for non-existent certificate', async () => {
    const resp = await worker.fetch('/api/certificates/nonexistent_id', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(resp.status).toBe(404);
  });
});
