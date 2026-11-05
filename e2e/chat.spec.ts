import { expect, test } from '@playwright/test';

test.describe('@ui-audit live chat projection', () => {
  test('creates a durable conversation and renders the projected fields without a fake message', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.goto('/chat');
    await expect(page.getByRole('heading', { name: 'Chat', exact: true })).toBeVisible();
    await expect(page.getByText(/Durable threads; each selected agent answer runs as a job/)).toBeVisible();

    const title = `E2E chat ${Date.now()}`;
    await page.locator('input[placeholder="New conversation"]').fill(title);
    await page.getByRole('button', { name: /New conversation/ }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(title) })).toBeVisible();
    await expect(page.getByText('No messages yet. Ask the first question below.')).toBeVisible();
    await expect(page.getByText(/No active jobs/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Send & queue job/ })).toBeDisabled();
    await expect(page.getByRole('button', { name: new RegExp(title) }).getByText('0 messages')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
