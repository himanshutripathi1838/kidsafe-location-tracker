import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Switch, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDispatch, useSelector } from 'react-redux';
import { 
  startEditSession, 
  verifyEditSessionOtp, 
  endEditSession, 
  reorderContactsLocal, 
  saveContactLocal, 
  deleteContactLocal 
} from '../redux/slices/contactSlice';
import { getTranslation } from '../utils/localization';
import * as Notifications from 'expo-notifications';

export default function ContactsScreen() {
  const dispatch = useDispatch();
  const { language } = useSelector((state) => state.auth);
  const { selectedChildId, children } = useSelector((state) => state.child);
  const { contacts, editSession, error } = useSelector((state) => state.contact);

  const activeChild = children.find(c => c.id === selectedChildId) || children[0];
  const childContacts = contacts[activeChild?.id] || [];

  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);

  // Form Fields for Add/Edit
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  
  // Custom permissions state
  const [perms, setPerms] = useState({
    alert_sos: true,
    alert_geofence: true,
    alert_speed: true,
    alert_battery: true,
    alert_device_off: true,
    alert_tamper: true
  });

  const t = (key) => getTranslation(language, key);

  // Audit Logs Mock
  const [auditLogs, setAuditLogs] = useState([
    { timestamp: new Date(Date.now() - 3600000 * 2).toLocaleString(), detail: 'Vikram Singh updated phone number.' },
    { timestamp: new Date(Date.now() - 3600000 * 24).toLocaleString(), detail: 'Added Ramesh Singh (Grandfather) to secondary contacts.' }
  ]);

  const handleStartUnlock = async () => {
    const code = '1234';
    setGeneratedOtp(code);

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "🔑 KidsSafe Verification OTP",
          body: `Verification code to edit contacts is: ${code}. Sent to primary number +91 70679 91838.`,
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.MAX,
          channelId: 'emergency-alerts',
        },
        trigger: null,
      });

      Alert.alert(
        "🔑 OTP Sent!",
        `A 4-digit verification code has been dispatched to primary number +91 70679 91838. Please enter the OTP (1234) to unlock the edit session.`
      );
    } catch (err) {
      console.log('Error triggering OTP notification:', err.message);
    }

    dispatch(startEditSession({ childId: activeChild.id }));
  };

  const handleVerifyOtp = () => {
    if (!otp) {
      Alert.alert(t('alert'), 'Please enter the OTP');
      return;
    }

    if (otp !== generatedOtp) {
      Alert.alert(
        "Verification Failed",
        "The verification code you entered is invalid. Please check the notification received on +91 70679 91838."
      );
      return;
    }

    dispatch(verifyEditSessionOtp({ otp: '1234' }))
      .unwrap()
      .then(() => {
        setOtp('');
        setAuditLogs(prev => [
          { timestamp: new Date().toLocaleString(), detail: 'Edit session unlocked via OTP verification.' },
          ...prev
        ]);
      })
      .catch((err) => {
        Alert.alert(t('alert'), err);
      });
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const list = [...childContacts];
    const temp = list[index];
    list[index] = list[index - 1];
    list[index - 1] = temp;
    dispatch(reorderContactsLocal({ childId: activeChild.id, reorderedList: list }));
  };

  const handleMoveDown = (index) => {
    if (index === childContacts.length - 1) return;
    const list = [...childContacts];
    const temp = list[index];
    list[index] = list[index + 1];
    list[index + 1] = temp;
    dispatch(reorderContactsLocal({ childId: activeChild.id, reorderedList: list }));
  };

  const handleSaveContact = () => {
    if (!name.trim() || !phone.trim() || !relationship.trim()) {
      Alert.alert(t('alert'), 'Please fill in all mandatory fields');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const corePhone = (cleanPhone.startsWith('91') && cleanPhone.length === 12) 
      ? cleanPhone.substring(2) 
      : cleanPhone;

    if (corePhone.length !== 10) {
      Alert.alert(
        language === 'en' ? 'Invalid Phone Number' : 'अमान्य फोन नंबर',
        language === 'en' 
          ? 'Please enter a valid 10-digit phone number.' 
          : 'कृपया एक वैध 10-अंकीय फोन नंबर दर्ज करें.'
      );
      return;
    }

    // Validation: Max 10 contacts total rule for device whitelist
    if (!selectedContact && childContacts.length >= 10) {
      Alert.alert(
        language === 'en' ? 'Limit Exceeded (Max 10)' : 'सीमा समाप्त (अधिकतम 10)',
        language === 'en' 
          ? 'Maximum limit of 10 authorized numbers reached for this device. To add an 11th number, you must delete an existing contact first.' 
          : 'इस डिवाइस के लिए अधिकतम 10 नंबरों की सीमा पूरी हो गई है! 11वां नंबर जोड़ने के लिए आपको पहले 1 पुराना संपर्क हटाना (delete) होगा.'
      );
      return;
    }

    // Validation: Max 2 Primary contacts rule for SOS outgoing calls
    const primaryCount = childContacts.filter(c => c.is_primary && c.id !== selectedContact?.id).length;
    if (isPrimary && primaryCount >= 2) {
      Alert.alert(
        language === 'en' ? 'Primary Contacts Limit' : 'प्राथमिक संपर्क सीमा',
        language === 'en'
          ? 'Device can only make outgoing SOS calls to 2 Primary numbers (Slot 1 & Slot 2).'
          : 'डिवाइस केवल 2 प्राथमिक नंबरों (स्लॉट 1 और स्लॉट 2) पर ही आउटगोइंग SOS कॉल कर सकता है.'
      );
      return;
    }

    const contactData = {
      id: selectedContact?.id || `con-${Date.now()}`,
      name,
      phone,
      relationship,
      is_primary: isPrimary,
      call_priority: isPrimary ? primaryCount + 1 : 0,
      ...perms
    };

    dispatch(saveContactLocal({ childId: activeChild.id, contact: contactData }));
    
    setAuditLogs(prev => [
      { timestamp: new Date().toLocaleString(), detail: `${selectedContact ? 'Updated' : 'Added'} contact: ${name} (${relationship}).` },
      ...prev
    ]);

    // Reset Form
    setName('');
    setPhone('');
    setRelationship('');
    setIsPrimary(false);
    setPerms({
      alert_sos: true,
      alert_geofence: true,
      alert_speed: true,
      alert_battery: true,
      alert_device_off: true,
      alert_tamper: true
    });
    setSelectedContact(null);
    setShowAddForm(false);
  };

  const handleDelete = (contactId, contactName) => {
    Alert.alert(
      'Delete Contact',
      `Are you sure you want to remove ${contactName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            dispatch(deleteContactLocal({ childId: activeChild.id, contactId }));
            setAuditLogs(prev => [
              { timestamp: new Date().toLocaleString(), detail: `Deleted contact: ${contactName}.` },
              ...prev
            ]);
          }
        }
      ]
    );
  };

  const handleTestNotification = (type, name) => {
    Alert.alert(
      'System Test',
      `Successfully simulated ${type} trigger to ${name}. Message packet queued.`,
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Full Width Top Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
            <Text style={{ fontSize: 18 }}>📞</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Emergency Contacts</Text>
            <Text style={styles.headerSubtitle}>Safety numbers & SOS rules ({activeChild?.name})</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Hardware Device Limits Rules Banner */}

          {/* Hardware Device Limits Rules Banner */}
          <View style={styles.ruleBox}>
            <Text style={styles.ruleTitle}>📱 Device Hardware Calling Rules ({activeChild?.name})</Text>
            <Text style={styles.ruleText}>
              • <Text style={{fontWeight: 'bold'}}>Outbound Calls (Device to Parent):</Text> Max 2 Primary Numbers (Slot 1 & Slot 2). SOS triggers will call these 2 numbers.
            </Text>
            <Text style={styles.ruleText}>
              • <Text style={{fontWeight: 'bold'}}>Inbound Calls (Whitelisted to Device):</Text> Max 10 Numbers allowed. Current count: <Text style={{fontWeight: 'bold', color: childContacts.length >= 10 ? '#DC2626' : '#059669'}}>{childContacts.length}/10</Text>.
            </Text>
            {childContacts.length >= 10 && (
              <Text style={[styles.ruleText, {color: '#DC2626', fontWeight: 'bold', marginTop: 4}]}>
                ⚠️ 10 contacts limit reached! Delete an existing contact before adding an 11th number.
              </Text>
            )}
          </View>

          {/* Locked vs Unlocked Session State */}
          {!editSession?.otp_verified ? (
            <View style={styles.lockBanner}>
              <Text style={styles.lockIcon}>🔒 Config Panel Locked</Text>
              {!editSession?.active ? (
                <TouchableOpacity style={styles.unlockBtn} onPress={handleStartUnlock}>
                  <Text style={styles.unlockBtnText}>Request OTP to Edit</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.otpRow}>
                  <TextInput
                    style={styles.otpInput}
                    placeholder="Enter OTP (1234)"
                    keyboardType="number-pad"
                    value={otp}
                    onChangeText={setOtp}
                    maxLength={6}
                  />
                  <TouchableOpacity style={styles.verifyBtn} onPress={handleVerifyOtp}>
                    <Text style={styles.verifyBtnText}>{t('verify')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.unlockBanner}>
              <Text style={styles.unlockIcon}>🔓 Configuration Unlocked (5 min window)</Text>
              <TouchableOpacity style={styles.lockBtn} onPress={() => dispatch(endEditSession())}>
                <Text style={styles.lockBtnText}>Save & Lock</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Form to Add / Edit Contacts */}
          {editSession?.otp_verified && (
            <View style={styles.formContainer}>
              {childContacts.length >= 10 && !selectedContact ? (
                <View style={{ padding: 16, backgroundColor: '#FEF2F2', alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#DC2626', fontWeight: 'bold', textAlign: 'center' }}>
                    ⚠️ Contacts Whitelist Full (10/10)
                  </Text>
                  <Text style={{ fontSize: 11, color: '#EF4444', textAlign: 'center', marginTop: 4 }}>
                    Maximum limit of 10 numbers reached. Delete an existing contact to add a new number.
                  </Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity 
                    style={styles.toggleFormHeader}
                    onPress={() => setShowAddForm(!showAddForm)}
                  >
                    <Text style={styles.formTitle}>
                      {showAddForm ? '▲ Close Editor' : '✚ Add / Edit Emergency Contact'}
                    </Text>
                  </TouchableOpacity>

                  {showAddForm && (
                    <View style={styles.formFields}>
                      <TextInput
                        style={styles.input}
                        placeholder="Contact Name"
                        value={name}
                        onChangeText={setName}
                      />
                  <TextInput
                    style={styles.input}
                    placeholder="Phone Number (+91 ...)"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Relationship (e.g. Mother, Uncle, Neighbor)"
                    value={relationship}
                    onChangeText={setRelationship}
                  />

                  {/* Primary Toggle */}
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Designate as Primary Contact</Text>
                    <Switch
                      value={isPrimary}
                      onValueChange={setIsPrimary}
                      trackColor={{ false: '#767577', true: '#81b0ff' }}
                      thumbColor={isPrimary ? '#6200EE' : '#f4f3f4'}
                    />
                  </View>

                  {/* Custom Permission Checkboxes */}
                  <Text style={styles.permissionsHeader}>Custom Alert Permissions:</Text>
                  <View style={styles.permsGrid}>
                    {Object.keys(perms).map((key) => (
                      <TouchableOpacity 
                        key={key} 
                        style={styles.checkboxItem}
                        onPress={() => setPerms(prev => ({ ...prev, [key]: !prev[key] }))}
                      >
                        <Text style={styles.checkboxIcon}>
                          {perms[key] ? '☑' : '☐'}
                        </Text>
                        <Text style={styles.checkboxLabel}>
                          {key.replace('alert_', '').toUpperCase().replace('_', ' ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TouchableOpacity style={styles.saveBtn} onPress={handleSaveContact}>
                    <Text style={styles.saveBtnText}>Save Configuration</Text>
                  </TouchableOpacity>
                </View>
              )}
                </>
              )}
            </View>
          )}

          {/* Contacts List */}
          <Text style={styles.sectionHeader}>Contacts Hierarchy ({childContacts.length}/10)</Text>
          {childContacts.length === 0 ? (
            <Text style={styles.emptyText}>No emergency contacts added yet.</Text>
          ) : (
            childContacts.map((contact, index) => (
              <View 
                key={contact.id} 
                style={[
                  styles.contactCard,
                  contact.is_primary ? styles.primaryCard : styles.secondaryCard
                ]}
              >
                <View style={styles.contactHeader}>
                  <View style={styles.contactDetails}>
                    <View style={styles.row}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <View style={[styles.badge, contact.is_primary ? styles.badgePrimary : styles.badgeSecondary]}>
                        <Text style={styles.badgeText}>
                          {contact.is_primary ? 'Primary' : 'Secondary'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.contactSub}>{contact.relationship} • {contact.phone}</Text>
                  </View>

                  {/* Up / Down Reordering Controls */}
                  {editSession?.otp_verified && (
                    <View style={styles.reorderCtrls}>
                      <TouchableOpacity style={styles.reorderBtn} onPress={() => handleMoveUp(index)}>
                        <Text style={styles.reorderArrow}>▲</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.reorderBtn} onPress={() => handleMoveDown(index)}>
                        <Text style={styles.reorderArrow}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Permissions Summaries */}
                <View style={styles.permsSummary}>
                  <Text style={styles.permsLabel}>Alerts: </Text>
                  <Text style={styles.permsList}>
                    {Object.keys(contact)
                      .filter(k => k.startsWith('alert_') && contact[k] === true)
                      .map(k => k.replace('alert_', '').toUpperCase())
                      .join(', ') || 'NONE'}
                  </Text>
                </View>

                {/* Action Buttons (Test SMS / Call, Edit, Delete) */}
                <View style={styles.contactActions}>
                  <TouchableOpacity 
                    style={styles.testBtn} 
                    onPress={() => handleTestNotification('SMS', contact.name)}
                  >
                    <Text style={styles.testBtnText}>✉ Test SMS</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.testBtn} 
                    onPress={() => handleTestNotification('Voice Call', contact.name)}
                  >
                    <Text style={styles.testBtnText}>📞 Test Call</Text>
                  </TouchableOpacity>

                  {editSession?.otp_verified && (
                    <>
                      <TouchableOpacity 
                        style={styles.editBtn} 
                        onPress={() => {
                          setSelectedContact(contact);
                          setName(contact.name);
                          setPhone(contact.phone);
                          setRelationship(contact.relationship);
                          setIsPrimary(contact.is_primary);
                          setPerms({
                            alert_sos: contact.alert_sos,
                            alert_geofence: contact.alert_geofence,
                            alert_speed: contact.alert_speed,
                            alert_battery: contact.alert_battery,
                            alert_device_off: contact.alert_device_off,
                            alert_tamper: contact.alert_tamper
                          });
                          setShowAddForm(true);
                        }}
                      >
                        <Text style={styles.editBtnText}>✏ Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.deleteBtn} 
                        onPress={() => handleDelete(contact.id, contact.name)}
                      >
                        <Text style={styles.deleteBtnText}>🗑 Delete</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            ))
          )}

          {/* Audit Logs Section */}
          <View style={styles.auditContainer}>
            <Text style={styles.auditHeader}>🛡️ Security Change Audit Trail</Text>
            {auditLogs.map((log, idx) => (
              <View key={idx} style={styles.auditLogItem}>
                <Text style={styles.auditLogTime}>{log.timestamp}</Text>
                <Text style={styles.auditLogDetail}>{log.detail}</Text>
              </View>
            ))}
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
    marginBottom: 20,
    lineHeight: 18,
  },
  lockBanner: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  lockIcon: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D97706',
    marginBottom: 10,
  },
  unlockBtn: {
    backgroundColor: '#D97706',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  unlockBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  otpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-between',
  },
  otpInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    flex: 1,
    marginRight: 10,
    textAlign: 'center',
    fontSize: 15,
  },
  verifyBtn: {
    backgroundColor: '#D97706',
    height: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8,
  },
  verifyBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  unlockBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  unlockIcon: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#059669',
    flex: 1,
    marginRight: 8,
  },
  lockBtn: {
    backgroundColor: '#059669',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  lockBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  formContainer: {
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
  },
  toggleFormHeader: {
    backgroundColor: '#F9FAFB',
    padding: 14,
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#E5E7EB',
  },
  formTitle: {
    fontWeight: 'bold',
    color: '#4B5563',
    fontSize: 14,
  },
  formFields: {
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2937',
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  permissionsHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#4B5563',
    marginTop: 10,
    marginBottom: 8,
  },
  permsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    marginBottom: 8,
  },
  checkboxIcon: {
    fontSize: 18,
    color: '#6200EE',
    marginRight: 6,
  },
  checkboxLabel: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: '#6200EE',
    height: 46,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 12,
  },
  emptyText: {
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 16,
  },
  contactCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  primaryCard: {
    backgroundColor: '#F5F3FF',
    borderColor: '#C7D2FE',
  },
  secondaryCard: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  contactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactDetails: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  badge: {
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 8,
    marginLeft: 8,
  },
  badgePrimary: {
    backgroundColor: '#DDD6FE',
  },
  badgeSecondary: {
    backgroundColor: '#E5E7EB',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  contactSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  reorderCtrls: {
    flexDirection: 'row',
  },
  reorderBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  reorderArrow: {
    fontSize: 12,
    color: '#4B5563',
  },
  permsSummary: {
    flexDirection: 'row',
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  permsLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#9CA3AF',
  },
  permsList: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  contactActions: {
    flexDirection: 'row',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 10,
  },
  testBtn: {
    marginRight: 10,
  },
  testBtnText: {
    fontSize: 11,
    color: '#6200EE',
    fontWeight: 'bold',
  },
  editBtn: {
    marginLeft: 'auto',
    marginRight: 12,
  },
  editBtnText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: 'bold',
  },
  deleteBtn: {
    marginRight: 4,
  },
  deleteBtnText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: 'bold',
  },
  auditContainer: {
    borderTopWidth: 1.5,
    borderTopColor: '#E5E7EB',
    marginTop: 20,
    paddingTop: 16,
  },
  auditHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4B5563',
    marginBottom: 10,
  },
  auditLogItem: {
    marginVertical: 4,
  },
  auditLogTime: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  auditLogDetail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  ruleBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1E40AF',
    marginBottom: 6,
  },
  ruleText: {
    fontSize: 12,
    color: '#1E3A8A',
    marginVertical: 2,
  },
});
