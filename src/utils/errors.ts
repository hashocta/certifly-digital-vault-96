
import { Context } from 'hono';
import { Env } from '../types';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const errorHandler = (err: Error, c: Context<{ Bindings: Env }>): Response => {
  if (err instanceof ApiError) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { 
        status: err.status,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  console.error('Unhandled error:', err);
  
  return new Response(
    JSON.stringify({ error: 'Internal Server Error' }),
    { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
};
