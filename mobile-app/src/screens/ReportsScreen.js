import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions, Alert, SafeAreaView, Platform, StatusBar, Modal, TextInput } from 'react-native';
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
    if (!activeChild || !childReport) {
      Alert.alert(t('alert'), 'No report data available to export.');
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>KidSafe Daily Safety Report - ${activeChild.name}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 24px; color: #1F2937; line-height: 1.5; }
            .header { text-align: center; border-bottom: 3px solid #6200EE; padding-bottom: 12px; margin-bottom: 20px; }
            .title { font-size: 22px; font-weight: bold; color: #6200EE; margin: 0; }
            .subtitle { font-size: 13px; color: #4B5563; margin-top: 4px; }
            .info-box { background: #F3F4F6; border-radius: 8px; padding: 14px; margin-bottom: 20px; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
            .metrics-grid { display: flex; justify-content: space-between; margin-bottom: 24px; }
            .metric-card { background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 8px; padding: 12px; text-align: center; width: 22%; }
            .metric-val { font-size: 18px; font-weight: bold; color: #1E40AF; }
            .metric-lbl { font-size: 11px; color: #3B82F6; margin-top: 4px; }
            .table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            .table th, .table td { border: 1px solid #E5E7EB; padding: 10px; text-align: left; font-size: 12px; }
            .table th { background: #6200EE; color: white; }
            .footer { margin-top: 36px; text-align: center; font-size: 11px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 12px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">🛡️ KidSafe Daily Safety & Location Report</h1>
            <div class="subtitle">Official IoT Real-Time Monitoring Document</div>
          </div>

          <div class="info-box">
            <div class="info-row"><strong>Child Profile Name:</strong> <span>${activeChild.name}</span></div>
            <div class="info-row"><strong>Hardware Tracker ID (IMEI):</strong> <span>${childReport?.imei || activeChild.device_id}</span></div>
            <div class="info-row"><strong>Last Device Active Time:</strong> <span>${childReport?.lastSeen ? new Date(childReport.lastSeen).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Live / Active Now'}</span></div>
            <div class="info-row"><strong>Report Date:</strong> <span>${selectedDate}</span></div>
            <div class="info-row"><strong>Child Age:</strong> <span>${activeChild.age} Years</span></div>
          </div>

          <h3 style="color: #374151; font-size: 14px;">📊 Travel & Movement Summary</h3>
          <div class="metrics-grid">
            <div class="metric-card">
              <div class="metric-val">${childReport.total_distance} km</div>
              <div class="metric-lbl">Total Distance</div>
            </div>
            <div class="metric-card">
              <div class="metric-val">${childReport.active_time}</div>
              <div class="metric-lbl">Active Time</div>
            </div>
            <div class="metric-card">
              <div class="metric-val">${childReport.avg_speed} km/h</div>
              <div class="metric-lbl">Avg Speed</div>
            </div>
            <div class="metric-card">
              <div class="metric-val">${childReport.max_speed} km/h</div>
              <div class="metric-lbl">Max Speed</div>
            </div>
          </div>

          <h3 style="color: #374151; font-size: 14px;">📋 Dynamic Activity Logs & Safety Alerts</h3>
          <table class="table">
            <thead>
              <tr>
                <th>Safe Zone Name / Activity Event Log</th>
                <th>Timestamp</th>
                <th>Duration / Status</th>
                <th>Tracker Battery</th>
              </tr>
            </thead>
            <tbody>
              ${childReport.stops_data ? childReport.stops_data.map(stop => `
                <tr>
                  <td><strong>${stop.name}</strong></td>
                  <td>${stop.time}</td>
                  <td>${stop.duration}</td>
                  <td>${stop.battery}</td>
                </tr>
              `).join('') : '<tr><td colspan="4">No significant halts recorded.</td></tr>'}
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          {/* Header */}
          <Text style={styles.title}>{t('reportHistory')}</Text>
          <Text style={styles.subtitle}>Review active travel metrics, speeds, and battery usage levels.</Text>

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
