
import { Env, VerificationResponse } from '../types';
import { ApiError } from './errors';

/**
 * Call the external verification worker to verify a certificate
 */
export async function verifyCertificate(
  env: Env,
  userId: string,
  certificateId: string
): Promise<VerificationResponse> {
  const url = `https://certificate-verification-worker-v3.spacewear-work.workers.dev/verify/${userId}/${certificateId}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${env.VERIFY_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        response.status,
        `Verification worker error: ${errorText || response.statusText}`
      );
    }
    
    return await response.json() as VerificationResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    console.error('Verification worker error:', error);
    throw new ApiError(500, `Failed to verify certificate: ${error}`);
  }
}
