import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import type { Database } from "./types";

let authLock = Promise.resolve();

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    lock: async (_name, _acquireTimeout, fn) => {
      const run = authLock.then(fn, fn);
      authLock = run.then(() => undefined, () => undefined);
      return run;
    },
  }
});
