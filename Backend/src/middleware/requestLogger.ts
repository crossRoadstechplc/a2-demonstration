import type { NextFunction, Request, Response } from "express";

import { logInfo } from "../utils/logger";

export function requestLogger(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  logInfo(`${req.method} ${req.originalUrl}`);
  next();
}
