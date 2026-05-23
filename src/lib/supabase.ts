// Supabase client — currently a STUB.
//
// To activate:
//   1. Create a Supabase project at https://supabase.com
//   2. Copy the project URL + anon key into .env (see .env.example)
//   3. Run the SQL in supabase/migrations/0001_init.sql against the DB
//   4. The TODOs below pinpoint where to hook the real client into the app
//
// Until then this exports a typed no-op surface so the rest of the code
// compiles & runs against mock state in `useAppStore`.

import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storage: AsyncStorage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// TODO(realtime): subscribe to `pushup_logs` filtered by crew_id and hydrate
//   useAppStore.crew counters whenever a new row arrives.
//   Example:
//     supabase!.channel('crew-logs')
//       .on('postgres_changes',
//         { event: 'INSERT', schema: 'public', table: 'pushup_logs',
//           filter: `crew_id=eq.${crewId}` },
//         (payload) => useAppStore.getState().applyRemoteLog(payload.new))
//       .subscribe();

// TODO(realtime): same pattern for chat_messages -> useAppStore.chat

// Crew/profile RPCs live in src/lib/crewDb.ts (requires 0002_crew_rpcs.sql).
