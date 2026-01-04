import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dvpcjslxzsauaalgtohm.supabase.co';
// For Vercel deployment, the Supabase anon key should be configured as an environment variable.
// The previous hardcoded key was an invalid placeholder.
const supabaseKey = process.env.SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);