"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const requireAuth_1 = require("../../middleware/requireAuth");
const requireRole_1 = require("../../middleware/requireRole");
const auth_service_1 = require("./auth.service");
const authRouter = (0, express_1.Router)();
authRouter.post("/register", async (req, res, next) => {
    try {
        const { name, email, password, role, organizationId } = req.body;
        if (!name || !email || !password || !role) {
            res.status(400).json({ error: "name, email, password and role are required" });
            return;
        }
        if (!(0, auth_service_1.isValidRole)(role)) {
            res.status(400).json({ error: "Invalid role" });
            return;
        }
        const result = await (0, auth_service_1.registerUser)({
            name,
            email,
            password,
            role,
            organizationId: organizationId ?? null
        });
        res.status(201).json(result);
    }
    catch (error) {
        if (error instanceof Error && error.message === "Email is already registered") {
            res.status(409).json({ error: error.message });
            return;
        }
        next(error);
    }
});
authRouter.post("/login", async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: "email and password are required" });
            return;
        }
        const result = await (0, auth_service_1.loginUser)({ email, password });
        res.status(200).json(result);
    }
    catch (error) {
        if (error instanceof Error && error.message === "Invalid credentials") {
            res.status(401).json({ error: error.message });
            return;
        }
        next(error);
    }
});
authRouter.get("/me", requireAuth_1.requireAuth, (req, res) => {
    res.status(200).json({ user: req.user });
});
authRouter.get("/admin-only", requireAuth_1.requireAuth, (0, requireRole_1.requireRole)("ADMIN"), (_req, res) => {
    res.status(200).json({ status: "ok" });
});
exports.default = authRouter;
