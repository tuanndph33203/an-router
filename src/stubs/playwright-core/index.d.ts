export interface Browser {
  close(): Promise<void>;
  newContext(options?: any): Promise<BrowserContext>;
  version(): string;
  isConnected(): boolean;
}
export interface BrowserContext {
  close(): Promise<void>;
  newPage(): Promise<Page>;
  pages(): Page[];
  cookies(urls?: string | string[]): Promise<any[]>;
  addCookies(cookies: any[]): Promise<void>;
  clearCookies(): Promise<void>;
  storageState(options?: any): Promise<any>;
}
export interface Page {
  close(): Promise<void>;
  goto(url: string, options?: any): Promise<any>;
  content(): Promise<string>;
  evaluate(pageFunction: any, arg?: any): Promise<any>;
  waitForSelector(selector: string, options?: any): Promise<any>;
  locator(selector: string): Locator;
  screenshot(options?: any): Promise<Buffer>;
  url(): string;
}
export interface Locator {
  click(options?: any): Promise<void>;
  fill(value: string, options?: any): Promise<void>;
  textContent(): Promise<string | null>;
  innerText(): Promise<string>;
  count(): Promise<number>;
  first(): Locator;
  isVisible(): Promise<boolean>;
}
export const chromium: {
  launch(options?: any): Promise<Browser>;
  connectOverCDP(options?: any): Promise<Browser>;
};
export const firefox: typeof chromium;
export const webkit: typeof chromium;
