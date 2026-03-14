import { Router } from "express";

import { requireAuth } from "../../middleware/requireAuth";
import { requireRole } from "../../middleware/requireRole";
import {
  isValidRole,
  loginUser,
  registerUser
} from "./auth.service";

const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, role, organizationId } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      organizationId?: string;
    };

    if (!name || !email || !password || !role) {
      res.status(400).json({ error: "name, email, password and role are required" });
      return;
    }

    if (!isValidRole(role)) {
      res.status(400).json({ error: "Invalid role" });
      return;
    }

    const result = await registerUser({
      name,
      email,
      password,
      role,
      organizationId: organizationId ?? null
    });

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Email is already registered") {
      res.status(409).json({ error: error.message });
      return;
    }
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const result = await loginUser({ email, password });
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid credentials") {
      res.status(401).json({ error: error.message });
      return;
    }
    next(error);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});

authRouter.get("/admin-only", requireAuth, requireRole("ADMIN"), (_req, res) => {
  res.status(200).json({ status: "ok" });
});

export default authRouter;
