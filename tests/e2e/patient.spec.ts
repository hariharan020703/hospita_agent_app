import { expect, test } from '@playwright/test';
import { failOnConsoleProblems, signInPatient } from './helpers';

test.describe('patient app', () => {
  test('books an appointment end to end: symptoms, department, doctor, slot, confirmation', async ({ page }) => {
    const problems = failOnConsoleProblems(page);
    await signInPatient(page);
    await expect(page.getByRole('heading', { name: 'Hello, Kamala' })).toBeVisible();

    await page.getByRole('link', { name: /Describe your symptoms/ }).click();
    await expect(page.getByText('It does not give medical diagnosis.')).toBeVisible();
    await page.getByLabel('Type your message').fill('My knee hurts when I climb stairs');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'About a week' }).click();
    await page.getByRole('button', { name: 'Moderate (5)' }).click();
    await expect(page.getByRole('log')).toContainText('How old is the patient?');
    await page.getByLabel('Type your message').fill('52');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'None' }).click();
    await expect(page.getByRole('log')).toContainText('One safety question');
    await page.getByRole('button', { name: 'No', exact: true }).click();

    const recommendation = page.getByRole('region', { name: 'Orthopaedics' });
    await expect(recommendation).toBeVisible();
    await expect(recommendation).toContainText('It is not a diagnosis');
    await recommendation.getByRole('button', { name: 'See doctors in Orthopaedics' }).click();

    await expect(page.getByRole('heading', { name: 'Find a doctor' })).toBeVisible();
    await page.getByRole('link', { name: /Dr\. Karthikeyan V/ }).click();
    await expect(page.getByRole('heading', { name: 'Dr. Karthikeyan V' })).toBeVisible();
    await page.getByRole('radio', { name: /Available/ }).first().click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page.getByRole('heading', { name: 'Confirm appointment' })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm booking' }).click();
    await expect(page.getByText("You're booked!")).toBeVisible();
    const token = await page.getByText(/^ORT-\d{3}$/).first().textContent();
    expect(token).toMatch(/^ORT-\d{3}$/);
    await expect(page.getByRole('img', { name: /Check-in code MF/ })).toBeVisible();

    await page.getByRole('link', { name: 'Appointments' }).first().click();
    await expect(page.getByRole('tabpanel')).toContainText(token ?? 'missing');
    expect(problems).toEqual([]);
  });

  test('red-flag symptoms show the emergency screen and never offer booking', async ({ page }) => {
    const problems = failOnConsoleProblems(page);
    await signInPatient(page);
    await page.goto('/app/assistant');
    await page.getByLabel('Type your message').fill('I have chest pain and I am sweating a lot');
    await page.keyboard.press('Enter');
    const alert = page.getByRole('alertdialog', { name: 'This needs urgent care' });
    await expect(alert).toBeVisible();
    await expect(alert.getByRole('link', { name: /Call 108 ambulance/ })).toHaveAttribute('href', 'tel:108');
    await expect(alert.getByRole('link', { name: /Call hospital Emergency/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /See doctors/ })).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('works in Tamil: live queue for today’s appointment', async ({ page }) => {
    const problems = failOnConsoleProblems(page);
    await signInPatient(page, '9876543210', 'தமிழ்');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ta');
    await expect(page.getByRole('heading', { name: 'வணக்கம், Kamala' })).toBeVisible();
    await page.getByRole('link', { name: 'நேரலை வரிசையைப் பார்க்கவும்', exact: true }).click();
    await expect(page.getByText('CAR-015').first()).toBeVisible();
    await expect(page.getByText('வீட்டிலிருந்து கிளம்ப வேண்டிய நேரம்')).toBeVisible();
    expect(problems).toEqual([]);
  });
});
