import app from "./app";
import { initializeDatabase } from "./database/connection";
import { logError, logInfo } from "./utils/logger";

const PORT = 3059;
let httpServer: ReturnType<typeof app.listen> | null = null;
declare global {
  // Keeps a strong reference in Node 22/ts-node environments where unreferenced servers can be reclaimed.
  // eslint-disable-next-line no-var
  var __A2_HTTP_SERVER__: ReturnType<typeof app.listen> | undefined;
}

async function startServer(): Promise<void> {
  try {
    await initializeDatabase();
    httpServer = app.listen(PORT, () => {
      logInfo(`A2 Corridor Backend listening on port ${PORT}`);
    });
    globalThis.__A2_HTTP_SERVER__ = httpServer;
  } catch (error) {
    logError(
      error instanceof Error ? error.message : "Failed to start the server"
    );
    process.exit(1);
  }
}

function shutdown(signal: string): void {
  if (!httpServer) {
    process.exit(0);
    return;
  }
  logInfo(`Received ${signal}, shutting down server...`);
  httpServer.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

void startServer();
