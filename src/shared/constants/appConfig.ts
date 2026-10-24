import pkg from "../../../package.json" with { type: "json" };

export const APP_CONFIG = {
  name: "An Gateway",
  description: "Hệ thống AI Gateway đa mô hình",
  version: pkg.version,
};

export const THEME_CONFIG = {
  storageKey: "theme",
  defaultTheme: "system",
};
