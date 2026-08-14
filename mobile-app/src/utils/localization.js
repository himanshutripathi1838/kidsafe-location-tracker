// Localization utility supporting English and Hindi (Toggleable in Settings)

export const translations = {
  en: {
    welcome: 'Welcome Back',
    login: 'Login',
    register: 'Register',
    fullName: 'Full Name',
    phone: 'Phone Number',
    email: 'Email Address',
    otp: 'OTP Verification',
    enterOtp: 'Enter 4-digit OTP',
    verify: 'Verify & Login',
    sendOtp: 'Send OTP',
    signupPrompt: 'Don\'t have an account? Sign up',
    loginPrompt: 'Already have an account? Login',
    devicePairing: 'Pair Tracking Device',
    deviceId: 'Device ID (Hardware ID)',
    pairBtn: 'Pair Device',
    scanQr: 'Scan Device QR Code',
    
    // Dashboard & Map
    liveLocation: 'Live Tracking Map',
    lastPing: 'Last updated',
    battery: 'Battery',
    network: 'Network',
    speed: 'Speed',
    status: 'Status',
    safe: 'Safe',
    alert: 'Alert',
    activeAlerts: 'Active Alerts (Last 24 hrs)',
    distance: 'Distance',
    activeTime: 'Active Time',
    avgSpeed: 'Avg Speed',
    maxSpeed: 'Max Speed',
    stops: 'Stops',
    
    // Actions
    sosBtn: 'SOS ALERT',
    geofence: 'Geofences',
    callChild: 'Call Child',
    reportHistory: 'Reports',
    switchKids: 'Switch Child',
    resolved: 'Mark Resolved',
    resolvedNotes: 'Resolution Notes',
    
    // SOS
    sosTriggered: 'EMERGENCY SOS ALERT ACTIVATED',
    primaryCall: 'Auto-calling primary contacts...',
    callPapa: 'Call Papa',
    callMummy: 'Call Mummy',
    callPolice: 'Call Police (112)',
    callAmbulance: 'Ambulance (102)',
    
    // Geofencing
    zoneName: 'Zone Name',
    radius: 'Radius',
    color: 'Zone Color',
    enableEntry: 'Enable Entry Alert',
    enableExit: 'Enable Exit Alert',
    addZone: 'Add Safety Zone',
    editZone: 'Edit Safety Zone',
    
    // Contacts
    emergencyContacts: 'Emergency Contacts',
    primaryContacts: 'Primary (Auto-call on SOS)',
    secondaryContacts: 'Secondary (Push + SMS)',
    relationship: 'Relationship',
    alertPerms: 'Alert Permissions',
    editGatePrompt: 'Enter OTP to unlock contact edits',
    reorderContacts: 'Drag to reorder calling priority',
    testSms: 'Test SMS',
    testCall: 'Test Call',
    
    // Reports
    dailySummary: 'Daily Commute Summary',
    batteryGraph: 'Battery History (24 hrs)',
    speedGraph: 'Speed Timeline',
    exportPdf: 'Export PDF Report',
    shareParent: 'Share with Other Parent',
    
    // Settings
    childProfile: 'Child Profile Settings',
    speedLimit: 'Overspeed Limit (km/h)',
    schoolMode: 'School Mode',
    schoolModeDesc: 'Disables tracking and calls during school hours',
    schoolStart: 'School Start Time',
    schoolEnd: 'School End Time',
    languageToggle: 'Language / भाषा',
    english: 'English',
    hindi: 'हिंदी',
    deleteAccount: 'Delete Account',
    clearCache: 'Clear Cache'
  },
  hi: {
    welcome: 'आपका स्वागत है',
    login: 'लॉगिन करें',
    register: 'पंजीकरण करें',
    fullName: 'पूरा नाम',
    phone: 'फ़ोन नंबर',
    email: 'ईमेल पता',
    otp: 'ओटीपी सत्यापन',
    enterOtp: '४-अंकीय ओटीपी दर्ज करें',
    verify: 'सत्यापित करें और लॉगिन करें',
    sendOtp: 'ओटीपी भेजें',
    signupPrompt: 'खाता नहीं है? पंजीकरण करें',
    loginPrompt: 'पहले से खाता है? लॉगिन करें',
    devicePairing: 'ट्रैकिंग डिवाइस जोड़ें',
    deviceId: 'डिवाइस आईडी (हार्डवेयर आईडी)',
    pairBtn: 'डिवाइस जोड़ें',
    scanQr: 'डिवाइस क्यूआर कोड स्कैन करें',
    
    // Dashboard & Map
    liveLocation: 'लाइव ट्रैकिंग मैप',
    lastPing: 'अंतिम अपडेट',
    battery: 'बैटरी',
    network: 'नेटवर्क',
    speed: 'गति',
    status: 'स्थिति',
    safe: 'सुरक्षित',
    alert: 'चेतावनी',
    activeAlerts: 'सक्रिय अलर्ट (पिछले २४ घंटे)',
    distance: 'दूरी',
    activeTime: 'सक्रिय समय',
    avgSpeed: 'औसत गति',
    maxSpeed: 'अधिकतम गति',
    stops: 'ठहराव',
    
    // Actions
    sosBtn: 'एसओएस आपातकाल',
    geofence: 'जियोफेंस',
    callChild: 'कॉल करें',
    reportHistory: 'रिपोर्ट्स',
    switchKids: 'बच्चा बदलें',
    resolved: 'सुलझा हुआ चिह्नित करें',
    resolvedNotes: 'समाधान विवरण',
    
    // SOS
    sosTriggered: 'आपातकालीन एसओएस अलर्ट सक्रिय',
    primaryCall: 'प्राथमिक संपर्कों को ऑटो-कॉल की जा रही है...',
    callPapa: 'पापा को कॉल करें',
    callMummy: 'मम्मी को कॉल करें',
    callPolice: 'पुलिस (११२)',
    callAmbulance: 'एम्बुलेंस (१०२)',
    
    // Geofencing
    zoneName: 'क्षेत्र का नाम',
    radius: 'त्रिज्या (दूरी)',
    color: 'क्षेत्र का रंग',
    enableEntry: 'प्रवेश अलर्ट सक्षम करें',
    enableExit: 'निकास अलर्ट सक्षम करें',
    addZone: 'सुरक्षा क्षेत्र जोड़ें',
    editZone: 'सुरक्षा क्षेत्र संपादित करें',
    
    // Contacts
    emergencyContacts: 'आपातकालीन संपर्क',
    primaryContacts: 'प्राथमिक (एसओएस पर ऑटो-कॉल)',
    secondaryContacts: 'माध्यमिक (पुश + एसएमएस)',
    relationship: 'संबंध',
    alertPerms: 'अलर्ट अनुमतियां',
    editGatePrompt: 'संपादन अनलॉक करने के लिए ओटीपी दर्ज करें',
    reorderContacts: 'कॉल प्राथमिकता बदलने के लिए ड्रैग करें',
    testSms: 'एसएमएस टेस्ट',
    testCall: 'कॉल टेस्ट',
    
    // Reports
    dailySummary: 'दैनिक गतिविधि सारांश',
    batteryGraph: 'बैटरी इतिहास (२४ घंटे)',
    speedGraph: 'गति समयरेखा',
    exportPdf: 'पीडीएफ रिपोर्ट डाउनलोड करें',
    shareParent: 'दूसरे अभिभावक के साथ साझा करें',
    
    // Settings
    childProfile: 'बच्चे की प्रोफाइल सेटिंग्स',
    speedLimit: 'ओवरस्पीड सीमा (किमी/घंटा)',
    schoolMode: 'स्कूल मोड',
    schoolModeDesc: 'स्कूल के समय में ट्रैकिंग और कॉल बंद करता है',
    schoolStart: 'स्कूल शुरू होने का समय',
    schoolEnd: 'स्कूल समाप्त होने का समय',
    languageToggle: 'भाषा / Language',
    english: 'English',
    hindi: 'हिंदी',
    deleteAccount: 'खाता हटाएं',
    clearCache: 'कैश साफ करें'
  }
};

export const getTranslation = (lang, key) => {
  const selectedLang = lang || 'en';
  return translations[selectedLang][key] || translations['en'][key] || key;
};
export default translations;
