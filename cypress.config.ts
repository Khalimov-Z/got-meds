import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL ?? "http://localhost:3000",
    specPattern: "cypress/e2e/**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    env: {
      adminEmail: process.env.GOTMEDS_E2E_ADMIN_EMAIL,
      adminPassword: process.env.GOTMEDS_E2E_ADMIN_PASSWORD,
    },
  },
});
