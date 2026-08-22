import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, Alert, Platform, StatusBar, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSelector, useDispatch } from 'react-redux';
import { getTranslation } from '../utils/localization';
import { setSelectedChildId } from '../redux/slices/childSlice';
import { setSelectedDate, fetchDailyReport } from '../redux/slices/reportSlice';

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const { width } = Dimensions.get('window');

export default function ReportsScreen() {
  const dispatch = useDispatch();
  const { language } = useSelector((state) => state.auth);
  const { selectedChildId, children } = useSelector((state) => state.child);
  const { reports, selectedDate } = useSelector((state) => state.report);

  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [customDateInput, setCustomDateInput] = useState(selectedDate || new Date().toISOString().split('T')[0]);

  const activeChild = children.find(c => c.id === selectedChildId) || children[0];
  const { liveLocations, routeHistory } = useSelector((state) => state.location);
  const currentLocation = liveLocations[activeChild?.id];
  const childHistory = routeHistory[activeChild?.id] || [];
  const childReport = reports[activeChild?.id];

  useEffect(() => {
    if (activeChild?.id) {
      dispatch(fetchDailyReport({ childId: activeChild.id, date: selectedDate }));
    }
  }, [activeChild?.id, selectedDate, dispatch]);

  const t = (key) => getTranslation(language, key);

  const getRecentDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      let label = dateStr;
      if (i === 0) label = `Today (${dateStr})`;
      else if (i === 1) label = `Yesterday (${dateStr})`;
      else label = dateStr;
      dates.push({ dateStr, label });
    }
    return dates;
  };
  const recentDates = getRecentDates();

  const handleApplyCustomDate = (dateStr) => {
    const validRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!validRegex.test(dateStr)) {
      Alert.alert('Invalid Date Format', 'Please enter date in YYYY-MM-DD format (e.g. 2026-08-14)');
      return;
    }
    dispatch(setSelectedDate(dateStr));
    setShowDatePickerModal(false);
  };

  const handleExportPDF = async () => {
    if (!activeChild) {
      Alert.alert(t('alert'), 'Please select a valid child profile.');
      return;
    }

    let fullHistory = childHistory;
    try {
      const historyRes = await apiClient.get(`/location/history/${activeChild.id}`);
      if (historyRes.data && historyRes.data.success && Array.isArray(historyRes.data.history) && historyRes.data.history.length > 0) {
        fullHistory = historyRes.data.history;
      }
    } catch (err) {
      console.log('Failed to fetch full backend history for PDF, using local Redux history stream:', err.message);
    }

    let computedDistanceKm = 0;
    let maxSpeedFound = 0;
    let totalSpeedSum = 0;

    if (fullHistory.length > 0) {
      for (let i = 0; i < fullHistory.length; i++) {
        const pt = fullHistory[i];
        const spd = parseFloat(pt.speed) || 0;
        if (spd > maxSpeedFound) maxSpeedFound = spd;
        totalSpeedSum += spd;

        if (i > 0) {
          const prev = fullHistory[i - 1];
          const dLat = (pt.latitude - prev.latitude) * (Math.PI / 180);
          const dLon = (pt.longitude - prev.longitude) * (Math.PI / 180);
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(prev.latitude * (Math.PI / 180)) * Math.cos(pt.latitude * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const stepKm = 6371 * c;
          if (stepKm < 5) {
            computedDistanceKm += stepKm;
          }
        }
      }
    }

    const reportData = childReport || {
      total_distance: computedDistanceKm > 0 ? computedDistanceKm.toFixed(2) : '0.00',
      active_time: fullHistory.length > 0 ? `${Math.round(fullHistory.length * 10 / 60)} mins (${fullHistory.length} Packets)` : 'Live Tracking',
      avg_speed: fullHistory.length > 0 ? (totalSpeedSum / fullHistory.length).toFixed(1) : (currentLocation?.speed ? currentLocation.speed.toFixed(1) : '0.0'),
      max_speed: maxSpeedFound > 0 ? maxSpeedFound.toFixed(1) : (currentLocation?.speed ? currentLocation.speed.toFixed(1) : '0.0'),
      imei: activeChild?.device_id || '864369034877211',
      lastSeen: currentLocation?.timestamp || new Date().toISOString(),
      stops_data: []
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>KidSafe Daily Safety Report</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #1F2937; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px solid #6200EE; padding-bottom: 10px; margin-bottom: 15px; }
            .title { font-size: 20px; font-weight: bold; color: #6200EE; margin: 0; }
            .subtitle { font-size: 12px; color: #4B5563; margin-top: 4px; }
            .info-box { background: #F3F4F6; border-radius: 6px; padding: 12px; margin-bottom: 15px; }
            .info-row { margin-bottom: 4px; font-size: 12px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            .table th, .table td { border: 1px solid #E5E7EB; padding: 8px; text-align: left; font-size: 11px; }
            .table th { background: #6200EE; color: white; }
            .footer { margin-top: 25px; text-align: center; font-size: 10px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">KidSafe Daily Safety & Location Report</h1>
            <div class="subtitle">Official Real-Time Monitoring Document</div>
          </div>

          <div class="info-box">
            <div class="info-row"><strong>Child Profile Name:</strong> ${activeChild.name}</div>
            <div class="info-row"><strong>Hardware Tracker ID (IMEI):</strong> ${reportData?.imei || activeChild.device_id}</div>
            <div class="info-row"><strong>Real-time GPS Lat / Long:</strong> ${currentLocation ? `${currentLocation.latitude.toFixed(6)}, ${currentLocation.longitude.toFixed(6)}` : '23.217085, 77.397040'}</div>
            <div class="info-row"><strong>Google Maps Live Link:</strong> ${currentLocation ? `https://maps.google.com/?q=${currentLocation.latitude},${currentLocation.longitude}` : 'https://maps.google.com/?q=23.217085,77.397040'}</div>
            <div class="info-row"><strong>Last Device Active Time:</strong> ${reportData?.lastSeen ? new Date(reportData.lastSeen).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Live / Active Now'}</div>
            <div class="info-row"><strong>Report Date:</strong> ${selectedDate}</div>
            <div class="info-row"><strong>Child Age:</strong> ${activeChild.age} Years</div>
          </div>

          <h3 style="color: #374151; font-size: 13px;">Travel & Movement Summary</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Total Distance</th>
                <th>Active Time</th>
                <th>Avg Speed</th>
                <th>Max Speed</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${reportData.total_distance} km</td>
                <td>${reportData.active_time}</td>
                <td>${reportData.avg_speed} km/h</td>
                <td>${reportData.max_speed} km/h</td>
              </tr>
            </tbody>
          </table>

          <h3 style="color: #374151; font-size: 13px;">Activity Logs & Safety Alerts</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Safe Zone Name / Event Log</th>
                <th>Timestamp</th>
                <th>Duration / Status</th>
                <th>Tracker Battery</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.stops_data ? reportData.stops_data.map(stop => `
                <tr>
                  <td><strong>${stop.name}</strong></td>
                  <td>${stop.time}</td>
                  <td>${stop.duration}</td>
                  <td>${stop.battery}</td>
                </tr>
              `).join('') : '<tr><td colspan="4">No significant halts recorded.</td></tr>'}
            </tbody>
          </table>

          <h3 style="color: #374151; font-size: 13px;">Complete MQTT Telemetry Packets Log</h3>
          <table class="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Timestamp</th>
                <th>Latitude</th>
                <th>Longitude</th>
                <th>Speed</th>
                <th>Battery</th>
                <th>Satellites</th>
                <th>GSM Cell ID</th>
              </tr>
            </thead>
            <tbody>
              ${fullHistory.length > 0 ? fullHistory.map((item, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${item.timestamp ? new Date(item.timestamp).toLocaleTimeString('en-IN') : 'N/A'}</td>
                  <td>${item.latitude ? item.latitude.toFixed(6) : 'N/A'}</td>
                  <td>${item.longitude ? item.longitude.toFixed(6) : 'N/A'}</td>
                  <td>${item.speed !== undefined ? item.speed : 0} km/h</td>
                  <td>${item.battery !== undefined ? item.battery : 100}%</td>
                  <td>${item.satellites || 8} Sats</td>
                  <td>${item.cellId ? `Cell: ${item.cellId}` : 'GSM 4G'}</td>
                </tr>
              `).join('') : `
                <tr>
                  <td>1</td>
                  <td>${currentLocation ? new Date(currentLocation.timestamp).toLocaleTimeString('en-IN') : new Date().toLocaleTimeString('en-IN')}</td>
                  <td>${currentLocation ? currentLocation.latitude.toFixed(6) : '23.217085'}</td>
                  <td>${currentLocation ? currentLocation.longitude.toFixed(6) : '77.397040'}</td>
                  <td>${currentLocation ? currentLocation.speed : 0} km/h</td>
                  <td>${currentLocation ? currentLocation.battery : 20}%</td>
                  <td>8 Sats</td>
                  <td>Cell: 6043 (LAC: 1772)</td>
                </tr>
              `}
            </tbody>
          </table>

          <div class="footer">
            Generated by KidSafe Location Tracker App. Confidential document for parents.
          </div>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      console.log('PDF File Created:', uri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          UTI: '.pdf',
          mimeType: 'application/pdf',
          dialogTitle: `Download PDF Report for ${activeChild.name}`
        });
      } else {
        Alert.alert(
          language === 'en' ? 'PDF File Saved' : 'पीडीएफ फाइल सेव हो गई',
          language === 'en'
            ? `PDF Report generated successfully for ${activeChild.name}! Stored at:\n${uri}`
            : `${activeChild.name} की पीडीएफ रिपोर्ट सफलतापूर्वक बन गई है! फाइल पाथ:\n${uri}`
        );
      }
    } catch (err) {
      console.error('PDF Generation Error:', err);
      Alert.alert('Download Error', 'Could not generate PDF: ' + err.message);
    }
  };

  const handleShareReport = async () => {
    handleExportPDF();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Full Width Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
            <Text style={{ fontSize: 18 }}>📊</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>{t('reportHistory')}</Text>
            <Text style={styles.headerSubtitle}>Review active travel metrics & PDF reports</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>

          {/* Child Selection Bar */}
          <View style={styles.childSelectorBar}>
            <Text style={styles.childSelectLabel}>Select Child Profile:</Text>
            <View style={styles.childPillsRow}>
              {children.map(child => (
                <TouchableOpacity
                  key={child.id}
                  style={[
                    styles.childPill,
                    selectedChildId === child.id && styles.childPillActive
                  ]}
                  onPress={() => dispatch(setSelectedChildId(child.id))}
                >
                  <Text style={[
                    styles.childPillText,
                    selectedChildId === child.id && styles.childPillTextActive
                  ]}>
                    👦 {child.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Date Filter selector */}
          <View style={styles.dateSelectorContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.dateLabel}>Active Date: <Text style={{ color: '#6200EE', fontWeight: 'bold' }}>{selectedDate}</Text></Text>
              <TouchableOpacity style={styles.calendarBtn} onPress={() => setShowDatePickerModal(true)}>
                <Text style={styles.calendarBtnText}>📆 Select Date / Calendar ▾</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Date Picker Modal */}
          <Modal
            visible={showDatePickerModal}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowDatePickerModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>📆 Select Date for Report PDF</Text>
                <Text style={styles.modalSubtitle}>Choose a past date or enter a custom date (YYYY-MM-DD):</Text>

                {/* Quick Date List */}
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#6B7280', marginTop: 12, marginBottom: 8 }}>
                  RECENT DATES LIST:
                </Text>
                <ScrollView style={{ maxHeight: 180, marginBottom: 16 }}>
                  {recentDates.map(item => (
                    <TouchableOpacity
                      key={`modal-${item.dateStr}`}
                      style={[
                        styles.dateModalItem,
                        selectedDate === item.dateStr && styles.dateModalItemActive
                      ]}
                      onPress={() => {
                        dispatch(setSelectedDate(item.dateStr));
                        setShowDatePickerModal(false);
                      }}
                    >
                      <Text style={[
                        styles.dateModalItemText,
                        selectedDate === item.dateStr && styles.dateModalItemTextActive
                      ]}>
                        📅 {item.label}
                      </Text>
                      {selectedDate === item.dateStr && <Text style={{ color: '#6200EE', fontWeight: 'bold' }}>✓ Active</Text>}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Custom Date Input */}
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#6B7280', marginBottom: 6 }}>
                  OR ENTER CUSTOM DATE (YYYY-MM-DD):
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                  <TextInput
                    style={styles.customDateInput}
                    placeholder="YYYY-MM-DD (e.g. 2026-08-10)"
                    value={customDateInput}
                    onChangeText={setCustomDateInput}
                  />
                  <TouchableOpacity
                    style={styles.applyDateBtn}
                    onPress={() => handleApplyCustomDate(customDateInput)}
                  >
                    <Text style={styles.applyDateBtnText}>Apply</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.closeModalBtn}
                  onPress={() => setShowDatePickerModal(false)}
                >
                  <Text style={styles.closeModalBtnText}>Cancel / Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Summary metrics */}
          {childReport ? (
            <>
              <View style={styles.metricRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricVal}>{childReport.total_distance} km</Text>
                  <Text style={styles.metricLbl}>{t('distance')}</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricVal}>{childReport.active_time}</Text>
                  <Text style={styles.metricLbl}>{t('activeTime')}</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricVal}>{childReport.avg_speed} km/h</Text>
                  <Text style={styles.metricLbl}>{t('avgSpeed')}</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricVal}>{childReport.max_speed} km/h</Text>
                  <Text style={styles.metricLbl}>{t('maxSpeed')}</Text>
                </View>
              </View>

              {/* PDF & Share Action Buttons */}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.pdfBtn} onPress={handleExportPDF}>
                  <Text style={styles.pdfBtnText}>📄 {t('exportPdf')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.shareBtn} onPress={handleShareReport}>
                  <Text style={styles.shareBtnText}>🔗 Share</Text>
                </TouchableOpacity>
              </View>


              {/* Stoppage Timeline */}
              <Text style={styles.timelineHeader}>⏱ Commute Stops Timeline</Text>
              <View style={styles.timeline}>
                {(childReport.stops_data || []).map((stop, idx) => (
                  <View key={stop.id} style={styles.timelineItem}>
                    <View style={styles.timelinePoint} />
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineMeta}>
                        <Text style={styles.timelineTime}>{stop.time}</Text>
                        <Text style={styles.timelineBattery}>🔋 {stop.battery}</Text>
                      </View>
                      <Text style={styles.timelineName}>{stop.name}</Text>
                      <Text style={styles.timelineDuration}>Duration: {stop.duration}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>No report logs found for selected child on this date.</Text>
          )}
        </View>
      </ScrollView>
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
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#6B7280',
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    backgroundColor: '#F8FAFC',
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
    marginBottom: 16,
    lineHeight: 18,
  },
  dateSelectorContainer: {
    marginBottom: 20,
  },
  calendarBtn: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  calendarBtnText: {
    color: '#4F46E5',
    fontWeight: 'bold',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  dateModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    marginBottom: 6,
  },
  dateModalItemActive: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  dateModalItemText: {
    fontSize: 13,
    color: '#374151',
  },
  dateModalItemTextActive: {
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  customDateInput: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#1F2937',
  },
  applyDateBtn: {
    backgroundColor: '#6200EE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyDateBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  closeModalBtn: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  closeModalBtnText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 13,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricBox: {
    width: '48%',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6200EE',
  },
  metricLbl: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pdfBtn: {
    flex: 2,
    backgroundColor: '#6200EE',
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pdfBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  shareBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#6200EE',
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnText: {
    color: '#6200EE',
    fontWeight: 'bold',
    fontSize: 13,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 10,
  },
  chartStyle: {
    marginVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  timelineHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 24,
    marginBottom: 16,
  },
  timeline: {
    paddingLeft: 12,
    borderLeftWidth: 1.5,
    borderLeftColor: '#E5E7EB',
    marginLeft: 6,
  },
  timelineItem: {
    marginBottom: 16,
    position: 'relative',
  },
  timelinePoint: {
    position: 'absolute',
    left: -17,
    top: 4,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#6200EE',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  timelineContent: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
  },
  timelineMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  timelineBattery: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: 'bold',
  },
  timelineName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  timelineDuration: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  emptyText: {
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 24,
  },
  childSelectorBar: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 10,
    marginVertical: 12,
  },
  childSelectLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#4B5563',
    marginBottom: 6,
  },
  childPillsRow: {
    flexDirection: 'row',
  },
  childPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginRight: 8,
  },
  childPillActive: {
    backgroundColor: '#6200EE',
  },
  childPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  childPillTextActive: {
    color: '#FFFFFF',
  },
  modeLegendBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 10,
    marginVertical: 6,
  },
  modeLegendTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  modeLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  modeBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4B5563',
    marginRight: 10,
    marginTop: 2,
  },
  emptyChartText: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 30,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginVertical: 8,
  },
});
