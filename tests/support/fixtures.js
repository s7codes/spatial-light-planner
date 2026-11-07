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

// Every test starts on a freshly loaded planner and fails on any uncaught exception or console error
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('/');
    await use(page);

    expect(errors, 'the page logged errors').toEqual([]);
  },
});
