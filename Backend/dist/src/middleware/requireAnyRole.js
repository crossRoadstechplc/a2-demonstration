"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAnyRole = requireAnyRole;
function requireAnyRole(roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        if (!roles.includes(req.user.role)) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        next();
    };
}
