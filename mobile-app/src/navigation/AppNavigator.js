import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSelector } from 'react-redux';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Import Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import TrackingMapScreen from '../screens/TrackingMapScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SOSAlertScreen from '../screens/SOSAlertScreen';
import DevicePairingScreen from '../screens/DevicePairingScreen';
import SplashScreenView from '../screens/SplashScreenView';

// Custom tab icons loaded from Expo icons
import { MaterialCommunityIcons } from '@expo/vector-icons';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Render simple placeholder icons if MaterialCommunityIcons isn't loaded/configured properly
const TabBarIcon = ({ name, color, size }) => {
  try {
    return <MaterialCommunityIcons name={name} size={size} color={color} />;
  } catch (e) {
    // Return simple text label if vector icons fail to load
    return <View style={{ width: size, height: size, backgroundColor: color, borderRadius: size / 2 }} />;
  }
};

function AppTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#6200EE',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#EEEEEE',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="view-dashboard" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Tracking"
        component={TrackingMapScreen}
        options={{
          tabBarLabel: 'Live Map',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="map-marker-radius" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Contacts"
        component={ContactsScreen}
        options={{
          tabBarLabel: 'Contacts',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="phone-settings" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="file-chart" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon name="cog" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [showSplash, setShowSplash] = React.useState(true);
  const { isAuthenticated, loading } = useSelector((state) => state.auth);
  const { activeSosAlert } = useSelector((state) => state.sos);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2200); // Display splash screen for 2.2 seconds
    return () => clearTimeout(timer);
  }, []);

  if (loading || showSplash) {
    return <SplashScreenView statusText="Checking for new update..." />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            {/* Main App Screens */}
            <Stack.Screen name="MainTabs" component={AppTabNavigator} />
            <Stack.Screen name="DevicePairing" component={DevicePairingScreen} />
          </>
        ) : (
          <>
            {/* Authentication Screens */}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>

      {/* Render SOSAlertScreen as an Absolute Overlay Modal so it overlays instantly with sound! */}
      {isAuthenticated && activeSosAlert && (
        <View style={StyleSheet.absoluteFill}>
          <SOSAlertScreen />
        </View>
      )}
    </View>
  );
}
