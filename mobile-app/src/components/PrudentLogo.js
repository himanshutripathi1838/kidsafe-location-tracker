import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { G, Path, Text as SvgText } from 'react-native-svg';

export default function PrudentLogo({ width = 120, height = 120 }) {
  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox="0 0 200 200">
        <G transform="translate(10, 10)">
          {/* Prudent Shell Sunburst Wedges (Orange #E64A19) */}
          <Path d="M 75 100 L 25 90 A 55 55 0 0 1 30 72 Z" fill="#E64A19" />
          <Path d="M 75 100 L 32 66 A 55 55 0 0 1 45 50 Z" fill="#E64A19" />
          <Path d="M 75 100 L 49 45 A 55 55 0 0 1 66 33 Z" fill="#E64A19" />
          <Path d="M 75 100 L 71 29 A 55 55 0 0 1 90 28 Z" fill="#E64A19" />
          <Path d="M 75 100 L 95 30 A 55 55 0 0 1 112 37 Z" fill="#E64A19" />

          <Path d="M 75 100 L 25 96 A 55 55 0 0 0 28 114 Z" fill="#E64A19" />
          <Path d="M 75 100 L 32 120 A 55 55 0 0 0 44 136 Z" fill="#E64A19" />
          <Path d="M 75 100 L 49 141 A 55 55 0 0 0 68 153 Z" fill="#E64A19" />
          <Path d="M 75 100 L 73 156 A 55 55 0 0 0 91 155 Z" fill="#E64A19" />

          {/* Prudent Systems Text */}
          <SvgText
            x="115"
            y="85"
            fill="#E64A19"
            fontSize="26"
            fontWeight="bold"
            fontFamily="System"
          >
            Prudent
          </SvgText>
          <SvgText
            x="115"
            y="118"
            fill="#E64A19"
            fontSize="24"
            fontWeight="600"
            fontFamily="System"
          >
            Systems
          </SvgText>
        </G>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justify: 'center',
    alignItems: 'center',
  },
});
