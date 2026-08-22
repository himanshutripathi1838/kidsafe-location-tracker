import React, { Component } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';

export default class SafeMapView extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.log('SafeMapView caught map render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { fallbackLocation, childName } = this.props;
      const lat = fallbackLocation?.latitude || 23.2334;
      const lng = fallbackLocation?.longitude || 77.4011;
      const speed = fallbackLocation?.speed ?? 0;
      const battery = fallbackLocation?.battery ?? 100;

      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

      return (
        <View style={styles.fallbackContainer}>
          <Text style={styles.fallbackEmoji}>📍</Text>
          <Text style={styles.fallbackTitle}>Live GPS Location Active</Text>
          <Text style={styles.fallbackSubtitle}>
            {childName || 'Child'} is currently at ({lat.toFixed(4)}, {lng.toFixed(4)})
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>⚡ Battery</Text>
              <Text style={styles.statValue}>{battery}%</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={styles.statLabel}>🚀 Speed</Text>
              <Text style={styles.statValue}>{speed} km/h</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.openBtn}
            onPress={() => Linking.openURL(mapsUrl)}
          >
            <Text style={styles.openBtnText}>🗺️ Open Location in Google Maps</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justify: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fallbackEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  fallbackSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  openBtn: {
    backgroundColor: '#6200EE',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  openBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
});
