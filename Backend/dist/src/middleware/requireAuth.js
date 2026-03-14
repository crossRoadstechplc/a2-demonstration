"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const auth_service_1 = require("../modules/auth/auth.service");
async function requireAuth(req, res, next) {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing or invalid authorization header" });
        return;
    }
    const token = authorization.split(" ")[1];
    try {
        const payload = (0, auth_service_1.verifyToken)(token);
        const user = await (0, auth_service_1.findUserById)(payload.userId);
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
    }
    catch (_error) {
        res.status(401).json({ error: "Invalid or expired token" });
    }
}
