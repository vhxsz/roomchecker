import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',
 fullyParallel:false,
 workers:1,
 use:{baseURL:'http://localhost:3100',channel:'chrome',headless:true},
 webServer:{
  command:'npm run dev -- --port 3100',url:'http://localhost:3100',reuseExistingServer:false,
  env:{NEXT_PUBLIC_SUPABASE_URL:'https://roomchecker-test.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'test-only-publishable-key'},
 },
});
