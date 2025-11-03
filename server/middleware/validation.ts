import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errorHandler';

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePassword = (password: string): { valid: boolean; error?: string } => {
  if (!password || password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one uppercase letter' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one lowercase letter' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  return { valid: true };
};

export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>'"]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .replace(/`/g, '')
    .replace(/\$\{/g, '')
    .trim();
};

export const validateRequiredFields = (
  fields: Record<string, unknown>,
  requiredFields: string[]
) => {
  const missing: string[] = [];
  
  for (const field of requiredFields) {
    if (fields[field] === undefined || fields[field] === null || fields[field] === '') {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
  }
};

export const validateFileType = (
  mimetype: string,
  allowedTypes: string[]
): void => {
  if (!allowedTypes.includes(mimetype)) {
    throw new ValidationError(
      `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`
    );
  }
};

export const validateFileSize = (
  size: number,
  maxSizeInMB: number
): void => {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  if (size > maxSizeInBytes) {
    throw new ValidationError(
      `File size exceeds maximum allowed size of ${maxSizeInMB}MB`
    );
  }
};

export const validatePrice = (price: number): void => {
  if (price < 0) {
    throw new ValidationError('Price cannot be negative');
  }
  if (price > 1000000) {
    throw new ValidationError('Price exceeds maximum allowed value');
  }
  if (!Number.isFinite(price)) {
    throw new ValidationError('Price must be a valid number');
  }
};

export const validatePagination = (
  page?: string | number,
  limit?: string | number
): { page: number; limit: number } => {
  const parsedPage = typeof page === 'string' ? parseInt(page, 10) : (page || 1);
  const parsedLimit = typeof limit === 'string' ? parseInt(limit, 10) : (limit || 20);

  if (isNaN(parsedPage) || parsedPage < 1) {
    throw new ValidationError('Page must be a positive integer');
  }

  if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    throw new ValidationError('Limit must be between 1 and 100');
  }

  return { page: parsedPage, limit: parsedLimit };
};

export const validateObjectId = (id: string, fieldName = 'ID'): void => {
  if (!id || typeof id !== 'string' || id.trim() === '') {
    throw new ValidationError(`${fieldName} is required`);
  }
  
  if (id.length < 3 || id.length > 100) {
    throw new ValidationError(`${fieldName} has invalid length`);
  }
};

export const validateUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const rateLimitByIP = (
  maxRequests: number,
  windowMs: number
) => {
  const requests = new Map<string, { count: number; resetTime: number }>();
  const MAX_ENTRIES = 10000;

  setInterval(() => {
    const now = Date.now();
    requests.forEach((record, ip) => {
      if (now > record.resetTime) {
        requests.delete(ip);
      }
    });
  }, windowMs);

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    if (requests.size >= MAX_ENTRIES) {
      const oldestKey = Array.from(requests.keys())[0];
      requests.delete(oldestKey);
    }

    const record = requests.get(ip);

    if (!record || now > record.resetTime) {
      requests.set(ip, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next();
    }

    if (record.count >= maxRequests) {
      return res.status(429).json({
        error: {
          message: 'Too many requests, please try again later',
          code: 'RATE_LIMIT_EXCEEDED',
          statusCode: 429,
          timestamp: new Date().toISOString(),
        },
      });
    }

    record.count++;
    next();
  };
};

export const sanitizeUserInput = (data: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeUserInput(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};
