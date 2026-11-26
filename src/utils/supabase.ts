import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://vwfbojaidccxugvtvtyg.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3ZmJvamFpZGNjeHVndnR2dHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTQ2OTAsImV4cCI6MjA5NjU5MDY5MH0.8YG9nCc7OzwQEcTqFMS28RSWN1YfwiNkMZP5MFcbG90';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
