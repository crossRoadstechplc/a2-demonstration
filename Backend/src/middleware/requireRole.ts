import type { NextFunction, Request, Response } from "express";

import type { UserRole } from "../modules/auth/auth.types";

export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (req.user.role !== role) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}
