import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { CLAIMS, Claim, pickRandomClaimIndex } from '@/lib/claims';
import { spacing } from '@/theme';
import { ClaimHeadline } from './ClaimHeadline';

const AUTO_SCROLL_MS = 4500;
const CLAIM_COUNT = CLAIMS.length;

type LoopItem = {
  claim: Claim;
  key: string;
};

type Props = {
  initialIndex?: number;
  autoScroll?: boolean;
  autoScrollIntervalMs?: number;
  onActiveIndexChange?: (index: number) => void;
};

function buildLoopData(): LoopItem[] {
  return [
    ...CLAIMS.map((claim) => ({ claim, key: claim.id })),
    { claim: CLAIMS[0], key: `${CLAIMS[0].id}-loop` },
  ];
}

export function ClaimPager({
  initialIndex,
  autoScroll = false,
  autoScrollIntervalMs = AUTO_SCROLL_MS,
  onActiveIndexChange,
}: Props) {
  const { width } = useWindowDimensions();
  const pageWidth = width - spacing.screen * 2;
  const loopData = useMemo(() => buildLoopData(), []);
  const listRef = useRef<FlatList<LoopItem>>(null);

  const startIndex = initialIndex ?? pickRandomClaimIndex();
  const scrollIndexRef = useRef(startIndex);
  const activeIndexRef = useRef(startIndex);
  const transitioningRef = useRef(false);

  const setLogicalIndex = useCallback(
    (logical: number) => {
      const clamped = ((logical % CLAIM_COUNT) + CLAIM_COUNT) % CLAIM_COUNT;
      activeIndexRef.current = clamped;
      onActiveIndexChange?.(clamped);
    },
    [onActiveIndexChange],
  );

  const snapToStart = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      scrollIndexRef.current = 0;
      transitioningRef.current = false;
    });
  }, []);

  const advance = useCallback(
    (animated = true) => {
      const logical = activeIndexRef.current;

      if (logical === CLAIM_COUNT - 1) {
        transitioningRef.current = true;
        listRef.current?.scrollToIndex({ index: CLAIM_COUNT, animated });
        scrollIndexRef.current = CLAIM_COUNT;
        setLogicalIndex(0);
        return;
      }

      const next = logical + 1;
      listRef.current?.scrollToIndex({ index: next, animated });
      scrollIndexRef.current = next;
      setLogicalIndex(next);
    },
    [setLogicalIndex],
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const physical = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
      scrollIndexRef.current = physical;

      if (physical >= CLAIM_COUNT) {
        snapToStart();
        setLogicalIndex(0);
        return;
      }

      transitioningRef.current = false;
      setLogicalIndex(physical);
    },
    [pageWidth, setLogicalIndex, snapToStart],
  );

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({
        offset: info.index * info.averageItemLength,
        animated: false,
      });
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index: info.index, animated: false });
      });
    },
    [],
  );

  useEffect(() => {
    if (!autoScroll) return;

    const id = setInterval(() => {
      if (transitioningRef.current) return;
      advance();
    }, autoScrollIntervalMs);

    return () => clearInterval(id);
  }, [advance, autoScroll, autoScrollIntervalMs]);

  const renderItem = useCallback(
    ({ item }: { item: LoopItem }) => (
      <View style={{ width: pageWidth }}>
        <ClaimHeadline claim={item.claim} />
      </View>
    ),
    [pageWidth],
  );

  return (
    <FlatList
      ref={listRef}
      data={loopData}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      horizontal
      pagingEnabled
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={pageWidth}
      disableIntervalMomentum
      initialScrollIndex={startIndex}
      initialNumToRender={loopData.length}
      getItemLayout={(_, index) => ({
        length: pageWidth,
        offset: pageWidth * index,
        index,
      })}
      onMomentumScrollEnd={handleScrollEnd}
      onScrollToIndexFailed={onScrollToIndexFailed}
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 0,
  },
});
