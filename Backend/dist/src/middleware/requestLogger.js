"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = requestLogger;
const logger_1 = require("../utils/logger");
function requestLogger(req, _res, next) {
    (0, logger_1.logInfo)(`${req.method} ${req.originalUrl}`);
    next();
}
