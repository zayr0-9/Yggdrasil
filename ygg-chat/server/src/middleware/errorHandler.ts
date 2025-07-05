import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ErrorResponse } from '../../../shared/types';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response<ErrorResponse>,
  next: NextFunction
): void {
  console.error('Error:', err);

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.errors
    });
    return;
  }

  const statusCode = 'statusCode' in err && typeof err.statusCode === 'number' 
    ? err.statusCode 
    : 500;

  res.status(statusCode).json({
    error: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
}