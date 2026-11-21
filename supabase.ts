import { createClient } from '@supabase/supabase-js';

// Public project URL. Safe to include in server bundles.
export const SUPABASE_URL = 'https://cnzxokemqdqkprkexiet.supabase.co';

// Server-side only. Never import this module from src/ or any browser bundle.
export const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuenhva2VtcWRxa3Bya2V4aWV0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NTI3NDQ4NywiZXhwIjoyMTEwODUwNDg3fQ.VseXwLzXhM82fASCs4KvqLGubOvdiJ2-E2FSD4esXcY';

export const SUPABASE_BUCKET = 'uploads';
export const SUPABASE_PUBLIC_FILE_BASE = `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}`;

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
