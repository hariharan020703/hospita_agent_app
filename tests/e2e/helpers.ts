import { expect, type ConsoleMessage, type Page } from '@playwright/test';

/** Fails the test on any console error or warning (the brief requires a clean console). */
export function failOnConsoleProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error' || msg.type() === 'warning') problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  return problems;
}

/** Patient sign-in through the real UI: language choice, phone, one-time code. */
export async function signInPatient(page: Page, phone = '9876543210', language: 'English' | 'தமிழ்' = 'English') {
  await page.goto('/app');
  await page.getByRole('button', { name: new RegExp(language) }).click();
  await page.getByLabel(/Mobile number|மொபைல் எண்/).fill(phone);
  await page.getByRole('button', { name: /Send code|குறியீட்டை அனுப்பு/ }).click();
  await page.getByLabel(/6-digit code|6 இலக்கக் குறியீடு/).fill('123456');
  await page.getByRole('button', { name: /Verify and continue|சரிபார்த்துத் தொடர்க/ }).click();
  await expect(page).toHaveURL(/\/app\/?$/);
}

/** Staff sign-in by picking a demo account on /login. */
export async function signInStaff(page: Page, name: RegExp) {
  await page.goto('/login');
  await page.getByRole('button', { name }).click();
}
