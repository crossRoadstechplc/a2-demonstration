"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidRole = isValidRole;
exports.findUserById = findUserById;
exports.registerUser = registerUser;
exports.loginUser = loginUser;
exports.verifyToken = verifyToken;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const constants_1 = require("../../config/constants");
const connection_1 = require("../../database/connection");
const auth_types_1 = require("./auth.types");
function toAuthUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        createdAt: user.createdAt
    };
}
function isValidRole(role) {
    return auth_types_1.USER_ROLES.includes(role);
}
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, constants_1.JWT_SECRET, { expiresIn: constants_1.JWT_EXPIRES_IN });
}
async function findUserById(id) {
    const user = await (0, connection_1.getQuery)("SELECT * FROM users WHERE id = ?;", [
        id
    ]);
    return user ?? null;
}
async function findUserByEmail(email) {
    const user = await (0, connection_1.getQuery)("SELECT * FROM users WHERE email = ?;", [email.toLowerCase()]);
    return user ?? null;
}
async function registerUser(input) {
    const existingUser = await findUserByEmail(input.email);
    if (existingUser) {
        throw new Error("Email is already registered");
    }
    const hashedPassword = await bcrypt_1.default.hash(input.password, 10);
    const createdAt = new Date().toISOString();
    const normalizedEmail = input.email.toLowerCase();
    const insertResult = await (0, connection_1.runQuery)(`
    INSERT INTO users (name, email, password, role, organizationId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?);
  `, [
        input.name,
        normalizedEmail,
        hashedPassword,
        input.role,
        input.organizationId ?? null,
        createdAt
    ]);
    const user = await findUserById(insertResult.lastID);
    if (!user) {
        throw new Error("Failed to load created user");
    }
    return {
        token: signToken({ userId: user.id, role: user.role }),
        user: toAuthUser(user)
    };
}
async function loginUser(input) {
    const user = await findUserByEmail(input.email);
    if (!user) {
        throw new Error("Invalid credentials");
    }
    const isPasswordValid = await bcrypt_1.default.compare(input.password, user.password);
    if (!isPasswordValid) {
        throw new Error("Invalid credentials");
    }
    return {
        token: signToken({ userId: user.id, role: user.role }),
        user: toAuthUser(user)
    };
}
function verifyToken(token) {
    return jsonwebtoken_1.default.verify(token, constants_1.JWT_SECRET);
}
