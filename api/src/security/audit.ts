import type { RequestHandler } from 'express';

export const auditPrivilegedOperation: RequestHandler = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    console.info(JSON.stringify({
      event: 'api.privileged_operation',
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      timestamp: new Date().toISOString(),
    }));
  }

  next();
};
