import React from 'react';
import { Redirect } from 'expo-router';

// This screen is deprecated/unused as index.tsx handles login.
// Redirecting to root index directly.
export default function LoginScreen() {
  return <Redirect href="/" />;
}
