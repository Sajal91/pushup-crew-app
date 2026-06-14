import React from 'react';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { colors, fonts } from '@/theme';

type Point = { d: string; v: number | null };

type Props = {
  data: Point[];
  color?: string;
  width?: number;
  height?: number;
  gap?: number;
};

/** 7-bar sparkline used in the Leaderboard cards. Null values render dashed. */
export function Sparkline({
  data,
  color = colors.acid,
  width = 220,
  height = 60,
  gap = 10,
}: Props) {
  if (data.length === 0) return null;

  const barW = ((width - gap * (data.length - 1)) / data.length) * 1;
  const max = Math.max(...data.map((p) => p.v ?? 0), 1);

  return (
    <Svg width={width} height={height}>
      {data.map((p, i) => {
        const x = i * (barW + gap);
        const isPending = p.v == null;
        const topPadding = 16;   // space for value labels
        const bottomPadding = 14; // space for dates
        const chartHeight = height - topPadding - bottomPadding;
        const bh = isPending ? 4 : ((p.v as number) / max) * chartHeight;
        const fy = height - bottomPadding - bh;

        return (
          <G key={i}>
            <SvgText
              x={x + barW / 2}
              y={fy - 4}
              textAnchor="middle"
              fontSize="9"
              fontFamily={fonts.mono}
              fill={color}
            >
              {p.v}
            </SvgText>
            <Rect
              x={x}
              y={fy}
              width={barW}
              height={Math.max(bh, 2)}
              rx={2}
              fill={isPending ? 'transparent' : color}
              stroke={isPending ? color : 'none'}
              strokeDasharray={isPending ? '3 3' : undefined}
              opacity={isPending ? 0.55 : 1}
            />
            <SvgText
              x={x + barW / 2}
              y={height - 2}
              textAnchor="middle"
              fontSize="9"
              fontFamily={fonts.mono}
              fill={color}
              opacity={0.7}
            >
              {p.d}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
