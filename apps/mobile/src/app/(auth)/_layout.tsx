import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen options={{ title: 'Login' }} name="login" />
      <Stack.Screen options={{ title: 'Register' }} name="register" />
      <Stack.Screen options={{ title: 'Verify OTP' }} name="verify-otp" />
      <Stack.Screen
        options={{ title: 'Reset Password' }}
        name="reset-password"
      />
      <Stack.Screen
        options={{ title: 'Forgot Password' }}
        name="forgot-password"
      />
    </Stack>
  );
}
