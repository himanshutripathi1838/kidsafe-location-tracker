import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, TextInput, Alert, ScrollView, Dimensions, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { Audio } from 'expo-av';
import { resolveSosAlert } from '../redux/slices/sosSlice';
import { getTranslation } from '../utils/localization';
import SafeMapView from '../components/SafeMapView';

const { width } = Dimensions.get('window');

export default function SOSAlertScreen({ navigation }) {
  const dispatch = useDispatch();
  const { language } = useSelector((state) => state.auth);
  const { activeSosAlert } = useSelector((state) => state.sos);
  const { contacts, selectedChildId } = useSelector((state) => state.child);
  
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [alarmSound, setAlarmSound] = useState(null);

  const t = (key) => getTranslation(language, key);

  useEffect(() => {
    let soundObj = null;
    const playAlarm = async () => {
      try {
        console.log('Loading custom WAV SOS buzzer alarm...');
        
        // Configure Audio Mode to play even when device is set to silent/vibrate mode!
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldRouteThroughEarpieceAndroid: false,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri: 'https://www.image2url.com/r2/default/audio/1785405271341-b53acace-e3ff-4e35-b244-ba4faa88a588.wav' },
          { shouldPlay: true, isLooping: true }
        );
        soundObj = sound;
        setAlarmSound(soundObj);
        await soundObj.playAsync();
      } catch (err) {
        console.log('Error playing in-app alarm:', err.message);
      }
    };

    if (activeSosAlert) {
      playAlarm();
    }

    return () => {
      if (soundObj) {
        console.log('Stopping and unloading alarm sound...');
        soundObj.stopAsync().then(() => {
          soundObj.unloadAsync();
        });
      }
    };
  }, [activeSosAlert]);

  if (!activeSosAlert) return null;

  const handleCall = (phoneNumber) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const handleResolve = () => {
    if (!resolutionNotes.trim()) {
      Alert.alert(
        t('alert'),
        language === 'en' 
          ? 'Please enter resolution notes before dismissing the alarm' 
          : 'कृपया अलार्म बंद करने से पहले समाधान विवरण दर्ज करें'
      );
      return;
    }

    dispatch(resolveSosAlert({ alertId: activeSosAlert.id, notes: resolutionNotes }));
    Alert.alert(
      language === 'en' ? 'Alert Resolved' : 'अलर्ट सुलझाया गया',
      language === 'en' ? 'The emergency state has been cleared.' : 'आपातकालीन स्थिति को समाप्त कर दिया गया है.'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Urgent Header */}
        <View style={styles.emergencyHeader}>
          <Text style={styles.emergencyIcon}>🚨</Text>
          <Text style={styles.emergencyTitle}>{t('sosTriggered')}</Text>
          <Text style={styles.childName}>{activeSosAlert.child_name}</Text>
          <Text style={styles.alertMeta}>
            Speed: {activeSosAlert.speed} km/h | Battery: {activeSosAlert.battery}%
          </Text>
          <Text style={styles.timestamp}>
            Time: {new Date(activeSosAlert.timestamp).toLocaleTimeString()}
          </Text>
        </View>

        {/* Alarm Actions Status */}
        <View style={styles.statusBox}>
          <Text style={styles.statusTitle}>🚨 ACTIONS IN PROGRESS:</Text>
          <Text style={styles.statusItem}>📞 Calling primary numbers (+91 70679 91838 / +91 62653 27545)...</Text>
          <Text style={styles.statusItem}>📨 SMS & Push notifications dispatched to primary contacts...</Text>
        </View>

        {/* Quick Stop Button */}
        <TouchableOpacity 
          style={styles.quickStopBtn} 
          onPress={() => {
            dispatch(resolveSosAlert({ 
              alertId: activeSosAlert.id, 
              notes: 'Alarm stopped by parent from quick action.' 
            }));
            const liveLoc = `https://maps.google.com/?q=${activeSosAlert.latitude},${activeSosAlert.longitude}`;
            Alert.alert(
              language === 'en' ? 'Alarm Stopped' : 'अलार्म बंद किया गया',
              language === 'en' 
                ? `Emergency Alert Resolved.\n\nCurrent Location coordinates sent to:\n• +91 70679 91838\n• +91 62653 27545\n\nLink: ${liveLoc}` 
                : `आपातकालीन अलर्ट समाप्त कर दिया गया है.\n\nवर्तमान स्थान इन नंबरों पर भेजा गया:\n• +91 70679 91838\n• +91 62653 27545\n\nLink: ${liveLoc}`
            );
          }}
        >
          <Text style={styles.quickStopBtnText}>🛑 STOP ALARM</Text>
        </TouchableOpacity>

        {/* SOS Location Map */}
        <View style={styles.mapContainer}>
          <SafeMapView fallbackLocation={activeSosAlert} childName={activeSosAlert?.child_name}>
            <MapView
              style={styles.map}
              mapType="standard"
              initialRegion={{
                latitude: activeSosAlert.latitude,
                longitude: activeSosAlert.longitude,
                latitudeDelta: 0.008,
                longitudeDelta: 0.008,
              }}
            >
              {/* CartoDB Voyager OpenStreetMap Tile Provider (100% Free, Zero 403 Block) */}
              <UrlTile
                urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
                maximumZ={19}
                tileSize={256}
                zIndex={-1}
                flipY={false}
              />
              <Marker
                coordinate={{
                  latitude: activeSosAlert.latitude,
                  longitude: activeSosAlert.longitude,
                }}
                title="EMERGENCY SOS"
                description={`${activeSosAlert.child_name}'s location`}
                pinColor="red"
              />
            </MapView>
          </SafeMapView>
        </View>

        {/* Quick Dials */}
        <View style={styles.dialsSection}>
          <Text style={styles.sectionTitle}>QUICK CALL SHORTCUTS</Text>
          <View style={styles.dialGrid}>
            <TouchableOpacity 
              style={[styles.dialBtn, { backgroundColor: '#6200EE' }]} 
              onPress={() => handleCall('+917067991838')}
            >
              <Text style={styles.dialBtnText}>📞 {t('callPapa')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.dialBtn, { backgroundColor: '#E91E63' }]} 
              onPress={() => handleCall('+916265327545')}
            >
              <Text style={styles.dialBtnText}>📞 {t('callMummy')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.dialBtn, { backgroundColor: '#D32F2F' }]} 
              onPress={() => handleCall('112')}
            >
              <Text style={styles.dialBtnText}>🚓 {t('callPolice')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.dialBtn, { backgroundColor: '#F57C00' }]} 
              onPress={() => handleCall('102')}
            >
              <Text style={styles.dialBtnText}>🚑 {t('callAmbulance')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Resolution Gate */}
        <View style={styles.resolveCard}>
          <Text style={styles.resolveTitle}>{t('resolved')}</Text>
          <TextInput
            style={styles.input}
            placeholder={language === 'en' ? 'E.g., Spoke to bus driver, false alarm, kid is safe at tuition' : 'जैसे, बस ड्राइवर से बात की, झूठा अलार्म, बच्चा सुरक्षित है'}
            value={resolutionNotes}
            onChangeText={setResolutionNotes}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity style={styles.resolveBtn} onPress={handleResolve}>
            <Text style={styles.resolveBtnText}>Clear Emergency Alarm</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#7F1D1D', // Dark urgent red
  },
  scrollContent: {
    padding: 16,
  },
  emergencyHeader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emergencyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emergencyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FCA5A5',
    textAlign: 'center',
  },
  childName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginVertical: 6,
    textTransform: 'uppercase',
  },
  alertMeta: {
    fontSize: 14,
    color: '#EF4444',
    backgroundColor: '#FFFFFF',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    fontWeight: 'bold',
    overflow: 'hidden',
  },
  timestamp: {
    fontSize: 12,
    color: '#F87171',
    marginTop: 8,
  },
  statusBox: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#F87171',
    marginBottom: 8,
  },
  statusItem: {
    fontSize: 12,
    color: '#FFFFFF',
    marginVertical: 3,
    lineHeight: 18,
  },
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  dialsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FCA5A5',
    marginBottom: 10,
    letterSpacing: 1,
  },
  dialGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dialBtn: {
    width: (width - 44) / 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  dialBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  resolveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 20,
  },
  resolveTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    padding: 12,
    fontSize: 14,
    color: '#1F2937',
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  resolveBtn: {
    backgroundColor: '#10B981',
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resolveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStopBtn: {
    backgroundColor: '#DC2626',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  quickStopBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1.2,
  },
});
