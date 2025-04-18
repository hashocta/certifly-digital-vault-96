
import { Hono } from 'hono';
import { Env, Certificate, User } from '../types';
import { createDB } from '../utils/db';
import { uploadToArweave } from '../utils/bundlr';
import { mintNFTCertificate } from '../utils/solana';
import { ApiError } from '../utils/errors';
import { ulid } from 'ulid';

// Create router
const router = new Hono<{ Bindings: Env, Variables: { userId: string } }>();

/**
 * POST /api/mint/:id
 * Mint a certificate as an NFT
 */
router.post('/:id', async (c) => {
  const userId = c.get('userId');
  const certificateId = c.req.param('id');
  const db = createDB(c.env);
  
  // Check if certificate exists and belongs to user
  const certificate = await db.querySingle<Certificate>(
    `SELECT * FROM certificates WHERE id = ? AND user_id = ?`,
    [certificateId, userId]
  );
  
  if (!certificate) {
    throw new ApiError(404, 'Certificate not found');
  }
  
  // Only allow minting if status is verified
  if (certificate.verification_status !== 'verified') {
    throw new ApiError(400, 'Certificate must be verified before minting');
  }
  
  // Check if already minted
  if (certificate.nft_mint_address) {
    return c.json({
      id: certificate.id,
      mintAddress: certificate.nft_mint_address,
      message: 'Certificate has already been minted'
    });
  }
  
  try {
    // Fetch PDF data from R2
    // In a real implementation, we'd get the certificate data from R2
    // For this example, we'll assume we have a byte array
    
    // Get user wallet address
    const user = await db.querySingle<User>(
      `SELECT wallet_address FROM users WHERE id = ?`,
      [userId]
    );
    
    if (!user || !user.wallet_address) {
      throw new ApiError(400, 'User wallet address not found');
    }
    
    // If not already stored on Arweave, upload to Arweave via Bundlr
    let arweaveUrl = certificate.arweave_url;
    
    if (!arweaveUrl) {
      // For this example, we're simulating the upload
      // In a real implementation, we would fetch from R2 and upload
      arweaveUrl = await uploadToArweave(c.env, new Uint8Array(10), [
        { name: 'Certificate-Id', value: certificateId },
        { name: 'User-Id', value: userId },
        { name: 'Title', value: certificate.title },
      ]);
      
      // Update the certificate with Arweave URL
      await db.execute(
        `UPDATE certificates SET arweave_url = ?, updated_at = datetime("now") WHERE id = ?`,
        [arweaveUrl, certificateId]
      );
    }
    
    // Mint the NFT
    const mintAddress = await mintNFTCertificate(
      c.env,
      arweaveUrl,
      certificate.title,
      `${certificate.institution_name} - ${certificate.program_name}`,
      user.wallet_address,
      certificateId,
      userId
    );
    
    // Update certificate with NFT mint address
    await db.execute(
      `UPDATE certificates SET nft_mint_address = ?, updated_at = datetime("now") WHERE id = ?`,
      [mintAddress, certificateId]
    );
    
    // Add minting log
    const logId = ulid();
    await db.execute(
      `INSERT INTO verification_logs 
        (id, certificate_id, verification_step, status, details, created_at) 
       VALUES (?, ?, ?, ?, ?, datetime("now"))`,
      [
        logId,
        certificateId,
        'nft_minting',
        'success',
        JSON.stringify({ mintAddress, arweaveUrl }),
      ]
    );
    
    // Return success with mint address
    return c.json({
      id: certificateId,
      mintAddress,
      arweaveUrl,
    });
  } catch (error) {
    // Log minting failure
    const logId = ulid();
    await db.execute(
      `INSERT INTO verification_logs 
        (id, certificate_id, verification_step, status, details, created_at) 
       VALUES (?, ?, ?, ?, ?, datetime("now"))`,
      [
        logId,
        certificateId,
        'nft_minting',
        'error',
        error instanceof Error ? error.message : String(error),
      ]
    );
    
    throw error;
  }
});

export default router;
