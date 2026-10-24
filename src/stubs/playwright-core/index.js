export const chromium = {
  launch: async () => {
    throw new Error("Browser features are disabled in this slim build");
  },
  connectOverCDP: async () => {
    throw new Error("Browser features are disabled in this slim build");
  },
};
export const firefox = chromium;
export const webkit = chromium;
