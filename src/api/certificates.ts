
import { Hono } from 'hono';
import { Env, Certificate } from '../types';
import { createDB } from '../utils/db';
import { getPresignedUrl, uploadToR2 } from '../utils/r2';
import { convertImageToPdf, isValidPDF } from '../utils/pdf';
import { ApiError } from '../utils/errors';
import { ulid } from 'ulid';
import { z } from 'zod';

// Create router
const router = new Hono<{ Bindings: Env, Variables: { userId: string } }>();

// Validation schema for certificate creation
const createCertificateSchema = z.object({
  title: z.string().min(1).max(200),
  institutionName: z.string().min(1).max(200),
  programName: z.string().min(1).max(200),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  fileName: z.string().min(1),
  fileType: z.string().min(1),
});

/**
 * GET /api/certificates
 * List all certificates for the user
 */
router.get('/', async (c) => {
  const userId = c.get('userId');
  const db = createDB(c.env);
  
  const certificates = await db.queryMany<Certificate>(
    `SELECT 
      id, title, institution_name, program_name, issue_date, 
      certificate_url, verification_status, verification_details,
      arweave_url, nft_mint_address, created_at, updated_at
     FROM certificates 
     WHERE user_id = ? 
     ORDER BY created_at DESC`,
    [userId]
  );
  
  return c.json({ certificates });
});

/**
 * GET /api/certificates/:id
 * Get a specific certificate
 */
router.get('/:id', async (c) => {
  const userId = c.get('userId');
  const certificateId = c.req.param('id');
  const db = createDB(c.env);
  
  const certificate = await db.querySingle<Certificate>(
    `SELECT * FROM certificates WHERE id = ? AND user_id = ?`,
    [certificateId, userId]
  );
  
  if (!certificate) {
    throw new ApiError(404, 'Certificate not found');
  }
  
  return c.json(certificate);
});

/**
 * POST /api/certificates
 * Create a new certificate
 */
router.post('/', async (c) => {
  const userId = c.get('userId');
  
  try {
    const body = await c.req.json();
    const { title, institutionName, programName, issueDate, fileName, fileType } = createCertificateSchema.parse(body);
    
    // Generate certificate ID
    const certificateId = ulid();
    
    // Define storage paths
    const pdfKey = `certificates/${userId}/${certificateId}.pdf`;
    
    // Check if we need file upload - client side might be just requesting pre-signed URLs
    const needsFileUpload = body.requestUploadUrl === true;
    
    if (needsFileUpload) {
      // Generate pre-signed URL for upload
      const contentType = fileType === 'application/pdf' ? 'application/pdf' : 'image/*';
      const presignedUrl = await getPresignedUrl(c.env, 'PUT', pdfKey, contentType);
      
      // Calculate verification URL
      const certificateUrl = `https://${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${c.env.CERT_BUCKET}/${pdfKey}`;
      const verificationUrl = `https://certifly.in/verify/${certificateId}`;
      
      // Create record in database
      const db = createDB(c.env);
      await db.execute(
        `INSERT INTO certificates (
          id, user_id, title, institution_name, program_name, issue_date,
          verification_url, certificate_url, verification_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`,
        [
          certificateId, 
          userId, 
          title, 
          institutionName, 
          programName, 
          issueDate, 
          verificationUrl, 
          certificateUrl, 
          'pending'
        ]
      );
      
      // Return pre-signed URL for client to upload
      return c.json({
        id: certificateId,
        uploadUrl: presignedUrl.url,
        expiresAt: presignedUrl.expiresAt,
        certificateUrl,
        verificationUrl,
      });
    } else {
      // Get file data directly from request (for worker-based processing)
      const fileData = await c.req.arrayBuffer();
      
      // Process file based on type
      let pdfBuffer: ArrayBuffer | Uint8Array;
      
      if (fileType === 'application/pdf') {
        // Verify it's a valid PDF
        const isPdfValid = await isValidPDF(fileData);
        if (!isPdfValid) {
          throw new ApiError(400, 'Invalid PDF file');
        }
        pdfBuffer = fileData;
      } else if (
        fileType === 'image/png' ||
        fileType === 'image/jpeg' ||
        fileType === 'image/jpg'
      ) {
        // Convert image to PDF
        pdfBuffer = await convertImageToPdf(fileData, fileType);
      } else {
        throw new ApiError(400, `Unsupported file type: ${fileType}`);
      }
      
      // Upload to R2
      const certificateUrl = await uploadToR2(c.env, pdfKey, pdfBuffer, 'application/pdf');
      const verificationUrl = `https://certifly.in/verify/${certificateId}`;
      
      // Create record in database
      const db = createDB(c.env);
      await db.execute(
        `INSERT INTO certificates (
          id, user_id, title, institution_name, program_name, issue_date,
          verification_url, certificate_url, verification_status,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime("now"), datetime("now"))`,
        [
          certificateId, 
          userId, 
          title, 
          institutionName, 
          programName, 
          issueDate, 
          verificationUrl, 
          certificateUrl, 
          'pending'
        ]
      );
      
      // Return certificate info
      return c.json({
        id: certificateId,
        certificateUrl,
        verificationUrl,
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(400, `Validation error: ${error.errors[0].message}`);
    }
    throw error;
  }
});

/**
 * DELETE /api/certificates/:id
 * Delete a certificate
 */
router.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const certificateId = c.req.param('id');
  const db = createDB(c.env);
  
  // Check if certificate exists and belongs to user
  const certificate = await db.querySingle<Certificate>(
    `SELECT id FROM certificates WHERE id = ? AND user_id = ?`,
    [certificateId, userId]
  );
  
  if (!certificate) {
    throw new ApiError(404, 'Certificate not found');
  }
  
  // Delete the certificate
  await db.execute(
    `DELETE FROM certificates WHERE id = ?`,
    [certificateId]
  );
  
  // TODO: If desired, also delete from R2 storage
  // await c.env.CERT_BUCKET.delete(`certificates/${userId}/${certificateId}.pdf`);
  
  return c.json({ success: true });
});

export default router;
