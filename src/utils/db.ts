
import { ApiError } from './errors';
import { Env } from '../types';

export class DB {
  constructor(private db: any) {} // Using any instead of D1Database for compatibility

  /**
   * Execute a query that returns a single row or null
   */
  async querySingle<T>(
    sql: string, 
    params: any[] = []
  ): Promise<T | null> {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).first();
      return result as T || null;
    } catch (err) {
      console.error('Database error in querySingle:', err);
      throw new ApiError(500, 'Database error occurred');
    }
  }

  /**
   * Execute a query that returns multiple rows
   */
  async queryMany<T>(
    sql: string, 
    params: any[] = []
  ): Promise<T[]> {
    try {
      const stmt = this.db.prepare(sql);
      const result = await stmt.bind(...params).all();
      return (result?.results || []) as T[];
    } catch (err) {
      console.error('Database error in queryMany:', err);
      throw new ApiError(500, 'Database error occurred');
    }
  }

  /**
   * Execute a query that doesn't return data (INSERT, UPDATE, DELETE)
   */
  async execute(
    sql: string, 
    params: any[] = []
  ): Promise<any> {
    try {
      const stmt = this.db.prepare(sql);
      return await stmt.bind(...params).run();
    } catch (err) {
      console.error('Database error in execute:', err);
      throw new ApiError(500, 'Database error occurred');
    }
  }

  /**
   * Begin a database transaction
   */
  async transaction<T>(
    callback: (db: DB) => Promise<T>
  ): Promise<T> {
    try {
      await this.execute('BEGIN TRANSACTION');
      const result = await callback(this);
      await this.execute('COMMIT');
      return result;
    } catch (error) {
      await this.execute('ROLLBACK');
      throw error;
    }
  }
}

/**
 * Create a database instance from environment
 */
export function createDB(env: Env): DB {
  return new DB(env.DB);
}
