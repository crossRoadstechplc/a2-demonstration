"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
function requireRole(role) {
    return (req, res, next) => {
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
