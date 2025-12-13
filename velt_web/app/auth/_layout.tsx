import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{
      headerShown: true,
      headerStyle: { backgroundColor: '#000' },
      headerTintColor: '#fff',
    }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="forgot" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="welcome" />
    </Stack>
  );
}
