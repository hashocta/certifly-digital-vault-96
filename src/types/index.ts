
import { JwtPayload } from 'jsonwebtoken';

// Use correct typings for Cloudflare Workers environment
export interface Env {
  // Bindings
  DB: any; // D1Database
  CERT_BUCKET: any; // R2Bucket
  
  // Environment variables
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_ACCOUNT_ID: string;
  BUNDLR_URL: string;
  BUNDLR_CURRENCY: string;
  BUNDLR_PRIVATE_KEY: string;
  SOLANA_RPC_URL: string;
  VERIFY_API_KEY: string;
  JWT_SECRET: string;
  LOG_LEVEL: string;
}

export interface User {
  id: string;
  email?: string;
  full_name: string;
  wallet_address: string;
  created_at: string;
  updated_at: string;
}

export interface Certificate {
  id: string;
  user_id: string;
  title: string;
  institution_name: string;
  program_name: string;
  issue_date: string;
  verification_url: string;
  verification_url_pdf?: string;
  certificate_url: string;
  arweave_url?: string;
  nft_mint_address?: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  verification_details?: string;
  created_at: string;
  updated_at: string;
}

export interface VerificationLog {
  id: string;
  certificate_id: string;
  verification_step: string;
  status: string;
  details?: string;
  created_at: string;
}

export interface JWTUserPayload extends JwtPayload {
  userId: string;
  walletAddress: string;
}

export interface PresignedUrl {
  url: string;
  expiresAt: number;
}

export interface VerificationResponse {
  status: string;
  details: Record<string, any>;
}
