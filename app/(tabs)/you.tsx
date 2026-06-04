import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, fonts, glows, spacing } from '@/theme';
import { ScreenContainer } from '@/components/ScreenContainer';
import { Panel } from '@/components/Panel';
import { Kicker } from '@/components/Kicker';
import { ProgressBar } from '@/components/ProgressBar';
import { SectionTitle } from '@/components/SectionTitle';
import { AcidButton } from '@/components/AcidButton';
import { useAppStore, selectMe, getCrewInviteCode } from '@/state/useAppStore';
import { useAuth } from '@/providers/AuthProvider';
import { supabaseConfigured } from '@/lib/supabase';
import { leaveMyCrew } from '@/lib/crewDb';
import {
  xpInLevel,
  levelFromXp,
  levelProgress,
  xpNeededForNextLevel,
} from '@/lib/mechanics';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

type Badge = {
  id: string;
  label: string;
  caption: string;
  unlocked: boolean;
};

export default function YouScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const me = useAppStore(selectMe);
  const inviteCode = useAppStore(getCrewInviteCode);
  const crewMeta = useAppStore((s) => s.crewMeta);
  const clearCrew = useAppStore((s) => s.clearCrew);
  const [signingOut, setSigningOut] = useState(false);
  const [leavingCrew, setLeavingCrew] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const hasCrew = Boolean(crewMeta.id);

  if (!me) return null;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/(onboarding)/welcome');
    } finally {
      setSigningOut(false);
    }
  };

  const lvl = levelFromXp(me.xp);
  const inLevel = xpInLevel(me.xp);
  const nextLevelXp = xpNeededForNextLevel(lvl);
  const progress = levelProgress(me.xp);

  const badges: Badge[] = [
    { id: '7d', label: '7-DAY', caption: 'STREAK', unlocked: me.streak >= 7 },
    { id: '14d', label: '14-DAY', caption: 'STREAK', unlocked: me.streak >= 14 },
    { id: '500', label: '500', caption: 'LIFETIME', unlocked: me.total >= 500 },
    { id: '5k', label: '5K', caption: 'LIFETIME', unlocked: me.total >= 5000 },
    { id: '10k', label: '10K', caption: 'LIFETIME', unlocked: me.total >= 10000 },
    { id: 'top', label: 'TOPDOG', caption: 'WEEK 1ST', unlocked: false },
  ];

  const handleCopyInvite = async () => {
    setIsCopying(true);
    await Clipboard.setStringAsync(inviteCode);
    alert('Copied!');
    setTimeout(() => {
      setIsCopying(false);
    }, 2000);
  };

  const handleLeaveCrew = () => {
    if (!supabaseConfigured || !hasCrew || leavingCrew) return;

    Alert.alert(
      'Leave crew?',
      'You will leave your current crew. Your level, XP, streak, and lifetime achievements stay with you. Crew rankings, chat, and weekly progress reset until you join a new crew.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setLeavingCrew(true);
              try {
                const personalStats = await leaveMyCrew();
                clearCrew(personalStats);
                router.replace('/(onboarding)/crew');
              } catch (err) {
                Alert.alert(
                  'Could not leave crew',
                  err instanceof Error ? err.message : 'Something went wrong.',
                );
              } finally {
                setLeavingCrew(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer fadeOnFocus>
      <Panel pad="lg" style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.heroAvatar}>
            {me.image ? (
              <Image source={{ uri: me.image }} style={styles.heroAvatarImage} />
            ) : (
              <Ionicons name="person" size={32} color={colors.text} />
            )}
          </View>

          <Text style={styles.profileName}>
            {me.name}
          </Text>

          <Text style={styles.profileLevel}>
            Level {lvl}
          </Text>
        </View>

        <View style={styles.inviteRow}>
          <Text style={styles.inviteLabel}>
            Invite Code
          </Text>

          <TouchableOpacity
            style={styles.inviteChip}
            onPress={handleCopyInvite}
          >
            <Text style={styles.inviteCode}>
              {inviteCode}
            </Text>

            <Ionicons
              name="copy-outline"
              size={16}
              color={colors.acid}
            />
          </TouchableOpacity>
        </View>

        <ProgressBar
          progress={progress}
          height={8}
          glow
        />

        <Text style={styles.xpText}>
          {inLevel} / {nextLevelXp} XP
        </Text>
      </Panel>

      <View style={[styles.grid, { paddingHorizontal: spacing.screen, marginTop: 12 }]}>
        <Stat label="STREAK" value={`${me.streak}D`} />
        <Stat label="TODAY" value={String(me.today)} />
        <Stat label="WEEK" value={String(me.week)} />
        <Stat label="TOTAL" value={String(me.total)} />
      </View>

      <View style={{ paddingHorizontal: spacing.screen, marginTop: 12 }}>
        <Text style={styles.sectionH}>BADGES</Text>
        <View style={styles.badgeGrid}>
          {badges.map((b) => (
            <View key={b.id} style={styles.badgeCol}>
              <Panel
                variant={b.unlocked ? 'acid' : 'default'}
                pad="sm"
                style={[styles.badge, !b.unlocked && { opacity: 0.45 }]}
              >
                <Text
                  style={[
                    styles.badgeLabel,
                    b.unlocked && { color: colors.acid, ...glows.acidText },
                  ]}
                >
                  {b.label}
                </Text>
                <Text style={styles.badgeCaption}>{b.caption}</Text>
              </Panel>
            </View>
          ))}
        </View>
      </View>

      {hasCrew && supabaseConfigured ? (
        <Panel pad="lg" style={styles.crewCard}>
          <View style={styles.crewHeader}>
            <Ionicons
              name="people-outline"
              size={22}
              color={colors.acid}
            />

            <Text style={styles.crewTitle}>
              Crew
            </Text>
          </View>

          <Text style={styles.crewName}>
            {crewMeta.name}
          </Text>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => router.push('/manage-crew')}
          >
            <Text style={styles.menuLabel}>
              Manage Crew
            </Text>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.dim}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleCopyInvite}
          >
            <Text style={styles.menuLabel}>
              Invite Members
            </Text>

            <Ionicons
              name="copy-outline"
              size={18}
              color={colors.dim}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={handleLeaveCrew}
          >
            <Text style={styles.leaveLabel}>
              Leave Crew
            </Text>

            <Ionicons
              name="exit-outline"
              size={18}
              color="#ff6b6b"
            />
          </TouchableOpacity>
        </Panel>
      ) : null}

      <View style={styles.signOutWrap}>
        <AcidButton
          label={signingOut ? 'SIGNING OUT…' : 'SIGN OUT'}
          variant="danger"
          disabled={signingOut}
          onPress={handleSignOut}
        />
      </View>

      <Text style={styles.signOff}>NO DAYS OFF.</Text>
    </ScreenContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCol}>
      <Panel pad="md">
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </Panel>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  levelCenter: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  levelNum: {
    fontFamily: fonts.display,
    fontSize: 96,
    color: colors.acid,
    ...glows.acidText,
    letterSpacing: -1,
  },
  levelNext: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.dim,
    letterSpacing: 1.5,
    marginTop: -4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCol: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.dim,
  },
  statValue: {
    marginTop: 6,
    fontFamily: fonts.display,
    fontSize: 36,
    color: colors.text,
  },
  sectionH: {
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.text,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  badgeCol: {
    flexBasis: '31%',
    flexGrow: 1,
  },
  badge: {
    alignItems: 'center',
  },
  badgeLabel: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.dim,
  },
  badgeCaption: {
    marginTop: 2,
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.dim,
  },
  crewActions: {
    marginTop: 24,
    paddingHorizontal: spacing.screen,
    gap: 10,
  },
  signOutWrap: {
    marginTop: 28,
    paddingHorizontal: spacing.screen,
  },
  signOff: {
    marginTop: 24,
    textAlign: 'center',
    fontFamily: fonts.display,
    fontSize: 24,
    color: colors.dim,
    letterSpacing: 2,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 38,
    paddingTop: 4,
    letterSpacing: 0.5,
    color: colors.text,
    textTransform: 'uppercase',
  },
  avatarWrap: {
    overflow: 'hidden',
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileCard: {
    borderRadius: 28,
    marginHorizontal: spacing.screen,
    marginTop: 12,
  },

  heroAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },

  profileName: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: 12,
  },

  profileLevel: {
    fontSize: 14,
    color: colors.acid,
    textAlign: 'center',
    marginTop: 4,
  },

  inviteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.panel,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },

  statCard: {
    flex: 1,
    minHeight: 110,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteRow: {
    marginTop: 20,
    alignItems: 'center',
  },

  inviteLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.dim,
    letterSpacing: 1,
    marginBottom: 8,
  },

  inviteCode: {
    color: colors.acid,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },

  xpText: {
    marginTop: 10,
    textAlign: 'center',
    color: colors.dim,
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 1,
  },

  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },

  heroAvatarImage: {
    width: '100%',
    height: '100%',
  },

  crewCard: {
    marginTop: 24,
    borderRadius: 24,
  },

  crewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },

  crewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },

  crewName: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },

  menuRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },

  menuLabel: {
    fontSize: 16,
    color: colors.text,
  },

  leaveLabel: {
    fontSize: 16,
    color: '#ff6b6b',
  },
});
