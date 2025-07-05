import { Request, Response, NextFunction } from 'express'

//asyncHandler accepts a function that returns a Promise.
// It catches any errors that occur in the function
// and passes them to the next middleware (error handler).
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
