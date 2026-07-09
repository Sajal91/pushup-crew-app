import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { addNotificationResponseListener, syncDailyGoalReminder } from '@/lib/notifications';
import { syncCrewScheduledNotifications } from '@/lib/crewNotifications';
import { syncPushToken, attachPushTokenListener, attachPushTokenAppStateListener } from '@/lib/pushToken';
import { supabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { useAppStore, selectMe } from '@/state/useAppStore';

const CREW_ALERT_TYPES = new Set([
  'domino_effect',
  'leaderboard_threat',
  'lone_wolf',
  'flame_extinguisher',
  'free_pass',
  'morning_ledger',
  'milestone_feast',
]);

export function PushNotificationsSetup() {
  const router = useRouter();
  const { session, accountReady } = useAuth();
  const onboarded = useAppStore((s) => s.onboarded);
  const dailyGoal = useAppStore((s) => s.dailyGoal);
  const crewSyncState = useAppStore((s) => s.crewSyncState);
  const crew = useAppStore((s) => s.crew);
  const skipPotCents = useAppStore((s) => s.crewMeta.skipPotCents);
  const me = useAppStore(selectMe);

  useEffect(() => {
    if (!accountReady) return;
    if (supabaseConfigured && !session) return;

    if (supabaseConfigured) {
      void syncPushToken(true);
      const removeTokenListener = attachPushTokenListener();
      const removeAppStateListener = attachPushTokenAppStateListener();
      return () => {
        removeTokenListener();
        removeAppStateListener();
      };
    }

    if (!onboarded) return;

    void syncDailyGoalReminder(me, dailyGoal);
    void syncCrewScheduledNotifications({
      me,
      crew,
      dailyGoal,
      skipPotCents,
    });
  }, [
    accountReady,
    onboarded,
    session,
    me,
    me?.today,
    me?.dailyStats,
    me?.streak,
    dailyGoal,
    crewSyncState,
    crew,
    skipPotCents,
  ]);

  useEffect(() => {
    const sub = addNotificationResponseListener((response) => {
      const type = String(response.notification.request.content.data?.type);
      if (type === 'chat_message') {
        router.push('/(tabs)/chat');
      } else if (type === 'daily_goal_reminder' || CREW_ALERT_TYPES.has(type)) {
        router.push('/(tabs)/log');
      }
    });
    return () => sub.remove();
  }, [router]);

  return null;
}
