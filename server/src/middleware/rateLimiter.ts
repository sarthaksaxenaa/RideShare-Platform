import { Request, Response, NextFunction } from 'express';

const requests = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(windowMs: number = 60000, maxRequests: number = 100) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = requests.get(key);
    
    if (!record || now > record.resetAt) {
      requests.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    
    if (record.count >= maxRequests) {
      res.setHeader('Retry-After', Math.ceil((record.resetAt - now) / 1000));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    
    record.count++;
    next();
  };
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requests) {
    if (now > record.resetAt) requests.delete(key);
  }
}, 300000);

// Pre-configured limiters
export const authLimiter = rateLimit(5 * 60 * 1000, 30); // 30 req / 5 min for auth
export const apiLimiter = rateLimit(60 * 1000, 120); // 120 req / min for general API
export const uploadLimiter = rateLimit(60 * 1000, 10); // 10 req / min for uploads
