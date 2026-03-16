/**
 * Quick fix script to link fleet owners to fleets
 * Run with: npx ts-node fix-fleet-owners.ts
 */

import { fixFleetOwnerLinks } from "./src/database/seed";

fixFleetOwnerLinks()
  .then(() => {
    console.log("Fix completed successfully.");
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Fix failed";
    console.error(message);
    process.exit(1);
  });
