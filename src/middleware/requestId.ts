/**
 * RequestId Middleware
 *
 * Responsabilidades:
 * - Gerar/extrair X-Request-ID de header
 * - Propagar requestId para logger
 * - Incluir em response headers para tracing
 */

import { v4 as uuidv4 } from 'uuid';

export function requestIdMiddleware(req: any, res: any, next: any): void {
  // Extrair requestId do header ou gerar novo
  req.id = req.headers['x-request-id'] || uuidv4();

  // Incluir no response header
  res.setHeader('X-Request-ID', req.id);

  next();
}

export default requestIdMiddleware;
