import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { loginWithPhone, verifyOTP } from '../redux/slices/authSlice';
import { getTranslation } from '../utils/localization';

export default function LoginScreen({ navigation }) {
  const dispatch = useDispatch();
  const { loading, otpSent, error, language } = useSelector((state) => state.auth);
  
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  const t = (key) => getTranslation(language, key);

  const handleSendOtp = () => {
    if (!phone || phone.length < 10) {
      Alert.alert(t('alert'), language === 'en' ? 'Please enter a valid 10-digit phone number' : 'कृपया एक वैध 10-अंकीय फ़ोन नंबर दर्ज करें');
      return;
    }
    dispatch(loginWithPhone({ phone }));
  };

  const handleVerifyOtp = () => {
    if (!otp || otp.length < 4) {
      Alert.alert(t('alert'), language === 'en' ? 'Please enter the OTP' : 'कृपया ओटीपी दर्ज करें');
      return;
    }
    dispatch(verifyOTP({ phone, otp }))
      .unwrap()
      .then((res) => {
        // Success
      })
      .catch((err) => {
        Alert.alert(t('alert'), err);
      });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>🛡️ KidSafe</Text>
        <Text style={styles.title}>{t('welcome')}</Text>
        <Text style={styles.subtitle}>
          {otpSent ? t('enterOtp') : t('login')}
        </Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {!otpSent ? (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('phone')}</Text>
            <View style={styles.phoneInputRow}>
              <Text style={styles.countryCode}>+91</Text>
              <TextInput
                style={styles.input}
                placeholder="98765 43210"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={10}
              />
            </View>
            
            <TouchableOpacity style={styles.button} onPress={handleSendOtp} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>{t('sendOtp')}</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('otp')}</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="1234"
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
              secureTextEntry
            />
            <Text style={styles.helperText}>
              {language === 'en' 
                ? 'Enter 1234 or 123456 to bypass during testing.' 
                : 'परीक्षण के दौरान बायपास करने के लिए 1234 या 123456 दर्ज करें।'}
            </Text>

            <TouchableOpacity style={styles.button} onPress={handleVerifyOtp} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>{t('verify')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity 
          style={styles.switchPrompt} 
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.switchPromptText}>{t('signupPrompt')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#6200EE',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  inputContainer: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1F2937',
  },
  otpInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 20,
    fontWeight: 'bold',
  },
  helperText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#6200EE',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6200EE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  switchPrompt: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchPromptText: {
    color: '#6200EE',
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
});
