import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { addNotificationResponseListener, syncDailyGoalReminder } from '@/lib/notifications';
import { supabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppStore, selectMe } from '@/state/useAppStore';

export function PushNotificationsSetup() {
  const router = useRouter();
  const { session, accountReady } = useAuth();
  const onboarded = useAppStore((s) => s.onboarded);
  const dailyGoal = useAppStore((s) => s.dailyGoal);
  const crewSyncState = useAppStore((s) => s.crewSyncState);
  const me = useAppStore(selectMe);

  useEffect(() => {
    if (!accountReady || !onboarded) return;
    if (supabaseConfigured && !session) return;
    void syncDailyGoalReminder(me, dailyGoal);
  }, [accountReady, onboarded, session, me, me?.today, me?.dailyStats, dailyGoal, crewSyncState]);

  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const type = response.notification.request.content.data?.type;
      if (type === 'daily_goal_reminder') {
        router.push('/(tabs)/log');
      }
    });
    return () => sub.remove();
  }, [router]);

  return null;
}
