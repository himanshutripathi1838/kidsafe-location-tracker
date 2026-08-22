import React from 'react';
import { StyleSheet, View, Text, Dimensions, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PrudentLogo from '../components/PrudentLogo';

const { width } = Dimensions.get('window');

export default function SplashScreenView({ statusText = "Checking for new update..." }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.centerContent}>
        {/* White Center Card Box with Soft Shadow */}
        <View style={styles.logoSquareCard}>
          <PrudentLogo width={140} height={140} />
        </View>

        {/* Product Name Below Box */}
        <Text style={styles.appTitle}>KidSafe Tracker</Text>
      </View>

      {/* Footer Update Loader Message */}
      <View style={styles.footerContainer}>
        <ActivityIndicator size="small" color="#E64A19" style={{ marginBottom: 6 }} />
        <Text style={styles.footerText}>{statusText}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoSquareCard: {
    width: 180,
    height: 180,
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    // Soft Elevation Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  appTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 24,
    letterSpacing: 0.3,
  },
  footerContainer: {
    position: 'absolute',
    bottom: 36,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
