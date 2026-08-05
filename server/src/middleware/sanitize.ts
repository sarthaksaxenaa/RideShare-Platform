import { Request, Response, NextFunction } from 'express';

function stripTags(str: string): string {
  return str.replace(/<[^>]*>/g, '');
}

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') return stripTags(obj);
  if (Array.isArray(obj)) return obj.map(sanitizeObject);
  if (obj && typeof obj === 'object') {
    const clean: any = {};
    for (const [k, v] of Object.entries(obj)) {
      clean[k] = sanitizeObject(v);
    }
    return clean;
  }
  return obj;
}

export function sanitize(req: Request, _res: Response, next: NextFunction) {
  if (req.body) req.body = sanitizeObject(req.body);
  next();
}
