
import { Hono } from 'hono';
import { Env, User } from '../types';
import { createDB } from '../utils/db';
import { getPresignedUrl } from '../utils/r2';
import { ApiError } from '../utils/errors';
import { z } from 'zod';

// Create router
const router = new Hono<{ Bindings: Env, Variables: { userId: string } }>();

// Validation schema for profile updates
const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  photoFileName: z.string().optional(),
});

/**
 * GET /api/profile
 * Get user profile
 */
router.get('/', async (c) => {
  const userId = c.get('userId');
  const db = createDB(c.env);
  
  const user = await db.querySingle<User>(
    'SELECT id, email, full_name, wallet_address, created_at, updated_at FROM users WHERE id = ?',
    [userId]
  );
  
  if (!user) {
    throw new ApiError(404, 'Profile not found');
  }
  
  return c.json(user);
});

/**
 * PUT /api/profile
 * Update user profile
 */
router.put('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  
  try {
    const { fullName, email, photoFileName } = updateProfileSchema.parse(body);
    const db = createDB(c.env);
    
    // Start building the SQL update query
    const updateFields = [];
    const params = [];
    
    if (fullName !== undefined) {
      updateFields.push('full_name = ?');
      params.push(fullName);
    }
    
    if (email !== undefined) {
      updateFields.push('email = ?');
      params.push(email);
    }
    
    // Only proceed if there are fields to update
    if (updateFields.length === 0 && !photoFileName) {
      throw new ApiError(400, 'No fields to update');
    }
    
    // Handle photo upload if included
    let uploadUrl;
    let publicUrl;
    
    if (photoFileName) {
      const key = `profiles/${userId}/${photoFileName}`;
      const contentType = photoFileName.endsWith('.png') 
        ? 'image/png' 
        : photoFileName.endsWith('.jpg') || photoFileName.endsWith('.jpeg')
          ? 'image/jpeg'
          : 'application/octet-stream';
          
      const presignedUrl = await getPresignedUrl(c.env, 'PUT', key, contentType);
      uploadUrl = presignedUrl.url;
      publicUrl = `https://${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${c.env.CERT_BUCKET}/${key}`;
      
      // Add profile photo URL to update fields
      updateFields.push('profile_photo_url = ?');
      params.push(publicUrl);
    }
    
    // Update the user record if there are fields to update
    if (updateFields.length > 0) {
      // Add updated_at and userId to params
      updateFields.push('updated_at = datetime("now")');
      params.push(userId);
      
      await db.execute(
        `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
        params
      );
    }
    
    // Get the updated user
    const updatedUser = await db.querySingle<User>(
      'SELECT id, email, full_name, wallet_address, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );
    
    // Return the updated user with upload URL if applicable
    const response = { 
      user: updatedUser
    };
    
    if (uploadUrl && publicUrl) {
      response['uploadUrl'] = uploadUrl;
      response['publicUrl'] = publicUrl;
    }
    
    return c.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(400, `Validation error: ${error.errors[0].message}`);
    }
    throw error;
  }
});

export default router;
