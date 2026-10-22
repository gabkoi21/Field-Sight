// Local preview is opt-in. Normal development uses the real login screen.
export const skipLogin = import.meta.env.DEV && import.meta.env.VITE_SKIP_LOGIN === "true";
