import { Platform } from 'react-native';

const TAB_BAR_BOTTOM_GAP = Platform.select({ ios: 6, android: 12, default: 12 }) ?? 12;

export const SCREEN_TAB_BAR_PADDING = 140;
export const CHAT_COMPOSER_TAB_BAR_PADDING = 96;

export function getFloatingTabBarBottomPadding(bottomInset: number) {
  return bottomInset + TAB_BAR_BOTTOM_GAP;
}

export function getScreenTabBarPadding(bottomInset: number) {
  return SCREEN_TAB_BAR_PADDING + bottomInset;
}

export function getChatComposerTabBarPadding(bottomInset: number) {
  return CHAT_COMPOSER_TAB_BAR_PADDING + bottomInset;
}
