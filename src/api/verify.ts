
import { Hono } from 'hono';
import { Env, Certificate, VerificationResponse } from '../types';
import { createDB } from '../utils/db';
import { verifyCertificate } from '../utils/verifyWorker';
import { ApiError } from '../utils/errors';
import { ulid } from 'ulid';

// Create router
const router = new Hono<{ Bindings: Env, Variables: { userId: string } }>();

/**
 * GET /api/verify/:id
 * Verify a certificate status
 */
router.get('/:id', async (c) => {
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
  
  // Get current status
  return c.json({
    id: certificate.id,
    status: certificate.verification_status,
    details: certificate.verification_details ? JSON.parse(certificate.verification_details) : null,
  });
});

/**
 * POST /api/verify/:id
 * Initiate verification for a certificate
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
  
  // Only allow verification if status is pending
  if (certificate.verification_status !== 'pending') {
    return c.json({
      id: certificate.id,
      status: certificate.verification_status,
      details: certificate.verification_details ? JSON.parse(certificate.verification_details) : null,
      message: 'Certificate has already been verified or rejected'
    });
  }
  
  try {
    // Call verification worker
    const verificationResult = await verifyCertificate(c.env, userId, certificateId);
    
    // Create verification log
    const logId = ulid();
    await db.execute(
      `INSERT INTO verification_logs 
        (id, certificate_id, verification_step, status, details, created_at) 
       VALUES (?, ?, ?, ?, ?, datetime("now"))`,
      [
        logId,
        certificateId,
        'external_verification',
        verificationResult.status,
        JSON.stringify(verificationResult.details),
      ]
    );
    
    // Update certificate status
    await db.execute(
      `UPDATE certificates 
       SET verification_status = ?, verification_details = ?, updated_at = datetime("now")
       WHERE id = ?`,
      [
        verificationResult.status,
        JSON.stringify(verificationResult.details),
        certificateId,
      ]
    );
    
    return c.json({
      id: certificateId,
      status: verificationResult.status,
      details: verificationResult.details,
    });
  } catch (error) {
    // Log verification failure
    const logId = ulid();
    await db.execute(
      `INSERT INTO verification_logs 
        (id, certificate_id, verification_step, status, details, created_at) 
       VALUES (?, ?, ?, ?, ?, datetime("now"))`,
      [
        logId,
        certificateId,
        'external_verification',
        'error',
        error instanceof Error ? error.message : String(error),
      ]
    );
    
    throw error;
  }
});

export default router;
