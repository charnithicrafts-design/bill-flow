import { test, expect, _electron as electron } from '@playwright/test';
import path from 'path';

test.describe('Bill Flow Electron E2E', () => {
  let electronApp;

  test.beforeAll(async () => {
    // Launch the compiled app (or main.js) via Playwright Electron
    electronApp = await electron.launch({ 
        args: [path.join(__dirname, '..', 'main.js')]
    });
  });

  test.afterAll(async () => {
    if (electronApp) {
      await electronApp.close();
    }
  });

  test('App boots and renders the Onboarding Wizard', async () => {
    // Get the first window that the app opens
    const window = await electronApp.firstWindow();
    
    // Wait for the window to load
    await window.waitForLoadState('domcontentloaded');

    // Verify title
    const title = await window.title();
    expect(title).toBe('Bill Flow by CN-SC');

    // The OnboardingWizard should be rendered because ACTIVE_DOMAIN is not set in a fresh test DB
    // Look for the onboarding text (Wait for React to mount)
    await expect(window.locator('text=Welcome to Bill Flow')).toBeVisible({ timeout: 15000 });
    
    // Check if the domain selection cards are rendered
    await expect(window.locator('text=Textile & Garments')).toBeVisible();
    await expect(window.locator('text=General Retail')).toBeVisible();
    await expect(window.locator('text=Agri / Mandi')).toBeVisible();
  });
});
