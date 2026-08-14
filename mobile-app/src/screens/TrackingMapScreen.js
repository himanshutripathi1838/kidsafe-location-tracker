import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, Dimensions, Platform, StatusBar } from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import MapView, { Marker, Polyline, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { updateLiveLocation } from '../redux/slices/locationSlice';
import { getTranslation } from '../utils/localization';

import telemetryService from '../services/telemetryService';

const { width, height } = Dimensions.get('window');

export default function TrackingMapScreen() {
  const dispatch = useDispatch();
  const mapRef = useRef(null);
  const { language } = useSelector((state) => state.auth);
  const { children, selectedChildId } = useSelector((state) => state.child);
  const { liveLocations, routeHistory } = useSelector((state) => state.location);
  const { zones } = useSelector((state) => state.geofence);

  const selectedChild = children.find(c => c.id === selectedChildId) || children[0];
  const currentLocation = liveLocations[selectedChild?.id];
  const historyPoints = routeHistory[selectedChild?.id] || [];
  const childZones = zones[selectedChild?.id] || [];

  const [mapType, setMapType] = useState('standard'); // standard, satellite, terrain
  const [followUser, setFollowUser] = useState(true);

  const t = (key) => getTranslation(language, key);

  // Start 100% Real-Time Live Sensor Telemetry on mount (no fake random numbers!)
  useEffect(() => {
    if (selectedChild?.id) {
      telemetryService.startRealTimeTelemetry(selectedChild.id);
    }
    return () => {
      telemetryService.stopRealTimeTelemetry();
    };
  }, [selectedChild?.id]);

  // Auto pan to child when coordinate updates
  useEffect(() => {
    if (followUser && currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }, 1000);
    }
  }, [currentLocation, followUser]);

  const [trailCoordinates, setTrailCoordinates] = useState([]);

  // Add coordinates to trailing path on update
  useEffect(() => {
    if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
      const newPt = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        timestamp: Date.now()
      };
      
      setTrailCoordinates(prev => {
        const last = prev[prev.length - 1];
        if (last && last.latitude === newPt.latitude && last.longitude === newPt.longitude) {
          return prev;
        }
        return [...prev, newPt];
      });
    }
  }, [currentLocation]);

  // Cleanup trail coordinates older than 30 seconds
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - 30000; // 30 seconds ago
      setTrailCoordinates(prev => prev.filter(pt => pt.timestamp >= cutoff));
    }, 1000);
    return () => clearInterval(cleanupInterval);
  }, []);

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

  // Color coding logic for route history lines:
  // We can group points into segments of same status and draw individual Polylines,
  // or draw simple color segments to represent Safe (Green), Medium (Yellow, speed > 20), Alert (Red, SOS points).
  const renderHistoryRoute = () => {
    if (historyPoints.length < 2) return null;

    // Split segments by color/safety type for rendering multiple colored lines
    const segments = [];
    let currentSegment = [historyPoints[0]];
    let currentType = getPointColorType(historyPoints[0], selectedChild.speed_threshold);

    for (let i = 1; i < historyPoints.length; i++) {
      const pt = historyPoints[i];
      const ptType = getPointColorType(pt, selectedChild.speed_threshold);
      
      if (ptType === currentType) {
        currentSegment.push(pt);
      } else {
        currentSegment.push(pt); // connect segment end to start of next
        segments.push({ points: currentSegment, type: currentType });
        currentSegment = [pt];
        currentType = ptType;
      }
    }
    segments.push({ points: currentSegment, type: currentType });

    return segments.map((seg, idx) => {
      let strokeColor = '#10B981'; // Green (Safe)
      if (seg.type === 'medium') strokeColor = '#F59E0B'; // Yellow (Medium / warning)
      if (seg.type === 'alert') strokeColor = '#EF4444'; // Red (Alert / SOS)

      return (
        <Polyline
          key={`seg-${idx}`}
          coordinates={seg.points}
          strokeWidth={4}
          strokeColor={strokeColor}
        />
      );
    });
  };

  const getPointColorType = (point, speedThreshold) => {
    if (point.isSosPoint) return 'alert';
    if (point.speed > speedThreshold) return 'medium';
    return 'safe';
  };

  const toggleMapType = () => {
    if (mapType === 'standard') setMapType('satellite');
    else if (mapType === 'satellite') setMapType('terrain');
    else setMapType('standard');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={styles.map}
          mapType={mapType}
          initialRegion={{
            latitude: currentLocation?.latitude || 28.6253,
            longitude: currentLocation?.longitude || 77.2155,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }}
        >
          {/* Geofence zones overlays */}
          {childZones.filter(z => z.is_active).map(zone => {
            if (zone.type === 'path') {
              return (
                <React.Fragment key={zone.id}>
                  {/* End of Road Route */}
                  <Marker
                    coordinate={zone.path[zone.path.length - 1]}
                    title="End: New Market"
                    pinColor="green"
                  />
                </React.Fragment>
              );
            }
            if (zone.type === 'line') {
              return (
                <React.Fragment key={zone.id}>
                  {/* Endpoint Markers */}
                  <Marker
                    coordinate={{ latitude: zone.latitude, longitude: zone.longitude }}
                    title="Start: New Market"
                    pinColor="green"
                  />
                </React.Fragment>
              );
            }
            return (
              <React.Fragment key={`zone-tracking-${zone.id}`}>
                {/* Circle Boundary */}
                <Circle
                  center={{ latitude: zone.latitude, longitude: zone.longitude }}
                  radius={zone.radius}
                  strokeColor={`${zone.color}AA`}
                  fillColor={`${zone.color}22`}
                  strokeWidth={2.5}
                />
                {/* Pin Marker for geofence */}
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

          {/* Dynamic 30-Second Rolling Trailing Trail */}
          {trailCoordinates && trailCoordinates.length > 1 && (
            <Polyline
              coordinates={trailCoordinates.map(pt => ({
                latitude: pt.latitude,
                longitude: pt.longitude
              }))}
              strokeColor="#6200EE"
              strokeWidth={5}
              lineCap="round"
              lineJoin="round"
            />
          )}

          {/* Child current marker */}
          {currentLocation && (
            <Marker
              coordinate={{
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
              }}
              rotation={currentLocation.course || 0}
              title={selectedChild?.name}
              description={`${t('speed')}: ${currentLocation.speed} km/h | ${t('battery')}: ${currentLocation.battery}%`}
            >
              <View style={styles.avatarMarker}>
                <View style={styles.pulseBorder} />
                <Text style={styles.markerEmoji}>🧒</Text>
              </View>
            </Marker>
          )}
        </MapView>

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

        {/* Floating Controls */}
        <View style={styles.floatingControls}>
          <TouchableOpacity style={styles.floatBtn} onPress={toggleMapType}>
            <Text style={styles.floatBtnText}>🗺️ {mapType.toUpperCase()}</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.floatBtn, followUser && styles.floatBtnActive]} 
            onPress={() => setFollowUser(!followUser)}
          >
            <Text style={[styles.floatBtnText, followUser && styles.floatBtnTextActive]}>
              🎯 {followUser ? 'Lock Child' : 'Free Camera'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Legend Map Indicators */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={styles.legendLabel}>Safe</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
            <Text style={styles.legendLabel}>Speed warning</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
            <Text style={styles.legendLabel}>SOS Trigger</Text>
          </View>
        </View>

        {/* Child Telemetry Card */}
        {currentLocation && (
          <View style={styles.telemetryCard}>
            <Text style={styles.childTitle}>
              {selectedChild?.name} • {currentLocation.mode || (currentLocation.speed > 5 ? 'Vehicle' : 'Walking')}
            </Text>
            <View style={styles.telemetryRow}>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryVal}>
                  {currentLocation.speed <= 5.0 ? '🚶' : currentLocation.speed <= 16.0 ? '🚲' : '🚌'} {currentLocation.speed} km/h
                </Text>
                <Text style={styles.telemetryLbl}>{t('speed')}</Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryVal}>{currentLocation.battery}%</Text>
                <Text style={styles.telemetryLbl}>{t('battery')}</Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryVal}>{currentLocation.network}</Text>
                <Text style={styles.telemetryLbl}>{t('network')}</Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryVal}>{currentLocation.status}</Text>
                <Text style={styles.telemetryLbl}>{t('status')}</Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0,
  },
  mapWrapper: {
    flex: 1,
    position: 'relative',
  },
  map: {
    width: width,
    height: height,
  },
  avatarMarker: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 8,
    borderWidth: 3,
    borderColor: '#6200EE',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  markerEmoji: {
    fontSize: 22,
  },
  pulseBorder: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#6200EE',
    opacity: 0.4,
  },
  floatingControls: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 5,
  },
  floatBtn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
    alignItems: 'center',
  },
  floatBtnActive: {
    backgroundColor: '#6200EE',
  },
  floatBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
  },
  floatBtnTextActive: {
    color: '#FFFFFF',
  },
  legend: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  legendLabel: {
    fontSize: 10,
    color: '#374151',
    fontWeight: '600',
  },
  telemetryCard: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  childTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telemetryItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  telemetryVal: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6200EE',
    textAlign: 'center',
  },
  telemetryLbl: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
});
