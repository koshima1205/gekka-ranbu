import { expect, test, type Locator, type Page } from '@playwright/test';

// スマホ（縦向き）で、始め方が分かることと、試合をやめて戻れることを確かめる
test.use({ viewport: { width: 393, height: 700 }, isMobile: true, hasTouch: true });

async function tap(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('画面に出ていません');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

test('phone: start button and leaving a match', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto('/');
  await expect(page.locator('.logo')).toHaveText('月下乱舞');
  await tap(page, page.getByRole('button', { name: 'たいせん' }));

  // 「いざ、勝負」はキャラを選ぶ前から出ていて、押すと何が足りないかを出す
  const start = page.locator('.start-btn');
  await expect(start).toBeVisible();
  await tap(page, start);
  await expect(page.locator('.start-hint')).toHaveText('先にキャラを選んでください');
  await tap(page, page.locator('.grid .card').first());
  await expect(page.locator('.start-btn.ready')).toBeVisible();
  await expect(page.locator('.start-hint')).toBeHidden();
  await tap(page, start);
  await tap(page, page.locator('.stage-card').first());

  // 2本指で動かしてもページが拡大されない（iOS Safari では user-scalable=no が効かないため）
  const prevented = await page.evaluate(() => {
    const t = (id: number, x: number) => new Touch({ identifier: id, target: document.body, clientX: x, clientY: 300 });
    const ev = new TouchEvent('touchmove', { touches: [t(1, 100), t(2, 200)], cancelable: true, bubbles: true });
    document.body.dispatchEvent(ev);
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(true);

  // 右上の「ポーズ」から、メニューを押してタイトルへ戻れる（スティックやボタンがメニューに重ならない）
  await tap(page, page.locator('.pause-btn'));
  const menu = page.locator('.pause .menu button');
  await expect(menu).toHaveCount(3);
  const covered = await menu.evaluateAll((btns) =>
    btns
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return [0.15, 0.5, 0.85].some((f) => {
          const el = document.elementFromPoint(r.x + r.width * f, r.y + r.height / 2);
          return !(el && (el === b || b.contains(el)));
        });
      })
      .map((b) => b.textContent),
  );
  expect(covered).toEqual([]);
  await tap(page, page.getByRole('button', { name: 'タイトルへ' }));
  await expect(page.locator('.logo')).toBeVisible();

  expect(errors).toEqual([]);
});
