/**
 * Quick fix script to link freight customers (organizationId = userId)
 * Run with: npx ts-node fix-freight-customers.ts
 */

import { fixFreightCustomerLinks } from "./src/database/seed";

fixFreightCustomerLinks()
  .then(() => {
    console.log("Fix completed successfully.");
    process.exit(0);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Fix failed";
    console.error(message);
    process.exit(1);
  });
