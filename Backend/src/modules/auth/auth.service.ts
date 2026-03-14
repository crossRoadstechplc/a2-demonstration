import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { JWT_EXPIRES_IN, JWT_SECRET } from "../../config/constants";
import { getQuery, runQuery } from "../../database/connection";
import type { AuthUser, UserRecord, UserRole } from "./auth.types";
import { USER_ROLES } from "./auth.types";

interface JwtPayload {
  userId: number;
  role: UserRole;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  organizationId?: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

function toAuthUser(user: UserRecord): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    createdAt: user.createdAt
  };
}

export function isValidRole(role: string): role is UserRole {
  return USER_ROLES.includes(role as UserRole);
}

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  const user = await getQuery<UserRecord>("SELECT * FROM users WHERE id = ?;", [
    id
  ]);
  return user ?? null;
}

async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const user = await getQuery<UserRecord>(
    "SELECT * FROM users WHERE email = ?;",
    [email.toLowerCase()]
  );
  return user ?? null;
}

export async function registerUser(input: RegisterInput): Promise<{
  token: string;
  user: AuthUser;
}> {
  const existingUser = await findUserByEmail(input.email);
  if (existingUser) {
    throw new Error("Email is already registered");
  }

  const hashedPassword = await bcrypt.hash(input.password, 10);
  const createdAt = new Date().toISOString();
  const normalizedEmail = input.email.toLowerCase();
  const insertResult = await runQuery(
    `
    INSERT INTO users (name, email, password, role, organizationId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?);
  `,
    [
      input.name,
      normalizedEmail,
      hashedPassword,
      input.role,
      input.organizationId ?? null,
      createdAt
    ]
  );

  const user = await findUserById(insertResult.lastID);
  if (!user) {
    throw new Error("Failed to load created user");
  }

  return {
    token: signToken({ userId: user.id, role: user.role }),
    user: toAuthUser(user)
  };
}

export async function loginUser(input: LoginInput): Promise<{
  token: string;
  user: AuthUser;
}> {
  const user = await findUserByEmail(input.email);
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);
  if (!isPasswordValid) {
    throw new Error("Invalid credentials");
  }

  return {
    token: signToken({ userId: user.id, role: user.role }),
    user: toAuthUser(user)
  };
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
