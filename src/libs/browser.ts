import { browser, Page } from 'k6/experimental/browser';

export interface PageMeasureOptions {
  waitForSelector?: string;
  screenshotOnErrorPath?: string;
  afterLoad?: (page: Page) => Promise<void>;
}

export const openAndMeasure = async (
  url: string,
  options: PageMeasureOptions = {}
): Promise<void> => {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'networkidle' });

    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector);
    }

    if (options.afterLoad) {
      await options.afterLoad(page);
    }
  } catch (err) {
    if (options.screenshotOnErrorPath) {
      await page.screenshot({ path: options.screenshotOnErrorPath });
    }
    throw err;
  } finally {
    await page.close();
  }
};
