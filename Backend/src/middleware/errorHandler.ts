import type { NextFunction, Request, Response } from "express";

import { logError } from "../utils/logger";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const message = err instanceof Error ? err.message : "Internal server error";
  logError(message);
  res.status(500).json({ error: message });
}
