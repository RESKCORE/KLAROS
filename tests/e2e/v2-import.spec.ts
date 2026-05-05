import { test } from '@playwright/test';

test.describe('V2 import workflow', () => {
  test.skip('upload CSV files and generate BI analysis end-to-end', async () => {
    // TODO: Requires Clerk auth fixture and a stable data layer test project.
  });

  test.skip('rejects import when required columns are missing', async () => {
    // TODO: Add fixture CSV with missing schema and assert validation banner.
  });
});
