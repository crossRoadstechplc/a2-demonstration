import type { AuthUser } from "../../modules/auth/auth.types";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export {};
