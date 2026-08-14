import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, View, LogBox, Platform } from 'react-native';
import { Provider } from 'react-redux';
import { Provider as PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import store from './src/redux/store';
import AppNavigator from './src/navigation/AppNavigator';
import { loadStoredSession } from './src/redux/slices/authSlice';
import { receiveRemoteSosAlert } from './src/redux/slices/sosSlice';
import { updateLiveLocation } from './src/redux/slices/locationSlice';
import { loadPersistedReports } from './src/redux/slices/reportSlice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';

// Suppress the Expo Go push notifications warning popup
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'Android Push notifications (remote notifications) functionality'
]);

// Detect if app is running in Expo Go (SDK 53+ removed remote push notifications from Expo Go)
const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

if (!isExpoGo) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (e) {
    console.log('Notification handler configuration skipped:', e.message);
  }
}

function AppRootContent() {
  useEffect(() => {
    // 1. Restore persistent login token and user profiles
    store.dispatch(loadStoredSession());

    // 2. Load saved daily reports from AsyncStorage
    AsyncStorage.getItem('saved_daily_reports')
      .then(data => {
        if (data) {
          store.dispatch(loadPersistedReports(JSON.parse(data)));
        }
      })
      .catch(err => console.log('Error loading saved reports on boot:', err));

    // 3. Setup Expo Notifications listeners only if NOT running in Expo Go (SDK 53+)
    let notificationSubscription;
    let responseSubscription;

    if (isExpoGo) {
      console.log('ℹ️ Running in Expo Go: Remote Push Notifications are disabled in Expo Go SDK 53+. Real-time alerts will function via Socket.IO.');
      return;
    }

    try {
      // Handle foreground notifications
      notificationSubscription = Notifications.addNotificationReceivedListener(notification => {
        console.log('Push Message received in foreground:', notification);
        const data = notification.request.content.data;
        if (data) {
          const { type, payload } = data;
          // Dispatch alert updates directly to redux states
          if (type === 'SOS') {
            store.dispatch(receiveRemoteSosAlert(typeof payload === 'string' ? JSON.parse(payload) : payload));
          } else if (type === 'LOCATION') {
            store.dispatch(updateLiveLocation(typeof payload === 'string' ? JSON.parse(payload) : payload));
          }
        }
      });

      // Handle background click on notifications
      responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('App opened by notification click from background:', response);
      });

      // Request permissions & fetch push token safely
      const requestNotificationPermission = async () => {
        try {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus === 'granted') {
            console.log('Notification permission granted.');
          }

          // Create high importance notification channel for Android sound alerts
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('emergency-alerts', {
              name: 'Emergency Alerts',
              importance: Notifications.AndroidImportance.MAX,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#FF0000',
              sound: 'default',
            });
          }
        } catch (e) {
          console.log('Notification channel configuration error:', e.message);
        }
      };
      
      requestNotificationPermission();
    } catch (err) {
      console.log('Notification listeners skipped:', err.message);
    }

    return () => {
      if (notificationSubscription) notificationSubscription.remove();
      if (responseSubscription) responseSubscription.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <AppNavigator />
    </View>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <PaperProvider>
        <NavigationContainer>
          <AppRootContent />
        </NavigationContainer>
      </PaperProvider>
    </Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
