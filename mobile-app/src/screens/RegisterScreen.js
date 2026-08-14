import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { registerParent } from '../redux/slices/authSlice';
import { getTranslation } from '../utils/localization';

export default function RegisterScreen({ navigation }) {
  const dispatch = useDispatch();
  const { loading, error, language } = useSelector((state) => state.auth);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const t = (key) => getTranslation(language, key);

  const handleRegister = () => {
    if (!name || name.trim() === '') {
      Alert.alert(t('alert'), language === 'en' ? 'Please enter your name' : 'कृपया अपना नाम दर्ज करें');
      return;
    }
    if (!phone || phone.length < 10) {
      Alert.alert(t('alert'), language === 'en' ? 'Please enter a valid 10-digit phone number' : 'कृपया एक वैध 10-अंकीय फ़ोन नंबर दर्ज करें');
      return;
    }
    
    dispatch(registerParent({ name, phone, email }))
      .unwrap()
      .then(() => {
        // Logged in
      })
      .catch((err) => {
        Alert.alert(t('alert'), err);
      });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>🛡️ KidSafe</Text>
        <Text style={styles.title}>{t('register')}</Text>
        <Text style={styles.subtitle}>
          {language === 'en' ? 'Create parent account to begin tracking' : 'ट्रैकिंग शुरू करने के लिए पैरेंट अकाउंट बनाएं'}
        </Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.inputContainer}>
          <Text style={styles.label}>{t('fullName')}</Text>
          <TextInput
            style={styles.input}
            placeholder="Vikram Singh"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>{t('phone')}</Text>
          <View style={styles.phoneInputRow}>
            <Text style={styles.countryCode}>+91</Text>
            <TextInput
              style={styles.innerPhoneInput}
              placeholder="98765 43210"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              maxLength={10}
            />
          </View>

          <Text style={styles.label}>{t('email')}</Text>
          <TextInput
            style={styles.input}
            placeholder="parent@example.com"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />

          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>{t('register')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.switchPrompt} 
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.switchPromptText}>{t('loginPrompt')}</Text>
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
    fontSize: 14,
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
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1F2937',
    marginBottom: 12,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  countryCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4B5563',
    marginRight: 8,
  },
  innerPhoneInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#1F2937',
  },
  button: {
    backgroundColor: '#6200EE',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
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
