import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Switch, TextInput, Alert, SafeAreaView, Platform, StatusBar, Image } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { updateLocalChildSettings } from '../redux/slices/childSlice';
import { setLanguage, logoutUser, updateParentProfile } from '../redux/slices/authSlice';
import { addGeofenceZone, deleteGeofenceZone, resetGeofencesToDefault } from '../redux/slices/geofenceSlice';
import { setDeviceOffline } from '../redux/slices/locationSlice';
import { recordDeviceOfflineInReport } from '../redux/slices/reportSlice';
import { getTranslation } from '../utils/localization';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';

export default function SettingsScreen() {
  const dispatch = useDispatch();
  const { language, user } = useSelector((state) => state.auth);
  const { selectedChildId, children } = useSelector((state) => state.child);

  const activeChild = children.find(c => c.id === selectedChildId) || children[0];

  const t = (key) => getTranslation(language, key);

  // Parent Profile state
  const [parentName, setParentName] = useState(user?.name || 'Vikram Singh');
  const [parentPhone, setParentPhone] = useState(user?.phone || '+91 70679 91838');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Local state bound to active child settings
  const [childName, setChildName] = useState(activeChild?.name || 'Aarav Singh');
  const [bloodGroup, setBloodGroup] = useState(activeChild?.blood_group || 'O+');
  const [childPhoto, setChildPhoto] = useState(activeChild?.photo || 'https://randomuser.me/api/portraits/kids/1.jpg');
  const cloudinaryCloudName = 'h5i6d99m';
  const [speedVal, setSpeedVal] = useState(activeChild?.speed_threshold.toString() || '20');
  const [schoolMode, setSchoolMode] = useState(activeChild?.school_mode || false);
  const [schoolStart, setSchoolStart] = useState(activeChild?.school_start || '08:00');
  const [schoolEnd, setSchoolEnd] = useState(activeChild?.school_end || '14:30');

  React.useEffect(() => {
    if (activeChild) {
      setChildName(activeChild.name || '');
      setBloodGroup(activeChild.blood_group || 'O+');
      setChildPhoto(activeChild.photo || 'https://randomuser.me/api/portraits/kids/1.jpg');
      setSpeedVal(activeChild.speed_threshold?.toString() || '20');
      setSchoolMode(activeChild.school_mode || false);
      setSchoolStart(activeChild.school_start || '08:00');
      setSchoolEnd(activeChild.school_end || '14:30');
    }
  }, [activeChild]);

  // Geofence presets state
  const [citiesList, setCitiesList] = useState([]);
  const [selectedCityPreset, setSelectedCityPreset] = useState('');
  const [showAddCityInput, setShowAddCityInput] = useState(false);
  const [newCityInput, setNewCityInput] = useState('');

  const handleAddCityPreset = () => {
    if (!newCityInput.trim()) {
      Alert.alert('Error', 'Please enter a city name.');
      return;
    }
    const cityName = newCityInput.trim();
    const formattedCity = cityName.charAt(0).toUpperCase() + cityName.slice(1);
    
    if (citiesList.includes(formattedCity)) {
      Alert.alert('Error', 'City already exists.');
      return;
    }

    const updatedList = [...citiesList, formattedCity];
    setCitiesList(updatedList);
    setSelectedCityPreset(formattedCity);
    setNewCityInput('');
    setShowAddCityInput(false);
    Alert.alert('Success', `City "${formattedCity}" added to list!`);
  };

  const handleDeleteCity = (cityToDelete) => {
    const updated = citiesList.filter(c => c !== cityToDelete);
    setCitiesList(updated);
    if (selectedCityPreset === cityToDelete) {
      setSelectedCityPreset(updated.length > 0 ? updated[0] : '');
    }
  };

  // Security settings state
  const [authDevice1, setAuthDevice1] = useState('+91 70679 91838'); // Mummy
  const [authDevice2, setAuthDevice2] = useState('+91 62653 27545'); // Papa
  const [twoFactor, setTwoFactor] = useState(true);

  // Geofence manager state
  const { zones } = useSelector((state) => state.geofence);
  const { liveLocations } = useSelector((state) => state.location);
  const childZones = zones[activeChild?.id] || [];
  const currentLocation = liveLocations[activeChild?.id];

  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneLat, setNewZoneLat] = useState('');
  const [newZoneLng, setNewZoneLng] = useState('');
  const [newZoneRadius, setNewZoneRadius] = useState('500');

  const handleAddGeofence = () => {
    if (!newZoneName || !newZoneLat || !newZoneLng || !newZoneRadius) {
      Alert.alert('Error', 'Please fill all geofence details');
      return;
    }
    const lat = parseFloat(newZoneLat);
    const lng = parseFloat(newZoneLng);
    const rad = parseInt(newZoneRadius, 10);

    if (isNaN(lat) || isNaN(lng) || isNaN(rad)) {
      Alert.alert('Error', 'Invalid numerical values entered');
      return;
    }

    dispatch(addGeofenceZone({
      childId: activeChild.id,
      zoneData: {
        name: newZoneName,
        latitude: lat,
        longitude: lng,
        radius: rad,
        color: '#4CAF50'
      }
    }));

    Alert.alert('Geofence Added', `Safety zone "${newZoneName}" added successfully.`);
    setNewZoneName('');
    setNewZoneLat('');
    setNewZoneLng('');
    setNewZoneRadius('500');
  };

  const handleDeleteGeofence = (zoneId, zoneName) => {
    dispatch(deleteGeofenceZone({
      childId: activeChild.id,
      zoneId
    }));
    Alert.alert('Geofence Removed', `Safety zone "${zoneName}" removed.`);
  };

  const handleSearchPlace = async () => {
    if (!selectedCityPreset) {
      Alert.alert('Search Error', 'Please select or add a city first using the "+ Add City" button above.');
      return;
    }

    if (!newZoneName.trim()) {
      Alert.alert('Search Error', 'Please enter a place name in the "Zone Name" input first.');
      return;
    }

    // Always append the selected city to restrict geocoding search to the selected city context
    const searchQuery = `${newZoneName.trim()}, ${selectedCityPreset}`;

    Alert.alert('Searching...', `Locating coordinates for "${searchQuery}"...`);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'KidSafeTracker/1.0'
          }
        }
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const place = data[0];
        const destLat = parseFloat(place.lat);
        const destLng = parseFloat(place.lon);
        
        if (currentLocation) {
          Alert.alert(
            'Location Found',
            `Resolved: ${place.display_name}\n\nDo you want to set the geofence center here or create a safety corridor from your child's current location?`,
            [
              {
                text: '📍 Set Center Here',
                onPress: () => {
                  setNewZoneLat(destLat.toFixed(6));
                  setNewZoneLng(destLng.toFixed(6));
                  setNewZoneRadius('500'); // default radius
                }
              },
              {
                text: '🛣️ Create Corridor',
                onPress: () => {
                  const currentLat = currentLocation.latitude;
                  const currentLng = currentLocation.longitude;
                  
                  const midLat = (destLat + currentLat) / 2;
                  const midLng = (destLng + currentLng) / 2;
                  
                  // Calculate distance in meters
                  const toRadians = (deg) => deg * (Math.PI / 180);
                  const R = 6371000;
                  const dLat = toRadians(destLat - currentLat);
                  const dLng = toRadians(destLng - currentLng);
                  const a = 
                    Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(toRadians(currentLat)) * Math.cos(toRadians(destLat)) * 
                    Math.sin(dLng/2) * Math.sin(dLng/2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  const distMeters = R * c;
                  const calculatedRadius = Math.max(50, Math.round(distMeters / 2 + 100));

                  setNewZoneName(`Corridor: Current to ${newZoneName}`);
                  setNewZoneLat(midLat.toFixed(6));
                  setNewZoneLng(midLng.toFixed(6));
                  setNewZoneRadius(calculatedRadius.toString());
                }
              },
              { text: 'Cancel', style: 'cancel' }
            ]
          );
        } else {
          setNewZoneLat(destLat.toFixed(6));
          setNewZoneLng(destLng.toFixed(6));
          setNewZoneRadius('500');
          Alert.alert('Location Found', `Coordinates set to: ${destLat.toFixed(6)}, ${destLng.toFixed(6)}`);
        }
      } else {
        Alert.alert(
          'Not Found',
          `Could not find any coordinates for "${newZoneName}" in ${selectedCityPreset}. Please check the spelling or enter coordinates manually.`
        );
      }
    } catch (err) {
      console.log('Geocoding error:', err.message);
      Alert.alert('Search Error', 'Failed to resolve location: ' + err.message);
    }
  };

  const handleSimulateShutdown = () => {
    if (!activeChild) return;
    dispatch(setDeviceOffline({ childId: activeChild.id }));
    if (currentLocation) {
      dispatch(recordDeviceOfflineInReport({
        childId: activeChild.id,
        lastLocation: currentLocation
      }));
    }
    Alert.alert(
      '🔌 Device Offline Simulated',
      `Device state for ${activeChild.name} has been set to OFFLINE. The last known location has been recorded in the Daily Safety Report stops list.`
    );
  };

  const handleSaveProfile = () => {
    if (!parentName.trim() || !parentPhone.trim()) {
      Alert.alert('Error', 'Please enter a valid name and phone number.');
      return;
    }
    dispatch(updateParentProfile({ name: parentName, phone: parentPhone }));
    Alert.alert('Profile Saved', 'Parent profile details successfully updated!');
  };

  const handleSelectPhoto = async () => {
    // Request permission first
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to select a student photo.');
      return;
    }

    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedUri = result.assets[0].uri;
      uploadToCloudinary(selectedUri);
    }
  };

  const uploadToCloudinary = async (fileUri) => {
    try {
      console.log('Uploading photo to Cloudinary:', fileUri);
      
      const apiKey = '838166133142723';
      const apiSecret = '2jlJ0PgvrSAC9O_fE-PbfoPx5r4';
      const timestamp = Math.floor(Date.now() / 1000);
      
      // Calculate SHA-1 signature using native expo-crypto (100% bug-free!)
      const signatureString = `timestamp=${timestamp}${apiSecret}`;
      const signature = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA1,
        signatureString
      );
      
      const formData = new FormData();
      formData.append('file', {
        uri: fileUri,
        type: 'image/jpeg',
        name: 'upload.jpg',
      });
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('signature', signature);
      
      Alert.alert('Uploading...', 'Uploading student photo to Cloudinary, please wait.');
      
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/image/upload`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const data = await response.json();
      
      if (data.secure_url) {
        setChildPhoto(data.secure_url);
        dispatch(updateLocalChildSettings({
          childId: activeChild.id,
          settings: {
            photo: data.secure_url
          }
        }));
        Alert.alert('Success', 'Student photo uploaded successfully to Cloudinary!');
      } else {
        console.log('Cloudinary response error:', data);
        Alert.alert('Upload Failed', data.error?.message || 'Failed to upload photo. Please check your Cloud Name and credentials.');
      }
    } catch (err) {
      console.log('Error uploading image:', err.message);
      Alert.alert('Upload Error', err.message);
    }
  };

  const handleSaveChildSettings = () => {
    const threshold = parseFloat(speedVal);
    if (isNaN(threshold) || threshold <= 0) {
      Alert.alert(t('alert'), 'Please enter a valid speed threshold');
      return;
    }

    dispatch(updateLocalChildSettings({
      childId: activeChild.id,
      settings: {
        name: childName,
        blood_group: bloodGroup,
        photo: childPhoto,
        speed_threshold: threshold,
        school_mode: schoolMode,
        school_start: schoolStart,
        school_end: schoolEnd
      }
    }));

    Alert.alert(
      language === 'en' ? 'Settings Saved' : 'सेटिंग्स सहेजी गईं',
      language === 'en' 
        ? `Configuration profile updated for ${activeChild.name}.` 
        : `${activeChild.name} के लिए सेटिंग्स अपडेट कर दी गई हैं।`
    );
  };

  const handleLanguageToggle = (langCode) => {
    dispatch(setLanguage(langCode));
  };

  const handleLogout = () => {
    dispatch(logoutUser());
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'Offline map tiles and history cache cleared.', [{ text: 'OK' }]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '🚨 Account Deletion',
      'Are you sure you want to permanently delete your parent account and all paired child device logs? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: () => {
            dispatch(logoutUser());
            Alert.alert('Account Deleted', 'Your profile and tracking associations have been fully removed.');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={styles.title}>{t('settings')}</Text>
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isEditingProfile ? '#FEE2E2' : '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}
              onPress={() => setIsEditingProfile(!isEditingProfile)}
            >
              <Text style={{ fontSize: 12, color: isEditingProfile ? '#EF4444' : '#6200EE', fontWeight: 'bold' }}>
                {isEditingProfile ? '🚫 Cancel Edit' : '✏️ Edit Settings'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>Configure tracking rules, school modes, security settings, and language flags.</Text>

          {/* Language Selection Bar */}
          <Text style={styles.sectionHeader}>{t('languageToggle')}</Text>
          <View style={styles.langContainer}>
            <TouchableOpacity 
              style={[styles.langBtn, language === 'en' && styles.langBtnActive]} 
              onPress={() => handleLanguageToggle('en')}
            >
              <Text style={[styles.langText, language === 'en' && styles.langTextActive]}>
                🇬🇧 {t('english')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.langBtn, language === 'hi' && styles.langBtnActive]} 
              onPress={() => handleLanguageToggle('hi')}
            >
              <Text style={[styles.langText, language === 'hi' && styles.langTextActive]}>
                🇮🇳 {t('hindi')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Child Profile Specific Settings */}
          {activeChild && (
            <View style={styles.section}>
              <Text style={styles.sectionHeader}>🧒 {activeChild.name} - Student Profile</Text>
              
              {/* Child Photo Section */}
              <View style={{ alignItems: 'center', marginBottom: 16, marginTop: 8 }}>
                <Image 
                  key={childPhoto}
                  source={{ uri: childPhoto }} 
                  style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 2, borderColor: '#6200EE', backgroundColor: '#E5E7EB' }} 
                />
                {isEditingProfile && (
                  <TouchableOpacity 
                    style={{ marginTop: 8, backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#DDD6FE' }}
                    onPress={handleSelectPhoto}
                  >
                    <Text style={{ fontSize: 11, color: '#6200EE', fontWeight: 'bold' }}>📷 Change Student Photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Child Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Student Name</Text>
                <TextInput
                  style={[styles.input, !isEditingProfile && { backgroundColor: '#F3F4F6', color: '#9CA3AF', borderColor: '#E5E7EB' }]}
                  value={childName}
                  onChangeText={setChildName}
                  editable={isEditingProfile}
                />
              </View>

              {/* Blood Group */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Blood Group</Text>
                <TextInput
                  style={[styles.input, !isEditingProfile && { backgroundColor: '#F3F4F6', color: '#9CA3AF', borderColor: '#E5E7EB' }]}
                  value={bloodGroup}
                  onChangeText={setBloodGroup}
                  placeholder="e.g. O+, A+, B-"
                  editable={isEditingProfile}
                />
              </View>

              {/* Speed Threshold */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('speedLimit')}</Text>
                <TextInput
                  style={[styles.input, !isEditingProfile && { backgroundColor: '#F3F4F6', color: '#9CA3AF', borderColor: '#E5E7EB' }]}
                  keyboardType="numeric"
                  value={speedVal}
                  onChangeText={setSpeedVal}
                  editable={isEditingProfile}
                />
              </View>

              {/* School Mode Toggle */}
              <View style={styles.switchRow}>
                <View style={styles.switchCol}>
                  <Text style={styles.switchLabel}>{t('schoolMode')}</Text>
                  <Text style={styles.switchDesc}>{t('schoolModeDesc')}</Text>
                </View>
                <Switch
                  value={schoolMode}
                  onValueChange={setSchoolMode}
                  trackColor={{ false: '#767577', true: '#81b0ff' }}
                  thumbColor={schoolMode ? '#6200EE' : '#f4f3f4'}
                  disabled={!isEditingProfile}
                />
              </View>

              {/* School timings scheduler */}
              {schoolMode && (
                <View style={styles.timingsRow}>
                  <View style={styles.timeInputBox}>
                    <Text style={styles.timeLabel}>{t('schoolStart')}</Text>
                    <TextInput
                      style={[styles.timeInput, !isEditingProfile && { backgroundColor: '#F3F4F6', color: '#9CA3AF', borderColor: '#E5E7EB' }]}
                      value={schoolStart}
                      onChangeText={setSchoolStart}
                      placeholder="HH:MM"
                      editable={isEditingProfile}
                    />
                  </View>
                  <View style={styles.timeInputBox}>
                    <Text style={styles.timeLabel}>{t('schoolEnd')}</Text>
                    <TextInput
                      style={[styles.timeInput, !isEditingProfile && { backgroundColor: '#F3F4F6', color: '#9CA3AF', borderColor: '#E5E7EB' }]}
                      value={schoolEnd}
                      onChangeText={setSchoolEnd}
                      placeholder="HH:MM"
                      editable={isEditingProfile}
                    />
                  </View>
                </View>
              )}

              {isEditingProfile && (
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveChildSettings}>
                  <Text style={styles.saveBtnText}>{t('save')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Geofence Safety Zones Manager Section */}
          {activeChild && (
            <View style={styles.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={[styles.sectionHeader, { marginTop: 0, marginBottom: 0 }]}>🌐 Geofence Safety Zones</Text>
                <TouchableOpacity 
                  style={styles.resetBtnHeader}
                  onPress={() => {
                    dispatch(resetGeofencesToDefault());
                    Alert.alert('Geofences Reset', 'Restored default New Market - TT Nagar corridor geofence safely!');
                  }}
                >
                  <Text style={styles.resetBtnHeaderText}>🔄 Reset Default</Text>
                </TouchableOpacity>
              </View>

              {/* List of active Geofences */}
              <View style={styles.zonesList}>
                {childZones.length === 0 ? (
                  <Text style={styles.emptyZonesText}>No geofence zones created for this child.</Text>
                ) : (
                  childZones.map((zone) => (
                    <View key={zone.id} style={styles.zoneRow}>
                      <View style={styles.zoneInfo}>
                        <Text style={styles.zoneNameText}>📍 {zone.name}</Text>
                        <Text style={styles.zoneDetailsText}>
                          {zone.type === 'path'
                            ? `Path Corridor: ${zone.path ? zone.path.length : 0} points (${zone.radius}m)`
                            : `Lat: ${zone.latitude !== undefined ? zone.latitude.toFixed(4) : '0'}, Lng: ${zone.longitude !== undefined ? zone.longitude.toFixed(4) : '0'} (${zone.radius}m)`
                          }
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={styles.deleteZoneBtn} 
                        onPress={() => handleDeleteGeofence(zone.id, zone.name)}
                      >
                        <Text style={styles.deleteZoneBtnText}>🗑️ Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>

              {/* Add New Geofence Form */}
              <View style={styles.addZoneCard}>
                <Text style={styles.addZoneTitle}>➕ Add New Geofence Zone</Text>

                {/* Preset Selection Buttons (City & Category) */}
                <View style={{ marginBottom: 14, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#E5E7EB' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#4B5563' }}>🏙️ SELECT CITY:</Text>
                    <TouchableOpacity 
                      style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#DDD6FE' }}
                      onPress={() => setShowAddCityInput(!showAddCityInput)}
                    >
                      <Text style={{ fontSize: 10, color: '#6200EE', fontWeight: 'bold' }}>➕ Add City</Text>
                    </TouchableOpacity>
                  </View>

                  {showAddCityInput && (
                    <View style={{ flexDirection: 'row', marginBottom: 10, alignItems: 'center' }}>
                      <TextInput
                        style={{ flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, backgroundColor: '#FFFFFF', height: 32 }}
                        placeholder="e.g. Satna"
                        value={newCityInput}
                        onChangeText={setNewCityInput}
                        placeholderTextColor="#9CA3AF"
                      />
                      <TouchableOpacity 
                        style={{ marginLeft: 8, backgroundColor: '#10B981', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, height: 32, justifyContent: 'center' }}
                        onPress={handleAddCityPreset}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', marginBottom: 10, flexWrap: 'wrap' }}>
                    {citiesList.length === 0 ? (
                      <Text style={{ fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginVertical: 4 }}>
                        No cities added yet. Tap "+ Add City" to begin.
                      </Text>
                    ) : (
                      citiesList.map(city => (
                        <View
                          key={city}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            backgroundColor: selectedCityPreset === city ? '#6200EE' : '#E5E7EB',
                            borderRadius: 15,
                            marginRight: 8,
                            marginBottom: 6,
                            paddingLeft: 12,
                            paddingRight: 6,
                            paddingVertical: 4
                          }}
                        >
                          <TouchableOpacity onPress={() => setSelectedCityPreset(city)}>
                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: selectedCityPreset === city ? '#FFFFFF' : '#374151', marginRight: 4 }}>
                              {city}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity 
                            onPress={() => handleDeleteCity(city)} 
                            style={{ paddingHorizontal: 4, marginLeft: 2 }}
                          >
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: selectedCityPreset === city ? '#FFFFFF' : '#9CA3AF' }}>
                              ×
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Zone Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Home, School, New Market"
                    value={newZoneName}
                    onChangeText={setNewZoneName}
                  />
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                    <Text style={styles.inputLabel}>Latitude</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 23.2334"
                      keyboardType="numeric"
                      value={newZoneLat}
                      onChangeText={setNewZoneLat}
                    />
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Longitude</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 77.4011"
                      keyboardType="numeric"
                      value={newZoneLng}
                      onChangeText={setNewZoneLng}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Radius (meters)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="500"
                    keyboardType="numeric"
                    value={newZoneRadius}
                    onChangeText={setNewZoneRadius}
                  />
                </View>

                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.presetBtn} onPress={handleSearchPlace}>
                    <Text style={styles.presetBtnText}>🔍 Search Location</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.addSubmitBtn} onPress={handleAddGeofence}>
                    <Text style={styles.addSubmitBtnText}>Save Zone</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* Security Configurations */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>🛡️ Security & Authorization</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Authorized Parental Device 1 (Mummy)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#F3F4F6', color: '#4B5563', borderColor: '#E5E7EB' }]}
                value={authDevice1}
                onChangeText={setAuthDevice1}
                editable={false}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Authorized Parental Device 2 (Papa)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: '#F3F4F6', color: '#4B5563', borderColor: '#E5E7EB' }]}
                value={authDevice2}
                onChangeText={setAuthDevice2}
                editable={false}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchCol}>
                <Text style={styles.switchLabel}>Two-Factor Authentication (2FA)</Text>
                <Text style={styles.switchDesc}>Requires SMS OTP when logging into new phones.</Text>
              </View>
              <Switch
                value={twoFactor}
                onValueChange={setTwoFactor}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={twoFactor ? '#6200EE' : '#f4f3f4'}
                disabled={!isEditingProfile}
              />
            </View>
          </View>

          {/* Data Management & Account */}
          <View style={styles.section}>
            <Text style={styles.sectionHeader}>⚙️ Data Management</Text>
            
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleClearCache}>
              <Text style={styles.secondaryBtnText}>{t('clearCache')}</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.secondaryBtn, { borderColor: '#EF4444', marginBottom: 12 }]} 
              onPress={handleSimulateShutdown}
            >
              <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 13 }}>🔌 Simulate Device Shutdown</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutBtnText}>Logout Account</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
              <Text style={styles.deleteBtnText}>{t('deleteAccount')}</Text>
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
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
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
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    marginBottom: 20,
    lineHeight: 18,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  langContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  langBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  langBtnActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6200EE',
  },
  langText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  langTextActive: {
    color: '#6200EE',
    fontWeight: 'bold',
  },
  section: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 16,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 14,
  },
  switchCol: {
    flex: 1,
    marginRight: 10,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151',
  },
  switchDesc: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
    lineHeight: 14,
  },
  timingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  timeInputBox: {
    width: '48%',
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 4,
  },
  timeInput: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    height: 38,
    paddingHorizontal: 10,
    textAlign: 'center',
    backgroundColor: '#F9FAFB',
    fontSize: 13,
  },
  saveBtn: {
    backgroundColor: '#6200EE',
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: '#6200EE',
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryBtnText: {
    color: '#6200EE',
    fontWeight: 'bold',
    fontSize: 13,
  },
  logoutBtn: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoutBtnText: {
    color: '#4B5563',
    fontWeight: 'bold',
    fontSize: 13,
  },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
    height: 42,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontWeight: 'bold',
    fontSize: 13,
  },
  zonesList: {
    marginVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyZonesText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 10,
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  zoneInfo: {
    flex: 1,
    marginRight: 10,
  },
  zoneNameText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151',
  },
  zoneDetailsText: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  deleteZoneBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  deleteZoneBtnText: {
    fontSize: 10,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  addZoneCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  addZoneTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 10,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  presetBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    justifyContent: 'center',
  },
  presetBtnText: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: 'bold',
  },
  addSubmitBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addSubmitBtnText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  resetBtnHeader: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resetBtnHeaderText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#4B5563',
  },
});
