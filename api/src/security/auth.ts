import crypto from 'crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

type ApiPrincipal = {
  id: string;
  key: string;
  roles: Set<string>;
};

function parseApiKeys(): ApiPrincipal[] {
  return (process.env.API_KEYS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, key, roles = 'read'] = entry.split(':');
      return {
        id,
        key,
        roles: new Set(roles.split('|').map((role) => role.trim()).filter(Boolean)),
      };
    })
    .filter((principal) => principal.id && principal.key);
}

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requiredRole(method: string): 'read' | 'write' {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS' ? 'read' : 'write';
}

export const requireApiKey: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const principals = parseApiKeys();
  if (principals.length === 0) {
    res.status(503).json({ error: { code: 'AUTH_NOT_CONFIGURED', message: 'API authentication is not configured' } });
    return;
  }

  const apiKey = req.header('x-api-key') || req.header('authorization')?.replace(/^Bearer\s+/i, '');
  const principal = apiKey ? principals.find((candidate) => timingSafeEqual(candidate.key, apiKey)) : undefined;

  if (!principal) {
    res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'A valid API key is required' } });
    return;
  }

  const role = requiredRole(req.method);
  if (!principal.roles.has('admin') && !principal.roles.has(role)) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'The API key is not authorized for this action' } });
    return;
  }

  res.locals.principal = { id: principal.id, roles: [...principal.roles] };
  next();
};
