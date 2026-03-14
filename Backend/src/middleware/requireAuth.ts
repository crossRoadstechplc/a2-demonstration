import type { NextFunction, Request, Response } from "express";

import { findUserById, verifyToken } from "../modules/auth/auth.service";

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid authorization header" });
    return;
  }

  const token = authorization.split(" ")[1];

  try {
    const payload = verifyToken(token);
    const user = await findUserById(payload.userId);

    if (!user) {
      res.status(401).json({ error: "Invalid token user" });
      return;
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
      createdAt: user.createdAt
    };

    next();
  } catch (_error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
