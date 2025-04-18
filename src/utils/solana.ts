
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Env } from '../types';
import { ApiError } from './errors';
import * as nacl from 'tweetnacl';
import * as bs58 from 'base58-js';

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
    console.log('Verifying signature:', { message, signature, publicKey });
    
    // Convert message to bytes
    const messageBytes = new TextEncoder().encode(message);
    
    // Decode signature and public key from base58
    let signatureBytes: Uint8Array;
    let pubKeyBytes: Uint8Array;
    
    try {
      // Try to decode as base58 first
      signatureBytes = bs58.decode(signature);
      pubKeyBytes = bs58.decode(publicKey);
      
      console.log('Decoded from base58:', { 
        signatureBytesLength: signatureBytes.length, 
        pubKeyBytesLength: pubKeyBytes.length 
      });
    } catch (e) {
      console.error('Base58 decode failed:', e);
      
      // Try base64 decode for signature if base58 fails
      if (signature.includes('+') || signature.includes('/') || signature.endsWith('==')) {
        try {
          // This looks like base64, not base58
          signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
          pubKeyBytes = bs58.decode(publicKey);
          console.log('Converted base64 signature:', { signatureBytesLength: signatureBytes.length });
        } catch (base64Error) {
          console.error('Base64 decode failed:', base64Error);
          return false;
        }
      } else {
        return false;
      }
    }
    
    // Verify signature requirements
    if (signatureBytes.length !== 64) {
      console.error('Invalid signature length:', signatureBytes.length);
      return false;
    }
    
    if (pubKeyBytes.length !== 32) {
      console.error('Invalid public key length:', pubKeyBytes.length);
      return false;
    }
    
    const result = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      pubKeyBytes
    );
    
    console.log('Signature verification result:', result);
    return result;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Helper function for base58 decoding
export function decodeBase58(str: string): Uint8Array {
  return bs58.decode(str);
}
