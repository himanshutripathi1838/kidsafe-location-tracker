import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, SafeAreaView, ScrollView, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { addChild } from '../redux/slices/childSlice';
import { getTranslation } from '../utils/localization';

export default function DevicePairingScreen({ navigation, route }) {
  const dispatch = useDispatch();
  const { language } = useSelector((state) => state.auth);
  
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrScanning, setQrScanning] = useState(false);

  const t = (key) => getTranslation(language, key);

  const handlePairDevice = () => {
    if (!name.trim() || !age.trim() || !deviceId.trim()) {
      Alert.alert(t('alert'), 'Please fill in all details (Child Name, Age, and Device ID)');
      return;
    }

    setLoading(true);
    // Simulate API request to pair device
    setTimeout(() => {
      dispatch(addChild({ name, age, deviceId }))
        .unwrap()
        .then(() => {
          setLoading(false);
          Alert.alert(
            language === 'en' ? 'Device Paired!' : 'डिवाइस जोड़ा गया!',
            language === 'en' 
              ? `Successfully paired tracking device ${deviceId} with ${name}.` 
              : `सफलतापूर्वक ट्रैकिंग डिवाइस ${deviceId} को ${name} के साथ जोड़ा गया।`,
            [{ text: 'OK', onPress: () => navigation.navigate('MainTabs') }]
          );
        })
        .catch((err) => {
          setLoading(false);
          Alert.alert('Error', err);
        });
    }, 1500);
  };

  const handleScanQr = () => {
    setQrScanning(true);
    // Simulate QR Scanner camera scanning and resolving device ID
    setTimeout(() => {
      setQrScanning(false);
      const mockScannedId = `dev-scan-${Math.floor(100000 + Math.random() * 900000)}`;
      setDeviceId(mockScannedId);
      Alert.alert(
        language === 'en' ? 'QR Code Scanned' : 'क्यूआर कोड स्कैन किया गया',
        `Device ID: ${mockScannedId} extracted.`
      );
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('devicePairing')}</Text>
          <Text style={styles.subtitle}>
            Enter child info and scan/enter your tracker device details.
          </Text>

          <View style={styles.form}>
            {/* Child Name */}
            <Text style={styles.label}>Child's Full Name</Text>
            <TextInput
              style={styles.input}
              placeholder="E.g., Aarav Singh"
              value={name}
              onChangeText={setName}
            />

            {/* Child Age */}
            <Text style={styles.label}>Child's Age</Text>
            <TextInput
              style={styles.input}
              placeholder="E.g., 8"
              keyboardType="numeric"
              value={age}
              onChangeText={setAge}
              maxLength={2}
            />

            {/* Device ID (Hardware UUID) */}
            <Text style={styles.label}>{t('deviceId')}</Text>
            <View style={styles.deviceIdRow}>
              <TextInput
                style={[styles.input, styles.deviceIdInput]}
                placeholder="E.g., dev-aarav-101"
                value={deviceId}
                onChangeText={setDeviceId}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.qrBtn} onPress={handleScanQr} disabled={qrScanning}>
                <Text style={styles.qrBtnText}>{qrScanning ? '⌛' : '📷 Scan'}</Text>
              </TouchableOpacity>
            </View>

            {/* QR Scan Overlay Indicator */}
            {qrScanning && (
              <View style={styles.qrOverlay}>
                <ActivityIndicator size="large" color="#6200EE" />
                <Text style={styles.qrOverlayText}>Simulating Camera QR Scan...</Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitBtn} onPress={handlePairDevice} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>{t('pairBtn')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelBtnText}>Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  scrollContent: {
    padding: 16,
    justifyContent: 'center',
    flexGrow: 1,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 18,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
    marginBottom: 12,
  },
  deviceIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceIdInput: {
    flex: 1,
    marginRight: 10,
  },
  qrBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1.5,
    borderColor: '#6200EE',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  qrBtnText: {
    color: '#6200EE',
    fontWeight: 'bold',
    fontSize: 13,
  },
  qrOverlay: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  qrOverlayText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
    marginTop: 8,
  },
  submitBtn: {
    backgroundColor: '#6200EE',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#6200EE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  cancelBtn: {
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  cancelBtnText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
  },
});
