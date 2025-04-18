
import { Hono } from 'hono';
import { Env, User } from '../types';
import { createDB } from '../utils/db';
import { verifySignature } from '../utils/solana';
import { ulid } from 'ulid';
import { sign, verify } from 'jsonwebtoken';
import { ApiError } from '../utils/errors';

// Create router
const router = new Hono<{ Bindings: Env }>();

/**
 * POST /api/auth/login
 * Authenticate a user via Solana wallet signature
 */
router.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { message, signature, publicKey } = body;
    
    console.log('Login attempt:', { 
      message: message,
      publicKey: publicKey,
      signatureLength: signature?.length
    });
    
    if (!message || !signature || !publicKey) {
      throw new ApiError(400, 'Missing required parameters: message, signature, publicKey');
    }
    
    // Verify signature
    const isValidSignature = verifySignature(message, signature, publicKey);
    
    console.log('Signature verification result:', isValidSignature);
    
    if (!isValidSignature) {
      console.error('Invalid signature detected:', { 
        message, 
        publicKey,
        signaturePrefix: signature?.substring(0, 10) + '...' 
      });
      throw new ApiError(401, 'Invalid signature');
    }
    
    // Get database
    const db = createDB(c.env);
    
    // Check if user exists
    let user = await db.querySingle<User>(
      'SELECT * FROM users WHERE wallet_address = ?',
      [publicKey]
    );
    
    // If user doesn't exist, create one
    if (!user) {
      const userId = ulid();
      await db.execute(
        'INSERT INTO users (id, wallet_address, full_name, created_at, updated_at) VALUES (?, ?, ?, datetime("now"), datetime("now"))',
        [userId, publicKey, `User ${userId.slice(0, 6)}`]
      );
      
      // Get the new user
      user = await db.querySingle<User>(
        'SELECT * FROM users WHERE id = ?',
        [userId]
      );
      
      if (!user) {
        throw new ApiError(500, 'Failed to create user');
      }
    }
    
    // Create JWT token
    const token = sign(
      { 
        userId: user.id,
        walletAddress: user.wallet_address,
      },
      c.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    return c.json({ token, user });
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, `Login error: ${error.message}`);
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ApiError(401, 'Unauthorized');
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const payload = verify(token, c.env.JWT_SECRET) as { userId: string };
    const db = createDB(c.env);
    
    const user = await db.querySingle<User>(
      'SELECT id, email, full_name, wallet_address, created_at, updated_at FROM users WHERE id = ?',
      [payload.userId]
    );
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    return c.json(user);
  } catch (error) {
    throw new ApiError(401, 'Invalid token');
  }
});

export default router;
