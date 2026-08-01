const requiredEnv = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
};

for (const [key, value] of Object.entries(requiredEnv)) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const siteUrl = (import.meta.env.VITE_SITE_URL || window.location.origin).replace(/\/$/, "");

export const env = {
  ...requiredEnv,
  siteUrl,
};
