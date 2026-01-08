import { Stack } from 'expo-router';

export default function SuperAdminLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="dashboard" />
            <Stack.Screen name="workshop-details" />
            <Stack.Screen name="create-workshop" />
        </Stack>
    );
}
