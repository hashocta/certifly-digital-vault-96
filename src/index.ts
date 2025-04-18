
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { prettyJSON } from 'hono/pretty-json';
import { jwt } from 'hono/jwt';
import { logger } from 'hono/logger';

import { Env } from './types';
import { errorHandler } from './utils/errors';
import authRoutes from './api/auth';
import profileRoutes from './api/profile';
import certificatesRoutes from './api/certificates';
import verifyRoutes from './api/verify';
import mintRoutes from './api/mint';

// Create Hono app with environment bindings
const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', logger());
app.use('*', secureHeaders());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: (origin) => {
    // You can whitelist specific origins or return the requesting origin
    // For development & testing purposes, we'll return the requesting origin
    return origin || 'https://legendary-baklava-e1b705.netlify.app';
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
  credentials: true,
}));

// JWT middleware for protected routes
const jwtMiddleware = jwt({
  secret: (c) => c.env.JWT_SECRET
});

// Route configuration
app.route('/api/auth', authRoutes);

// Protected routes with JWT middleware
app.use('/api/profile/*', jwtMiddleware);
app.use('/api/certificates/*', jwtMiddleware);
app.use('/api/verify/*', jwtMiddleware);
app.use('/api/mint/*', jwtMiddleware);

// Route handlers
app.route('/api/profile', profileRoutes);
app.route('/api/certificates', certificatesRoutes);
app.route('/api/verify', verifyRoutes);
app.route('/api/mint', mintRoutes);

// Error handling
app.onError((err, c) => {
  return errorHandler(err, c);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    status: 404,
    message: 'Not Found',
  }, 404);
});

// Export the app
export default app;
