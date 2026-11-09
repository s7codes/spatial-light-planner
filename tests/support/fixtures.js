import { test as base, expect as baseExpect } from '@playwright/test';

export const expect = baseExpect.extend({
  toBeNearColor(received, expected, tolerance = 3) {
    const pass = expected.every((value, index) => Math.abs(received[index] - value) <= tolerance);
    return {
      pass,
      name: 'toBeNearColor',
      expected,
      actual: received,
      message: () =>
        `expected rgb(${received.join(', ')}) ${pass ? 'not ' : ''}to be within ${tolerance} of rgb(${expected.join(', ')})`,
    };
  },
});

// Every test starts on a freshly loaded planner and fails on any uncaught exception or console error.
// The Lumen splash is skipped on every load in the context (reloads and extra tabs too) unless a spec
// opts in with test.use({ splash: true }).
export const test = base.extend({
  splash: [false, { option: true }],
  page: async ({ page, splash }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    if (!splash) {
      await page.context().addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
          const screen = document.getElementById('splash-screen');
          if (screen) screen.hidden = true;
        });
      });
    }

    await page.goto('/');
    await use(page);

    expect(errors, 'the page logged errors').toEqual([]);
  },
});
