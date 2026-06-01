import { devices } from "@playwright/test";

export type PlaywrightDevice = typeof devices["Pixel 5"];

export function projectBrowserDevice(device: PlaywrightDevice) {
  const { defaultBrowserType: _defaultBrowserType, ...use } = device;
  return use;
}
