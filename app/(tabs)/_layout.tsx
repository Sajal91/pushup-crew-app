import React, { useEffect, useState } from 'react';
import { View, Pressable, Text, StyleSheet, Platform, Keyboard } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Tabs } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, glows } from '@/theme';
import { useAppStore } from '@/state/useAppStore';
import { supabaseConfigured } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

type TabId = 'index' | 'log' | 'rank' | 'chat' | 'you';

const TAB_LABELS: Record<TabId, keyof typeof Ionicons.glyphMap> = {
  log: 'document-text',
  rank: 'trophy-sharp',
  index: 'home',
  chat: 'chatbox-ellipses',
  you: 'person',
};

const ORDER: TabId[] = ['log', 'rank', 'index', 'chat', 'you'];

function TabButton({
  focused,
  label,
  onPress,
}: {
  focused: boolean;
  label: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const scale = useSharedValue(focused ? 1 : 0.92);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.92, { damping: 16, stiffness: 220 });
  }, [focused, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tabPressable, pressed && { opacity: 0.85 }]}
    >
      <Animated.View style={[styles.tab, focused && styles.tabActive, animStyle]}>
        <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
          <Ionicons
            name={label}
            size={focused ? 20 : 16}
            color={focused ? colors.dark : colors.dim}
          />
        </Text>
      </Animated.View>
    </Pressable>
  );
}

function FloatingTabBar({ state, navigation }: any) {
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (keyboardVisible) return null;

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe}>
      <View style={styles.bar}>
        {state.routes
          .filter((r: any) => ORDER.includes(r.name as TabId))
          .sort((a: any, b: any) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name))
          .map((route: any) => {
            const focused =
              state.index === state.routes.findIndex((r: any) => r.name === route.name);
            const label = TAB_LABELS[route.name as TabId];
            return (
              <TabButton
                key={route.key}
                focused={focused}
                label={label}
                onPress={() => navigation.navigate(route.name)}
              />
            );
          })}
      </View>
    </SafeAreaView>
  );
}

export default function TabsLayout() {
  const syncCrewFromDb = useAppStore((s) => s.syncCrewFromDb);
  const crewSyncState = useAppStore((s) => s.crewSyncState);

  useEffect(() => {
    if (supabaseConfigured && crewSyncState === 'idle') {
      void syncCrewFromDb();
    }
  }, [crewSyncState, syncCrewFromDb]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        animation: 'fade',
        transitionSpec: {
          animation: 'timing',
          config: { duration: 280 },
        },
      }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="log" />
      <Tabs.Screen name="rank" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  safe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  bar: {
    marginHorizontal: 12,
    marginBottom: Platform.select({ ios: 6, android: 12 }),
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "#fff",
    padding: 6,
    flexDirection: 'row',
    gap: 4,
    ...glows.card,
  },
  tabPressable: {
    flex: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabActive: {
    backgroundColor: colors.acid,
  },
  tabLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.dim,
  },
  tabLabelActive: {
    color: '#000',
  },
});
