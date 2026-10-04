// أتمتة المتصفح لإزالة متابع عبر قائمة ⋯ الأصلية في X ("Remove this follower")
export class AttentionError extends Error {}

const byText = (page, re) => page.getByRole("menuitem", { name: re });

export async function removeFollower(page, userName, { dryRun }) {
  await page.goto(`https://x.com/${userName}`, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(2500 + Math.random() * 2000);

  const url = page.url();
  if (/\/(login|i\/flow)/.test(url)) throw new AttentionError("X طلب تسجيل دخول/تحقق (انتهت الجلسة أو تحدٍّ أمني)");
  const body = (await page.locator("body").innerText().catch(() => "")).toLowerCase();
  if (/account suspended|this account doesn.t exist|account doesn.t exist/.test(body)) return "missing";
  if (/unusual activity|verify you.re human|confirm your identity|temporarily restricted/.test(body)) throw new AttentionError("X أظهر تحذير نشاط غير معتاد/تقييد");

  const menu = page.locator('[data-testid="userActions"]').first();
  try { await menu.waitFor({ state: "visible", timeout: 20000 }); }
  catch { throw new Error("لم تظهر قائمة الإجراءات (userActions)"); }
  await menu.click();

  const item = byText(page, /remove this follower/i);
  try { await item.waitFor({ state: "visible", timeout: 6000 }); }
  catch { await page.keyboard.press("Escape"); return "not_follower"; } // الخيار يظهر فقط لمن يتابعك فعلاً

  if (dryRun) { await page.keyboard.press("Escape"); return "dry_run"; }

  await item.click();
  const confirm = page.locator('[data-testid="confirmationSheetConfirm"]');
  await confirm.waitFor({ state: "visible", timeout: 8000 });
  await confirm.click();
  await confirm.waitFor({ state: "hidden", timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return "removed";
}
