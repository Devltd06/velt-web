// App.js — expo-router variant (expo-router/entry first)
import * as React from 'react';
global.React = React;

// ensure expo-router entry runs before anything that needs routing
import 'expo-router/entry';

import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { supabase } from './lib/supabase';
import AuthNavigator from './navigators/AuthNavigator';
import MainNavigator from './navigators/MainNavigator';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        await SplashScreen.preventAutoHideAsync();
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
        supabase.auth.onAuthStateChange((_event, session) => {
          setSession(session);
        });
      } finally {
        setLoading(false);
        await SplashScreen.hideAsync();
      }
    };
    init();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // If you really use expo-router's file-based routing, you would not use NavigationContainer here.
  // But if you still rely on your own navigators, keeping NavigationContainer is OK.
  return (
    // keep this if you're using your own react-navigation structure
    <React.Fragment>
      {session ? <MainNavigator /> : <AuthNavigator />}
    </React.Fragment>
  );
}

