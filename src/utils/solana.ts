
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Env } from '../types';
import { ApiError } from './errors';
import * as nacl from 'tweetnacl';
import * as base58 from 'base58-js';

/**
 * Create a Solana connection from environment
 */
export function createConnection(env: Env): Connection {
  return new Connection(env.SOLANA_RPC_URL, 'confirmed');
}

/**
 * Simplified mock implementation for minting an NFT certificate
 * In a real implementation, this would use the Metaplex SDK properly
 */
export async function mintNFTCertificate(
  env: Env,
  arweaveUrl: string,
  title: string,
  description: string,
  userWalletAddress: string,
  certificateId: string,
  userId: string
): Promise<string> {
  try {
    // Mock implementation that would be replaced with actual Metaplex interactions
    console.log(`Mock Solana mint - certificate ${certificateId} for user ${userId}`);
    console.log(`With metadata URL: ${arweaveUrl}`);
    
    // Generate a mock mint address
    const mockMintAddress = 'So1ana' + Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    
    return mockMintAddress;
  } catch (error) {
    console.error('NFT minting error:', error);
    throw new ApiError(500, `Failed to mint NFT certificate: ${error}`);
  }
}

/**
 * Verify a Solana wallet signature
 */
export function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = base58.decode(signature);
    const pubKeyBytes = base58.decode(publicKey);
    
    return nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      pubKeyBytes
    );
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Helper function for base58 decoding
export function decodeBase58(str: string): Uint8Array {
  return base58.decode(str);
}
