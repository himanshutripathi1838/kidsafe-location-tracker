import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Dimensions, Share, Platform, StatusBar, Alert, Linking, TextInput, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import MapView, { Marker, Circle, Polyline, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { setSelectedChildId, addChildLocal, deleteChildLocal } from '../redux/slices/childSlice';
import { simulateMovementStep, updateLiveLocation, setSimulationMode, fetchLiveLocation } from '../redux/slices/locationSlice';
import { updateLiveReportData } from '../redux/slices/reportSlice';
import { triggerLocalSos, resolveSosAlert } from '../redux/slices/sosSlice';
import { logoutUser } from '../redux/slices/authSlice';
import { resetGeofencesToDefault, updatePathStartPoint } from '../redux/slices/geofenceSlice';
import { getTranslation } from '../utils/localization';
import * as Notifications from 'expo-notifications';
import * as Battery from 'expo-battery';

import telemetryService from '../services/telemetryService';
import SafeMapView from '../components/SafeMapView';

const { width } = Dimensions.get('window');

export default function DashboardScreen({ navigation }) {
  const dispatch = useDispatch();
  const { user, language } = useSelector((state) => state.auth);
  const { children, selectedChildId } = useSelector((state) => state.child);
  const { liveLocations, isSimulationMode, isSocketConnected, isMqttServerOnline } = useSelector((state) => state.location);
  const { zones } = useSelector((state) => state.geofence);
  const { alertHistory } = useSelector((state) => state.sos);
  const { reports } = useSelector((state) => state.report);

  const [showChildPicker, setShowChildPicker] = useState(false);

  // Add Child states
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [newChildAge, setNewChildAge] = useState('');
  const [newChildDeviceId, setNewChildDeviceId] = useState('');

  const selectedChild = children.find(c => c.id === selectedChildId) || children[0];
  const currentLocation = liveLocations[selectedChild?.id];
  const childZones = zones[selectedChild?.id] || [];
  const childReport = reports[selectedChild?.id];

  const t = (key) => getTranslation(language, key);
  const mapRef = useRef(null);
  const lastAnimatedCoordsRef = useRef(null);

  useEffect(() => {
    if (currentLocation?.latitude && currentLocation?.longitude && mapRef.current) {
      const last = lastAnimatedCoordsRef.current;
      let shouldAnimate = false;
      if (!last) {
        shouldAnimate = true;
      } else {
        const dLat = Math.abs(currentLocation.latitude - last.latitude);
        const dLng = Math.abs(currentLocation.longitude - last.longitude);
        if (dLat > 0.0001 || dLng > 0.0001) {
          shouldAnimate = true;
        }
      }

      if (shouldAnimate) {
        lastAnimatedCoordsRef.current = { latitude: currentLocation.latitude, longitude: currentLocation.longitude };
        mapRef.current.animateToRegion({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }, 1000);
      }
    }
  }, [currentLocation?.latitude, currentLocation?.longitude]);

  // Load / Sync default road path geofences and set start point to real current location
  useEffect(() => {
    const initGeofences = async () => {
      dispatch(resetGeofencesToDefault());
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const deviceLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (deviceLoc && deviceLoc.coords) {
            dispatch(updatePathStartPoint({
              childId: selectedChild?.id || 'c-uuid-1',
              zoneId: 'z-1',
              latitude: deviceLoc.coords.latitude,
              longitude: deviceLoc.coords.longitude
            }));
            dispatch(updatePathStartPoint({
              childId: selectedChild?.id || 'c-uuid-1',
              zoneId: 'z-3',
              latitude: deviceLoc.coords.latitude,
              longitude: deviceLoc.coords.longitude
            }));
          }
        }
      } catch (err) {
        console.log('Error initializing path start to current location:', err.message);
      }
    };
    initGeofences();
  }, [selectedChild?.id]);

  // Fetch live location (last known coordinates) on load or child switch
  useEffect(() => {
    if (selectedChild?.id) {
      dispatch(fetchLiveLocation(selectedChild.id));
    }
  }, [selectedChild?.id, dispatch]);

  // Release APK fallback: keep polling the backend even if Socket.IO is blocked or reconnecting.
  useEffect(() => {
    if (!selectedChild?.id) return undefined;

    const interval = setInterval(() => {
      dispatch(fetchLiveLocation(selectedChild.id));
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedChild?.id, dispatch]);

  const [alternativeRoutes, setAlternativeRoutes] = useState([]);

  useEffect(() => {
    const fetchRoutes = async () => {
      // Find the first circular geofence zone that is active
      const targetZone = childZones.find(z => z.type !== 'path' && z.type !== 'line' && z.is_active);
      if (!targetZone || !currentLocation) {
        setAlternativeRoutes([]);
        return;
      }

      try {
        const startLat = currentLocation.latitude;
        const startLng = currentLocation.longitude;
        const endLat = targetZone.latitude;
        const endLng = targetZone.longitude;

        const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&alternatives=true`;
        
        const response = await fetch(url);
        const json = await response.json();
        
        if (json.code === 'Ok' && json.routes) {
          const formattedRoutes = json.routes.map((route, index) => {
            const coords = route.geometry.coordinates.map(p => ({
              latitude: p[1],
              longitude: p[0]
            }));
            const distKm = (route.distance / 1000).toFixed(1);
            const durationMins = Math.round(route.duration / 60);
            return {
              id: `route-${index}-${targetZone.id}`,
              coordinates: coords,
              distance: distKm,
              duration: durationMins,
              isPrimary: index === 0
            };
          });
          setAlternativeRoutes(formattedRoutes);
        } else {
          setAlternativeRoutes([]);
        }
      } catch (err) {
        console.log('Error fetching alternative road routes:', err);
        setAlternativeRoutes([]);
      }
    };

    fetchRoutes();
  }, [currentLocation?.latitude, currentLocation?.longitude, childZones.length]);

  const handleSaveNewChild = () => {
    if (!newChildName.trim() || !newChildAge.trim() || !newChildDeviceId.trim()) {
      Alert.alert('Error', 'Please fill in all child details.');
      return;
    }
    
    dispatch(addChildLocal({
      id: `c-uuid-${Date.now()}`,
      name: newChildName.trim(),
      age: parseInt(newChildAge.trim(), 10),
      device_id: newChildDeviceId.trim(),
      is_active: true,
      school_mode: false,
      school_start: '08:00',
      school_end: '14:30',
      speed_threshold: 20.0
    }));

    Alert.alert('Success', `${newChildName} added successfully!`);
    
    setNewChildName('');
    setNewChildAge('');
    setNewChildDeviceId('');
    setShowAddChildModal(false);
    setShowChildPicker(false);
  };

  const handleDeleteChild = (childId, childName) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${childName}'s profile?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            dispatch(deleteChildLocal(childId));
            setShowChildPicker(false);
            Alert.alert('Deleted', `${childName}'s profile has been removed.`);
          }
        }
      ]
    );
  };

  // Start 100% Real Hardware Sensor Telemetry (GPS, Battery, Network)
  useEffect(() => {
    if (selectedChild?.id) {
      telemetryService.startRealTimeTelemetry(selectedChild.id);
    }
    return () => {
      telemetryService.stopRealTimeTelemetry();
    };
  }, [selectedChild?.id]);

  const [ticker, setTicker] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTicker(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const getTimeAgo = (timestamp) => {
    if (!timestamp) return 'Never';
    const diffMs = Date.now() - new Date(timestamp).getTime();
    const diffSecs = Math.max(0, Math.floor(diffMs / 1000));
    if (diffSecs < 5) return 'Just now';
    if (diffSecs < 60) return `Updated ${diffSecs} sec ago`;
    const diffMins = Math.floor(diffSecs / 60);
    return `Updated ${diffMins} min ago`;
  };

  const handleTriggerSOS = async () => {
    const resultAction = await dispatch(triggerLocalSos({
      childId: selectedChild.id,
      childName: selectedChild.name,
      location: currentLocation
    }));

    let activeAlertId = `sos-${Date.now()}`;
    if (triggerLocalSos.fulfilled.match(resultAction)) {
      activeAlertId = resultAction.payload.id;
    }

    const liveLocLink = currentLocation 
      ? `https://maps.google.com/?q=${currentLocation.latitude},${currentLocation.longitude}`
      : `https://maps.google.com/?q=23.2334,77.4011`;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🚨 EMERGENCY SOS ACTIVATED!",
          body: `Distress alert for ${selectedChild.name}. Live Location: ${liveLocLink}. SMS sent to +91 70679 91838 & +91 62653 27545.`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          channelId: 'emergency-alerts',
        },
        trigger: null,
      });
    } catch (err) {
      console.log('Error triggering SOS push notification:', err.message);
    }

    // Launch native SMS app prefilled with SOS message & coordinates link to both primary numbers
    const smsMessage = `🚨 EMERGENCY ALERT: SOS triggered by child ${selectedChild.name}. Live location: ${liveLocLink}`;
    
    // For cross-platform support (Android uses comma, iOS uses semicolon)
    const separator = Platform.OS === 'ios' ? ';' : ',';
    const smsUrl = Platform.OS === 'android'
      ? `sms:+917067991838${separator}+916265327545?body=${encodeURIComponent(smsMessage)}`
      : `sms:+917067991838${separator}+916265327545&body=${encodeURIComponent(smsMessage)}`;

    try {
      await Linking.openURL(smsUrl);
    } catch (err) {
      console.log('Failed to launch native SMS app:', err.message);
    }
  };

  const handleShareLocation = async () => {
    try {
      const shareUrl = `https://maps.google.com/?q=${currentLocation.latitude},${currentLocation.longitude}`;
      await Share.share({
        message: `${selectedChild.name} is currently safe at speed ${currentLocation.speed} km/h, battery ${currentLocation.battery}%. Track location: ${shareUrl}`,
      });
    } catch (e) {
      console.log('Error sharing location', e);
    }
  };

  const getStatusIndicator = () => {
    const lastSeenTime = currentLocation?.timestamp ? new Date(currentLocation.timestamp).getTime() : 0;
    const isChildTelemetryStale = !lastSeenTime || Date.now() - lastSeenTime > 120 * 1000;
    if (!isSocketConnected || !isMqttServerOnline || isChildTelemetryStale || currentLocation?.deviceStatus === 'offline') {
      return { color: '#EF4444', text: 'Offline', textColor: '#EF4444' };
    }
    return { color: '#10B981', text: 'Live', textColor: '#10B981' };
  };
  const statusIndicator = getStatusIndicator();

  const hasValidLocation = currentLocation && 
    typeof currentLocation.latitude === 'number' && 
    typeof currentLocation.longitude === 'number' && 
    !isNaN(currentLocation.latitude) && 
    !isNaN(currentLocation.longitude) && 
    (currentLocation.latitude !== 0 || currentLocation.longitude !== 0);

  if (!hasValidLocation) {
    return (
      <SafeAreaView style={styles.container}>
        {/* Header with Child Selector */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Namaste, {user?.name || 'Parent'}</Text>
            <TouchableOpacity onPress={() => setShowChildPicker(!showChildPicker)} style={styles.childSelectorBtn}>
              <Text style={styles.childNameText}>{selectedChild?.name} ▾</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerRightRow}>
            <View style={styles.deviceStatus}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                <View style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: statusIndicator.color,
                  marginRight: 4
                }} />
                <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: statusIndicator.textColor }}>
                  {statusIndicator.text}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Child dropdown list selector */}
        {showChildPicker && (
          <View style={styles.childDropdown}>
            {children.map((child) => (
              <View key={child.id} style={[styles.dropdownItemRow, child.id === selectedChildId && styles.dropdownItemActive]}>
                <TouchableOpacity onPress={() => {
                  dispatch(setSelectedChildId(child.id));
                  setShowChildPicker(false);
                }} style={{ flex: 1 }}>
                  <Text style={[
                    styles.dropdownText,
                    child.id === selectedChildId && styles.dropdownTextActive
                  ]}>
                    🧒 {child.name} ({child.age} yrs)
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#FFFFFF', margin: 16, borderRadius: 20 }}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🛰️</Text>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#374151', textAlign: 'center', marginBottom: 8 }}>
            Connecting to GPS Tracker...
          </Text>
          <Text style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
            Waiting for the latest backend location update for {selectedChild?.name}. Keep the backend running on 10.72.179.60:5000.
          </Text>
          <ActivityIndicator size="large" color="#EF4444" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Child Selector */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcomeText}>Namaste, {user?.name || 'Parent'}</Text>
          <TouchableOpacity onPress={() => setShowChildPicker(!showChildPicker)} style={styles.childSelectorBtn}>
            <Text style={styles.childNameText}>{selectedChild?.name} ▾</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.headerRightRow}>
          <View style={styles.deviceStatus}>
            {/* Real-time MQTT Broker and Socket connection indicators */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
              <View style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: statusIndicator.color,
                marginRight: 4
              }} />
              <Text style={{ fontSize: 9.5, fontWeight: 'bold', color: statusIndicator.textColor }}>
                {statusIndicator.text}
              </Text>
            </View>

            <Text style={styles.deviceStatusText}>
              ⚡ {currentLocation.battery}% | {currentLocation.network === 'Disconnected' ? '🔴 Offline' : `🟢 MQTT (${currentLocation.network})`}
            </Text>
            {currentLocation.battery < 20 && (
              <View style={styles.lowBatteryBadge}>
                <Text style={styles.lowBatteryText}>LOW BATTERY</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.logoutHeaderBtn} onPress={() => dispatch(logoutUser())}>
            <Text style={styles.logoutHeaderBtnText}>🚪 Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Child Switcher Modal Drawer */}
      {showChildPicker && (
        <View style={styles.childDropdown}>
          {children.map((child) => (
            <View
              key={child.id}
              style={[
                styles.dropdownItemRow,
                child.id === selectedChildId && styles.dropdownItemActive
              ]}
            >
              <TouchableOpacity
                style={{ flex: 1 }}
                onPress={() => {
                  dispatch(setSelectedChildId(child.id));
                  setShowChildPicker(false);
                }}
              >
                <Text style={[
                  styles.dropdownText,
                  child.id === selectedChildId && styles.dropdownTextActive
                ]}>
                  🧒 {child.name} ({child.age} yrs)
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.deleteChildBtn}
                onPress={() => handleDeleteChild(child.id, child.name)}
              >
                <Text style={{ fontSize: 13, color: '#EF4444' }}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
          
          <TouchableOpacity
            style={[styles.dropdownItemRow, { backgroundColor: '#EEF2FF', justifyContent: 'center' }]}
            onPress={() => {
              setShowAddChildModal(true);
              setShowChildPicker(false);
            }}
          >
            <Text style={{ fontSize: 13, color: '#6200EE', fontWeight: 'bold' }}>
              ➕ Add Student
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Live Location Map */}
        <View style={styles.mapContainer}>
          <SafeMapView fallbackLocation={currentLocation} childName={selectedChild?.name}>
            <MapView
              ref={mapRef}
              style={styles.map}
              mapType="standard"
              initialRegion={{
                latitude: currentLocation?.latitude || 23.2162,
                longitude: currentLocation?.longitude || 77.3956,
                latitudeDelta: 0.015,
                longitudeDelta: 0.015,
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
              {/* Child Marker */}
              <Marker
                coordinate={{
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                }}
                title={selectedChild?.name}
                description={`${t('speed')}: ${currentLocation.speed} km/h | ${t('battery')}: ${currentLocation.battery}%`}
              >
                <View style={styles.customMarker}>
                  <Text style={styles.markerEmoji}>🧒</Text>
                </View>
              </Marker>

              {/* Geofences on dashboard map */}
              {childZones.filter(z => z.is_active).map(zone => {
                if (zone.type === 'path') {
                  return null;
                }
                if (zone.type === 'line') {
                  return null;
                }
                return (
                  <React.Fragment key={`zone-dashboard-${zone.id}`}>
                    {/* Circle Boundary */}
                    <Circle
                      center={{ latitude: zone.latitude, longitude: zone.longitude }}
                      radius={zone.radius}
                      strokeColor={`${zone.color}66`}
                      fillColor={`${zone.color}22`}
                      strokeWidth={2}
                    />
                    {/* Pin Marker representing geofence location */}
                    <Marker
                      coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
                      title={zone.name}
                      description={`Safety geofence center (${zone.radius}m radius)`}
                    >
                      <View style={{ backgroundColor: '#FFFFFF', padding: 6, borderRadius: 20, borderWidth: 1.5, borderColor: '#EF4444', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2 }}>
                        <Text style={{ fontSize: 13 }}>📍</Text>
                      </View>
                    </Marker>
                    {/* Dynamic road routes from OSRM or straight dashed line fallback */}
                    {alternativeRoutes && alternativeRoutes.length > 0 ? (
                      alternativeRoutes.map((route, idx) => {
                        let strokeColor = '#3B82F6'; // Primary Route: Bright Blue
                        let strokeWidth = 4;
                        let zIndex = 10;
                        
                        if (idx === 1) {
                          strokeColor = '#6B7280'; // Alternative 1: Grey
                          strokeWidth = 3.5;
                          zIndex = 8;
                        } else if (idx === 2) {
                          strokeColor = '#10B981'; // Alternative 2: Green
                          strokeWidth = 3;
                          zIndex = 7;
                        }
                        
                        return (
                          <Polyline
                            key={route.id}
                            coordinates={route.coordinates}
                            strokeColor={strokeColor}
                            strokeWidth={strokeWidth}
                            zIndex={zIndex}
                          />
                        );
                      })
                    ) : (
                      // Fallback to straight dashed line if OSRM is loading/failed
                      currentLocation && (
                        <Polyline
                          coordinates={[
                            { latitude: currentLocation.latitude, longitude: currentLocation.longitude },
                            { latitude: zone.latitude, longitude: zone.longitude }
                          ]}
                          strokeColor="#6200EE"
                          strokeWidth={2.5}
                          lineDashPattern={[6, 6]}
                        />
                      )
                    )}
                  </React.Fragment>
                );
              })}
            </MapView>
          </SafeMapView>

          {/* OSRM Route Info Overlay Card */}
          {alternativeRoutes && alternativeRoutes.length > 0 && (
            <View style={{
              position: 'absolute',
              top: 10,
              right: 10,
              backgroundColor: 'rgba(255, 255, 255, 0.92)',
              borderRadius: 8,
              padding: 8,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 4,
              maxWidth: 160
            }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#374151', marginBottom: 4 }}>🛣️ AVAILABLE ROUTES:</Text>
              {alternativeRoutes.map((route, idx) => {
                let bulletColor = '#3B82F6';
                let label = 'Primary';
                if (idx === 1) {
                  bulletColor = '#6B7280';
                  label = 'Alt 1';
                }
                if (idx === 2) {
                  bulletColor = '#10B981';
                  label = 'Alt 2';
                }
                return (
                  <View key={route.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: bulletColor, marginRight: 4 }} />
                    <Text style={{ fontSize: 8.5, color: '#4B5563', fontWeight: idx === 0 ? 'bold' : 'normal' }}>
                      {label}: {route.duration}m ({route.distance}km)
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.lastPingBar}>
            <Text style={styles.lastPingText}>
              📍 {t('lastPing')}: {new Date(currentLocation.timestamp).toLocaleTimeString()} ({currentLocation.status})
            </Text>
          </View>
        </View>

        {/* Telemetry Simulator Controller Box */}
        <View style={styles.simCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={styles.simTitle}>🛠️ GPS & Telemetry Control Panel</Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: isSimulationMode ? '#FEE2E2' : '#D1FAE5' }}>
              <Text style={{ fontSize: 9, fontWeight: 'bold', color: isSimulationMode ? '#EF4444' : '#059669' }}>
                {isSimulationMode ? 'SIMULATOR ACTIVE' : 'REAL GPS ACTIVE'}
              </Text>
            </View>
          </View>
          <Text style={styles.simSubtitle}>Choose whether to use simulated values or live physical GPS hardware speed:</Text>
          
          <View style={styles.simBtnRow}>
            <TouchableOpacity 
              style={[styles.simBtn, { backgroundColor: '#FEE2E2', borderColor: '#EF4444' }]} 
              onPress={async () => {
                dispatch(setSimulationMode(true));
                let realBattery = 85;
                try {
                  const level = await Battery.getBatteryLevelAsync();
                  if (level !== -1) realBattery = Math.round(level * 100);
                } catch (e) {}

                dispatch(updateLiveLocation({
                  childId: selectedChild.id,
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  speed: 0.0,
                  battery: realBattery,
                  network: currentLocation.network,
                  isSimulated: true
                }));
                dispatch(updateLiveReportData({
                  childId: selectedChild.id,
                  latitude: currentLocation.latitude,
                  longitude: currentLocation.longitude,
                  speed: 0.0,
                  battery: realBattery,
                  isSimulated: true
                }));
                Alert.alert('Simulating Stopped', 'Status set to Stopped, speed set to 0.0 km/h');
              }}
            >
              <Text style={[styles.simBtnText, { color: '#EF4444' }]}>🛑 Stop Sim</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.simBtn, { backgroundColor: '#E0F2FE', borderColor: '#0284C7' }]} 
              onPress={async () => {
                dispatch(setSimulationMode(true));
                let realBattery = 85;
                try {
                  const level = await Battery.getBatteryLevelAsync();
                  if (level !== -1) realBattery = Math.round(level * 100);
                } catch (e) {}

                const nextLat = currentLocation.latitude + 0.0002;
                const nextLng = currentLocation.longitude + 0.0001;
                dispatch(updateLiveLocation({
                  childId: selectedChild.id,
                  latitude: nextLat,
                  longitude: nextLng,
                  speed: 4.2,
                  battery: realBattery,
                  network: currentLocation.network,
                  isSimulated: true
                }));
                dispatch(updateLiveReportData({
                  childId: selectedChild.id,
                  latitude: nextLat,
                  longitude: nextLng,
                  speed: 4.2,
                  battery: realBattery,
                  isSimulated: true
                }));
                Alert.alert('Simulating Walk', 'Status set to Walking, speed set to 4.2 km/h');
              }}
            >
              <Text style={[styles.simBtnText, { color: '#0284C7' }]}>🚶 Walk Sim (4.2)</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.simBtn, { backgroundColor: '#FEF3C7', borderColor: '#D97706' }]} 
              onPress={async () => {
                dispatch(setSimulationMode(true));
                let realBattery = 85;
                try {
                  const level = await Battery.getBatteryLevelAsync();
                  if (level !== -1) realBattery = Math.round(level * 100);
                } catch (e) {}

                const nextLat = currentLocation.latitude + 0.0006;
                const nextLng = currentLocation.longitude + 0.0003;
                dispatch(updateLiveLocation({
                  childId: selectedChild.id,
                  latitude: nextLat,
                  longitude: nextLng,
                  speed: 28.0,
                  battery: realBattery,
                  network: currentLocation.network,
                  isSimulated: true
                }));
                dispatch(updateLiveReportData({
                  childId: selectedChild.id,
                  latitude: nextLat,
                  longitude: nextLng,
                  speed: 28.0,
                  battery: realBattery,
                  isSimulated: true
                }));
                Alert.alert('Simulating Bus', 'Status set to Bus, speed set to 28.0 km/h');
              }}
            >
              <Text style={[styles.simBtnText, { color: '#D97706' }]}>🚌 Bus Sim (28.0)</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={{ 
              marginTop: 12, 
              backgroundColor: isSimulationMode ? '#10B981' : '#E5E7EB', 
              borderRadius: 12, 
              paddingVertical: 10, 
              alignItems: 'center',
              borderWidth: 1.5,
              borderColor: isSimulationMode ? '#059669' : '#D1D5DB'
            }}
            onPress={async () => {
              dispatch(setSimulationMode(false));
              
              // Instantly request fresh GPS update from hardware to synchronize speed
              try {
                const freshLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
                if (freshLoc && freshLoc.coords) {
                  const rawSpeed = freshLoc.coords.speed;
                  const freshSpeed = (rawSpeed !== null && rawSpeed > 0.15) ? parseFloat((rawSpeed * 3.6).toFixed(1)) : 0.0;
                  
                  dispatch(updateLiveLocation({
                    childId: selectedChild.id,
                    latitude: freshLoc.coords.latitude,
                    longitude: freshLoc.coords.longitude,
                    speed: freshSpeed,
                    battery: currentLocation.battery,
                    network: currentLocation.network
                  }));
                }
              } catch (e) {
                console.log('Error manual gps refresh on real gps toggle:', e);
              }
              
              Alert.alert('Real GPS Activated', 'Simulator turned off. The app is now using the phone\'s actual GPS hardware sensor!');
            }}
          >
            <Text style={{ fontSize: 11, fontWeight: 'bold', color: isSimulationMode ? '#FFFFFF' : '#374151' }}>
              {isSimulationMode ? '🟢 Switch to Real Device GPS Sensor' : '✓ Real Device GPS Active'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Live Telemetry Status Dashboard */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>📡 Live GPS Tracker Telemetry</Text>
          
          {/* Status Indicators row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{
                width: 8, height: 8, borderRadius: 4,
                backgroundColor: currentLocation.deviceStatus === 'offline' ? '#EF4444' : '#10B981',
                marginRight: 6
              }} />
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#374151' }}>
                Status: {currentLocation.deviceStatus === 'offline' ? '🔴 Offline' : '🟢 Online'}
              </Text>
            </View>
            <Text style={{ fontSize: 11, fontStyle: 'italic', color: '#6B7280' }}>
              {getTimeAgo(currentLocation.timestamp)}
            </Text>
          </View>

          {/* Battery Status & Alerts */}
          <View style={{ marginBottom: 12, padding: 8, borderRadius: 8, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#4B5563' }}>🔋 Battery Level:</Text>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: currentLocation.battery < 10 ? '#EF4444' : currentLocation.battery < 20 ? '#F59E0B' : '#10B981' }}>
                {currentLocation.battery}%
              </Text>
            </View>
            {currentLocation.battery < 10 ? (
              <Text style={{ fontSize: 10, color: '#EF4444', fontWeight: 'bold', marginTop: 4 }}>⚠️ CRITICAL BATTERY ALERT (Under 10%) - Charge Immediately!</Text>
            ) : currentLocation.battery < 20 ? (
              <Text style={{ fontSize: 10, color: '#F59E0B', fontWeight: 'bold', marginTop: 4 }}>⚠️ LOW BATTERY WARNING (Under 20%)</Text>
            ) : null}
          </View>

          {/* Telemetry Grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {/* Speed Box */}
            <View style={{ width: '48%', backgroundColor: '#F9FAFB', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
              <Text style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>Current Speed</Text>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#374151', marginVertical: 2 }}>
                {currentLocation.speed} km/h
              </Text>
              <Text style={{ fontSize: 10, color: '#6B7280' }}>
                Mode: {currentLocation.speed < 0.5 ? 'Stopped 🛑' : currentLocation.speed <= 5.0 ? 'Walking 🚶' : currentLocation.speed <= 15.0 ? 'Running 🏃' : 'Vehicle 🚌'}
              </Text>
            </View>

            {/* Satellites Box */}
            <View style={{ width: '48%', backgroundColor: '#F9FAFB', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
              <Text style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>GPS Status</Text>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#374151', marginVertical: 2 }}>
                {currentLocation.satellites > 0 ? '🛰️ GPS Fixed' : '🔴 No GPS Fix'}
              </Text>
              <Text style={{ fontSize: 10, color: '#6B7280' }}>
                Satellites: {currentLocation.satellites}
              </Text>
            </View>

            {/* GSM Signal Box */}
            <View style={{ width: '48%', backgroundColor: '#F9FAFB', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
              <Text style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>Signal Strength</Text>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#374151', marginVertical: 2 }}>
                📶 {currentLocation.network}
              </Text>
              <Text style={{ fontSize: 10, color: '#6B7280' }}>GSM Network Status</Text>
            </View>

            {/* Direction Box */}
            <View style={{ width: '48%', backgroundColor: '#F9FAFB', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
              <Text style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>Current Direction</Text>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#374151', marginVertical: 2 }}>
                🧭 {currentLocation.course}°
              </Text>
              <Text style={{ fontSize: 10, color: '#6B7280' }}>Course Heading</Text>
            </View>

            {/* Coordinates Box */}
            <View style={{ width: '100%', backgroundColor: '#F9FAFB', padding: 8, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' }}>
              <Text style={{ fontSize: 10, color: '#9CA3AF', textTransform: 'uppercase' }}>Coordinates (Lat, Lng)</Text>
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: '#374151', marginVertical: 2 }}>
                {parseFloat(currentLocation.latitude).toFixed(6)}, {parseFloat(currentLocation.longitude).toFixed(6)}
              </Text>
            </View>
          </View>
        </View>

        {/* Device Information Panel */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>ℹ️ Hardware Device Information</Text>
          <View style={{ padding: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 6 }}>
              <Text style={{ fontSize: 11, color: '#6B7280' }}>IMEI Number</Text>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#374151' }}>{currentLocation.imei || selectedChild.device_id}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 6 }}>
              <Text style={{ fontSize: 11, color: '#6B7280' }}>Country Code</Text>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#374151' }}>{currentLocation.countryCode || 404}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 6 }}>
              <Text style={{ fontSize: 11, color: '#6B7280' }}>Operator Code</Text>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#374151' }}>{currentLocation.operatorCode || 93}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 6 }}>
              <Text style={{ fontSize: 11, color: '#6B7280' }}>LAC (Location Area Code)</Text>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#374151' }}>{currentLocation.lac || 1772}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingVertical: 6 }}>
              <Text style={{ fontSize: 11, color: '#6B7280' }}>Cell ID</Text>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#374151' }}>{currentLocation.cellId || 6043}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
              <Text style={{ fontSize: 11, color: '#6B7280' }}>Config Mode</Text>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#374151' }}>{currentLocation.configMode || 2}</Text>
            </View>
          </View>
        </View>

        {/* Quick Stats Panel */}
        <View style={styles.statsCard}>
          <Text style={styles.sectionTitle}>{t('dailySummary')}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{childReport ? `${childReport.total_distance.toFixed(2)} km` : '0.00 km'}</Text>
              <Text style={styles.statLabel}>{t('distance')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{childReport ? childReport.active_time : '0m'}</Text>
              <Text style={styles.statLabel}>{t('activeTime')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, currentLocation.speed > selectedChild.speed_threshold && styles.alertValue]}>
                {currentLocation.speed} km/h
              </Text>
              <Text style={styles.statLabel}>{t('speed')}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{childReport ? childReport.stops_count : '0'}</Text>
              <Text style={styles.statLabel}>{t('stops')}</Text>
            </View>
          </View>
        </View>

        {/* Dashboard Quick Actions */}
        <View style={styles.actionGrid}>
          <TouchableOpacity style={[styles.actionBtn, styles.sosBtn]} onPress={handleTriggerSOS}>
            <Text style={styles.sosEmoji}>🚨</Text>
            <Text style={styles.sosText}>{t('sosBtn')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Tracking')}>
            <Text style={styles.actionEmoji}>🗺️</Text>
            <Text style={styles.actionText}>{t('liveLocation')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleShareLocation}>
            <Text style={styles.actionEmoji}>📤</Text>
            <Text style={styles.actionText}>{t('shareParent')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Contacts')}>
            <Text style={styles.actionEmoji}>📞</Text>
            <Text style={styles.actionText}>{t('emergencyContacts')}</Text>
          </TouchableOpacity>
        </View>

        {/* Active Alert Feed */}
        <View style={styles.alertCard}>
          <Text style={styles.sectionTitle}>{t('activeAlerts')}</Text>
          {alertHistory.length === 0 ? (
            <Text style={styles.emptyAlertText}>No alerts generated in the last 24 hours.</Text>
          ) : (
            alertHistory.slice(0, 3).map((alert) => (
              <View key={alert.id} style={styles.alertItem}>
                <View style={[styles.alertIndicator, alert.status === 'triggered' ? styles.alertRed : styles.alertGreen]} />
                <View style={styles.alertDetails}>
                  <Text style={styles.alertTextTitle}>
                    {alert.child_name}: {alert.type || 'Alert'}
                  </Text>
                  {alert.details && <Text style={styles.alertDesc}>{alert.details}</Text>}
                  <Text style={styles.alertTime}>
                    {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {alert.resolved_notes && (
                    <Text style={styles.alertResolvedText}>
                      ✓ {alert.resolved_notes}
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Child Dialog Modal */}
      <Modal
        visible={showAddChildModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowAddChildModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add New Student / Child</Text>
            
            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Student Name</Text>
              <TextInput
                style={styles.modalInput}
                value={newChildName}
                onChangeText={setNewChildName}
                placeholder="e.g. Aarav Singh"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>Age</Text>
              <TextInput
                style={styles.modalInput}
                value={newChildAge}
                onChangeText={setNewChildAge}
                keyboardType="numeric"
                placeholder="e.g. 8"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.modalInputGroup}>
              <Text style={styles.modalInputLabel}>GPS Tracker Device ID</Text>
              <TextInput
                style={styles.modalInput}
                value={newChildDeviceId}
                onChangeText={setNewChildDeviceId}
                placeholder="e.g. dev-aarav-101"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#F3F4F6' }]} 
                onPress={() => setShowAddChildModal(false)}
              >
                <Text style={{ color: '#4B5563', fontWeight: 'bold' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: '#6200EE' }]} 
                onPress={handleSaveNewChild}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Add Student</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  headerRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutHeaderBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    marginLeft: 8,
  },
  logoutHeaderBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#DC2626',
  },
  welcomeText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  childSelectorBtn: {
    marginTop: 2,
  },
  childNameText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#6200EE',
  },
  deviceStatus: {
    alignItems: 'flex-end',
  },
  deviceStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  lowBatteryBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  lowBatteryText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  childDropdown: {
    position: 'absolute',
    top: 72,
    left: 20,
    zIndex: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    width: 200,
  },
  dropdownItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  deleteChildBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  dropdownItemActive: {
    backgroundColor: '#EEF2FF',
  },
  dropdownText: {
    fontSize: 14,
    color: '#374151',
  },
  dropdownTextActive: {
    fontWeight: 'bold',
    color: '#6200EE',
  },
  scrollContent: {
    padding: 16,
    backgroundColor: '#F3F4F6',
  },
  mapContainer: {
    height: 250,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },
  customMarker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 6,
    borderWidth: 2,
    borderColor: '#6200EE',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  markerEmoji: {
    fontSize: 20,
  },
  lastPingBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  lastPingText: {
    color: '#FFFFFF',
    fontSize: 12,
    textAlign: 'center',
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    width: (width - 64) / 4,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#6200EE',
  },
  alertValue: {
    color: '#EF4444',
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  actionBtn: {
    backgroundColor: '#FFFFFF',
    width: (width - 44) / 2,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sosBtn: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
  },
  actionEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  sosEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  sosText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyAlertText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 12,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  alertIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  alertRed: {
    backgroundColor: '#EF4444',
  },
  alertGreen: {
    backgroundColor: '#10B981',
  },
  alertDetails: {
    flex: 1,
  },
  alertTextTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  alertDesc: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  alertTime: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  alertResolvedText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInputGroup: {
    marginBottom: 14,
  },
  modalInputLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4B5563',
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1F2937',
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  modalBtn: {
    flex: 0.48,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  simTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  simSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 12,
  },
  simBtnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  simBtn: {
    flex: 0.31,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  simBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
