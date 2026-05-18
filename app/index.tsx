// Entry point — _layout.tsx handles the redirect to onboarding/tabs.
// We just render nothing while the gate decides.
import { View } from 'react-native';
import { colors } from '@/theme';

export default function Index() {
  return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
}
