import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Switch, TextInput, ActivityIndicator, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useThemeStore } from '@/store/themeStore';
import { firebaseService } from '@/services/firebaseService';
import { doc, updateDoc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useColors } from '@/constants/design';
import { WorkshopSelectorModal } from '@/components/WorkshopSelectorModal';

// Workshop Roles - for routing after login
const workshopRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor', 'super_admin'];

// Account flow steps
type AccountStep = 'email' | 'login' | 'create' | 'createCustomer' | 'selectWorkshops' | 'completeProfile';

export default function SettingsScreen() {
    const router = useRouter();
    const { user, isGuest, setGuest, logout, acceptStaffInvite, registerCustomerAccount, guestEmail, setGuestEmail } = useAuthStore();
    const colors = useColors();
    const styles = getStyles(colors);
    const appearanceStyles = getAppearanceStyles(colors);
    const [pushEnabled, setPushEnabled] = useState(true);
    const [emailEnabled, setEmailEnabled] = useState(true);
    const [loading, setLoading] = useState(false);
    const [prefsLoading, setPrefsLoading] = useState(true);

    // Account flow state
    const [step, setStep] = useState<AccountStep>('email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    // Invitation info
    const [invitation, setInvitation] = useState<{
        type: 'staff' | 'customer' | null;
        role: string;
        code: string;
        id: string;
    } | null>(null);

    // Member mode modal
    const [showMemberModeModal, setShowMemberModeModal] = useState(false);
    // Track if we are in the member flow (vs guest flow)
    const [isMemberModeFlow, setIsMemberModeFlow] = useState(false);

    // Workshop selection for new customers
    const [selectedWorkshopIds, setSelectedWorkshopIds] = useState<string[]>([]);
    const [showWorkshopSelector, setShowWorkshopSelector] = useState(false);

    // Profile completion state (for member mode registration)
    const [profileName, setProfileName] = useState('');
    const [profilePhone, setProfilePhone] = useState('');
    const [newUserId, setNewUserId] = useState<string | null>(null);

    useEffect(() => {
        if (!user?.id) {
            setPrefsLoading(false);
            return;
        }
        const loadPrefs = async () => {
            try {
                const userData = await firebaseService.getUser(user.id);
                if (userData) {
                    setPushEnabled(userData.pushNotificationsEnabled !== false);
                    setEmailEnabled(userData.emailNotificationsEnabled !== false);
                }
            } catch (error) {
                console.error('Error loading preferences:', error);
            } finally {
                setPrefsLoading(false);
            }
        };
        loadPrefs();
    }, [user?.id]);

    const updatePreference = async (key: string, value: boolean) => {
        if (!user?.id) return;
        try {
            await updateDoc(doc(db, 'users', user.id), { [key]: value });
        } catch (error) {
            console.error('Error updating preference:', error);
            Alert.alert('Error', 'Failed to update preference');
        }
    };

    const handlePushToggle = (value: boolean) => {
        setPushEnabled(value);
        updatePreference('pushNotificationsEnabled', value);
    };

    const handleEmailToggle = (value: boolean) => {
        setEmailEnabled(value);
        updatePreference('emailNotificationsEnabled', value);
    };

    const handleResetPassword = async () => {
        if (!user?.email) return;
        try {
            await firebaseService.sendPasswordResetEmail(user.email);
            Alert.alert('Success', `Password reset email sent to ${user.email}`);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send reset email');
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            setGuest(true);
            router.replace('/(marketplace)/home');
        } catch (error) {
            Alert.alert('Error', 'Failed to logout');
        }
    };

    // Step 1: Check email for existing account or invitation
    const handleEmailContinue = async () => {
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail || !trimmedEmail.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }
        if (!trimmedEmail || !trimmedEmail.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }

        // Guest Flow: Only update guest email, do not proceed to auth
        if (!isMemberModeFlow) {
            setGuestEmail(trimmedEmail);
            Alert.alert('Success', 'Guest email updated.');
            return;
        }

        setLoading(true);
        setError('');
        setInvitation(null);

        try {
            // Check for staff invitation
            const staffQ = query(
                collection(db, 'staffInvitations'),
                where('email', '==', trimmedEmail),
                where('used', '==', false)
            );
            const staffSnap = await getDocs(staffQ);

            if (!staffSnap.empty) {
                const staffDoc = staffSnap.docs[0];
                const data = staffDoc.data();
                setInvitation({
                    type: 'staff',
                    role: data.role || 'Staff',
                    code: data.invitationCode,
                    id: staffDoc.id
                });
                setStep('create');
                setLoading(false);
                return;
            }

            // Check for customer registration
            const customerQ = query(
                collection(db, 'customerRegistrations'),
                where('email', '==', trimmedEmail),
                where('used', '==', false)
            );
            const customerSnap = await getDocs(customerQ);

            if (!customerSnap.empty) {
                const customerDoc = customerSnap.docs[0];
                const data = customerDoc.data();
                setInvitation({
                    type: 'customer',
                    role: 'Customer',
                    code: data.registrationCode,
                    id: customerDoc.id
                });
                setStep('create');
                setLoading(false);
                return;
            }

            // Check for vendor invitation
            const vendorQ = query(
                collection(db, 'staffInvitations'),
                where('email', '==', trimmedEmail),
                where('role', '==', 'vendor'),
                where('used', '==', false)
            );
            const vendorSnap = await getDocs(vendorQ);

            if (!vendorSnap.empty) {
                const vendorDoc = vendorSnap.docs[0];
                const data = vendorDoc.data();
                setInvitation({
                    type: 'staff',
                    role: 'Vendor',
                    code: data.invitationCode,
                    id: vendorDoc.id
                });
                setStep('create');
                setLoading(false);
                return;
            }

            // No invitation found -> Proceed to Unified Auth (Login/Signup)
            // This allows the user to enter their password.
            setStep('login');

        } catch (err) {
            console.error('Error checking email:', err);
            // Default to login step in case of error (safe fallback)
            setStep('login');
        } finally {
            setLoading(false);
        }
    };

    // Unified Authentication Handler
    // Tries to Log In first.
    // If "User Not Found", assumes New User -> Redirects to 'selectWorkshops' -> 'createCustomer'
    // This allows New Users to explicitly "Create Password" and confirm it.
    const handleUnifiedAuth = async () => {
        if (!password) {
            setError('Please enter your password');
            return;
        }

        setLoading(true);
        setError('');

        try {
            setLoading(true);
            const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
            setGuest(false);

            // Check User Role and Route
            const userDocRef = doc(db, 'users', userCredential.user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                navigateUser({ ...userDocSnap.data(), role: userDocSnap.data().role } as any);
            } else {
                // Fallback if user doc missing (should typically be caught by error handling)
                console.error('User document not found');
            }

        } catch (signInErr: any) {
            // 2. If User Not Found (or Invalid Credential), treating as New User Flow
            if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
                // Do NOT auto-create. Redirect to Setup Flow.
                setStep('createCustomer');
            } else if (signInErr.code === 'auth/wrong-password') {
                setError('Incorrect password.');
            } else {
                setError(signInErr.message || 'Authentication failed.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Helper to route users based on role
    const navigateUser = (userData: any) => {
        if (userData.role === 'super_admin' || workshopRoles.includes(userData.role)) {
            router.replace('/(workshop)/dashboard');
        } else if (userData.role === 'vendor') {
            if (userData.vendorStatus === 'active') {
                router.replace('/(marketplace)/home');
            } else if (userData.vendorStatus === 'pending_approval') {
                router.replace('/(marketplace)/pending-approval');
            } else {
                router.replace('/(marketplace)/vendor-registration');
            }
        } else if (userData.role === 'customer') {
            router.replace('/(customer)/home');
        } else if (userData.workshopId && userData.role !== 'customer' && userData.role !== 'vendor') {
            // Custom workshop roles
            router.replace('/(workshop)/dashboard');
        } else {
            router.replace('/(customer)/home');
        }
    };

    // Handle login for existing accounts
    const handleLogin = async () => {
        if (!password.trim()) {
            setError('Please enter your password');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
            const userDocRef = doc(db, 'users', userCredential.user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (!userDocSnap.exists()) {
                setError('Account not found. Please contact support.');
                setLoading(false);
                return;
            }

            const userData = userDocSnap.data();
            setGuest(false);

            // Route based on role
            if (userData.role === 'super_admin' || workshopRoles.includes(userData.role)) {
                router.replace('/(workshop)/dashboard');
            } else if (userData.role === 'vendor') {
                if (userData.vendorStatus === 'active') {
                    router.replace('/(marketplace)/home');
                } else if (userData.vendorStatus === 'pending_approval') {
                    router.replace('/(marketplace)/pending-approval');
                } else {
                    router.replace('/(marketplace)/vendor-registration');
                }
            } else if (userData.role === 'customer') {
                router.replace('/(customer)/home');
            } else if (userData.workshopId && userData.role !== 'customer' && userData.role !== 'vendor') {
                // Custom workshop roles
                router.replace('/(workshop)/dashboard');
            } else {
                router.replace('/(customer)/home');
            }
        } catch (error: any) {
            let msg = 'Login failed. Please try again.';
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                msg = 'Incorrect email or password.';
            } else if (error.code === 'auth/too-many-requests') {
                msg = 'Too many attempts. Please try again later.';
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Handle account creation for invited users
    const handleCreateAccount = async () => {
        if (!password.trim() || password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (!invitation) {
            setError('Invitation not found. Please try again.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            if (invitation.type === 'staff') {
                // Use staff invite flow
                await acceptStaffInvite(email.trim().toLowerCase(), password, invitation.code);
            } else {
                // Use customer registration flow
                await registerCustomerAccount(email.trim().toLowerCase(), password, invitation.code);
            }

            setGuest(false);

            // Routing is handled by the auth store after registration
            // But let's add explicit routing as backup
            const userData = useAuthStore.getState().user;
            if (userData) {
                if (userData.role === 'super_admin' || workshopRoles.includes(userData.role)) {
                    router.replace('/(workshop)/dashboard');
                } else if (userData.role === 'vendor') {
                    router.replace('/(marketplace)/vendor-registration');
                } else if (userData.workshopId && userData.role !== 'customer' && userData.role !== 'vendor') {
                    // Custom workshop roles
                    router.replace('/(workshop)/dashboard');
                } else {
                    router.replace('/(customer)/home');
                }
            }
        } catch (error: any) {
            let msg = 'Failed to create account.';
            if (error.code === 'auth/email-already-in-use') {
                msg = 'An account with this email already exists. Try logging in.';
                setStep('login');
            } else if (error.message) {
                msg = error.message;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Reset flow
    const handleBack = () => {
        setStep('email');
        setPassword('');
        setConfirmPassword('');
        setError('');
        setInvitation(null);
        setSelectedWorkshopIds([]);
    };

    // Handle new customer account creation (without invitation)
    const handleCreateNewCustomer = async () => {
        if (!password.trim() || password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        if (selectedWorkshopIds.length === 0) {
            setError('Please select at least one workshop');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const normalizedEmail = email.trim().toLowerCase();

            // Check for existing customer records with this email (created by staff)
            let existingName = '';
            let existingPhone = '';
            try {
                const usersQuery = query(
                    collection(db, 'users'),
                    where('email', '==', normalizedEmail),
                    where('role', '==', 'customer')
                );
                const usersSnapshot = await getDocs(usersQuery);
                if (!usersSnapshot.empty) {
                    // Found existing customer record - get name/phone for pre-fill
                    const existingDoc = usersSnapshot.docs[0].data();
                    existingName = existingDoc.name || '';
                    existingPhone = existingDoc.phone || '';
                }
            } catch (err) {
                console.log('Could not query existing customers:', err);
            }

            // Create Firebase auth account
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                normalizedEmail,
                password
            );

            // Create user document as customer with selected workshops
            // Also set workshopId to first selected for backward compatibility with staff queries
            await setDoc(doc(db, 'users', userCredential.user.uid), {
                email: normalizedEmail,
                name: existingName, // Preserve any existing name from staff-created record
                phone: existingPhone, // Preserve any existing phone from staff-created record
                role: 'customer',
                workshopId: selectedWorkshopIds[0], // For backward compatibility with staff queries
                selectedWorkshopIds: selectedWorkshopIds,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            // Pre-fill profile fields with existing data (if any)
            setProfileName(existingName);
            setProfilePhone(existingPhone);

            // Save user ID and go to profile completion step
            setNewUserId(userCredential.user.uid);
            setStep('completeProfile');
        } catch (error: any) {
            let msg = 'Failed to create account.';
            if (error.code === 'auth/email-already-in-use') {
                msg = 'An account with this email already exists. Try logging in.';
                setStep('login');
            } else if (error.message) {
                msg = error.message;
            }
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Handle profile completion after member mode registration
    const handleCompleteProfile = async () => {
        if (!profileName.trim()) {
            setError('Please enter your full name');
            return;
        }
        if (!profilePhone.trim() || profilePhone.length < 10) {
            setError('Please enter a valid phone number');
            return;
        }
        if (!newUserId) {
            setError('Session error. Please try again.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            // Update user document with name and phone
            await setDoc(doc(db, 'users', newUserId), {
                name: profileName.trim(),
                phone: profilePhone.trim(),
                updatedAt: new Date(),
            }, { merge: true });

            setGuest(false);
            router.replace('/(customer)/home');
        } catch (error: any) {
            setError(error.message || 'Failed to save profile');
        } finally {
            setLoading(false);
        }
    };

    // Guest view - show account flow (or if we are in the middle of onboarding)
    if (isGuest || !user || step === 'selectWorkshops' || step === 'completeProfile') {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Settings</Text>
                </View>
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={{
                        paddingBottom: 40,
                        flexGrow: 1,
                        justifyContent: 'center'
                    }}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Create Account Section - Always visible at top for guests */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Create Account</Text>
                        <View style={styles.loginCard}>
                            <Ionicons name="person-circle-outline" size={48} color={colors.textTertiary} style={{ alignSelf: 'center', marginBottom: 15 }} />

                            {!guestEmail ? (
                                <>
                                    <Text style={styles.loginPrompt}>Enter your email to save your preferences and order history</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Email"
                                        placeholderTextColor="#999"
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        autoCorrect={false}
                                    />
                                    {error && !isMemberModeFlow ? <Text style={styles.errorText}>{error}</Text> : null}
                                    <TouchableOpacity
                                        style={[styles.loginButtonSecondary, loading && { opacity: 0.7 }]}
                                        onPress={() => {
                                            const trimmedEmail = email.trim().toLowerCase();
                                            if (!trimmedEmail || !trimmedEmail.includes('@')) {
                                                setError('Please enter a valid email address');
                                                return;
                                            }
                                            setGuestEmail(trimmedEmail);
                                            setError('');
                                            Alert.alert('Success', 'Your email has been saved. You can use this email to access your account.');
                                        }}
                                        disabled={loading}
                                    >
                                        <Text style={styles.loginButtonTextSecondary}>Save Email</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.loginPrompt}>Your account email</Text>
                                    <View style={styles.emailDisplay}>
                                        <Text style={styles.emailDisplayText}>{guestEmail}</Text>
                                    </View>
                                    <Text style={[styles.loginPrompt, { fontSize: 12, marginTop: 5 }]}>
                                        Use this email when you sign up or login to access your order history.
                                    </Text>
                                </>
                            )}
                        </View>
                    </View>

                    {/* Member Mode Toggle */}
                    <View style={styles.section}>
                        <View style={[styles.menuItem, { justifyContent: 'space-between', paddingRight: 10 }]}>
                            <Text style={styles.menuText}>Member Mode</Text>
                            <Switch
                                value={isMemberModeFlow}
                                onValueChange={(val) => {
                                    if (val) {
                                        setIsMemberModeFlow(true);
                                        setShowMemberModeModal(true);
                                    } else {
                                        setIsMemberModeFlow(false);
                                    }
                                }}
                                trackColor={{ false: colors.border, true: colors.textPrimary }}
                                thumbColor={isMemberModeFlow ? colors.background : colors.textTertiary}
                                ios_backgroundColor={colors.border}
                            />
                        </View>
                    </View>

                    {/* Account Section - Only visible in Member Mode */}
                    {isMemberModeFlow && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Account</Text>
                            <View style={styles.loginCard}>
                                <Ionicons name="person-circle-outline" size={48} color={colors.textTertiary} style={{ alignSelf: 'center', marginBottom: 15 }} />

                                {step === 'email' && (
                                    <>
                                        <Text style={styles.loginPrompt}>Enter your email to sign in or create an account</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Email"
                                            placeholderTextColor="#999"
                                            value={email}
                                            onChangeText={setEmail}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                            autoCorrect={false}
                                        />
                                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                                        <TouchableOpacity
                                            style={[
                                                styles.loginButtonSecondary,
                                                loading && { opacity: 0.7 }
                                            ]}
                                            onPress={handleEmailContinue}
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color={colors.textPrimary} />
                                            ) : (
                                                <Text style={styles.loginButtonTextSecondary}>Continue</Text>
                                            )}
                                        </TouchableOpacity>
                                    </>
                                )}

                                {step === 'login' && (
                                    <>
                                        <Text style={styles.loginPrompt}>Sign in to your account</Text>
                                        <View style={styles.emailDisplay}>
                                            <Text style={styles.emailDisplayText}>{email}</Text>
                                            <TouchableOpacity onPress={handleBack}>
                                                <Text style={styles.changeLink}>Change</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Password"
                                            placeholderTextColor="#999"
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry
                                        />
                                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                                        <TouchableOpacity
                                            style={[styles.loginButtonSecondary, loading && { opacity: 0.7 }]}
                                            onPress={handleUnifiedAuth}
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color={colors.textPrimary} />
                                            ) : (
                                                <Text style={styles.loginButtonTextSecondary}>Sign In</Text>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.forgotButton}
                                            onPress={() => router.push('/(auth)/forgot-password')}
                                        >
                                            <Text style={styles.forgotText}>Forgot Password?</Text>
                                        </TouchableOpacity>
                                    </>
                                )}

                                {step === 'create' && invitation && (
                                    <>
                                        <Text style={styles.loginPrompt}>Complete your account setup</Text>
                                        <View style={styles.emailDisplay}>
                                            <Text style={styles.emailDisplayText}>{email}</Text>
                                            <TouchableOpacity onPress={handleBack}>
                                                <Text style={styles.changeLink}>Change</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Show invitation role */}
                                        <View style={styles.inviteInfoBox}>
                                            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                                            <Text style={styles.inviteInfoText}>
                                                You've been invited as: <Text style={styles.roleText}>{invitation.role}</Text>
                                            </Text>
                                        </View>

                                        <TextInput
                                            style={styles.input}
                                            placeholder="Create Password"
                                            placeholderTextColor="#999"
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Confirm Password"
                                            placeholderTextColor="#999"
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                            secureTextEntry
                                        />
                                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                                        <TouchableOpacity
                                            style={[styles.loginButtonSecondary, loading && { opacity: 0.7 }]}
                                            onPress={handleCreateAccount}
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color={colors.textPrimary} />
                                            ) : (
                                                <Text style={styles.loginButtonTextSecondary}>Create Account</Text>
                                            )}
                                        </TouchableOpacity>
                                    </>
                                )}

                                {step === 'createCustomer' && (
                                    <>
                                        <Text style={styles.loginPrompt}>Create your account</Text>
                                        <View style={styles.emailDisplay}>
                                            <Text style={styles.emailDisplayText}>{email}</Text>
                                            <TouchableOpacity onPress={handleBack}>
                                                <Text style={styles.changeLink}>Change</Text>
                                            </TouchableOpacity>
                                        </View>

                                        <TextInput
                                            style={styles.input}
                                            placeholder="Create Password"
                                            placeholderTextColor="#999"
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Confirm Password"
                                            placeholderTextColor="#999"
                                            value={confirmPassword}
                                            onChangeText={setConfirmPassword}
                                            secureTextEntry
                                        />

                                        {/* Workshop Selector (After Passwords) */}
                                        <TouchableOpacity
                                            style={[styles.input, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 50 }]}
                                            onPress={() => setShowWorkshopSelector(true)}
                                        >
                                            <Text style={{ color: selectedWorkshopIds.length === 0 ? '#999' : colors.textPrimary }}>
                                                {selectedWorkshopIds.length === 0
                                                    ? 'Select Workshop'
                                                    : `${selectedWorkshopIds.length} workshop${selectedWorkshopIds.length > 1 ? 's' : ''} selected`}
                                            </Text>
                                            <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                                        </TouchableOpacity>

                                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                                        <TouchableOpacity
                                            style={[styles.loginButtonSecondary, loading && { opacity: 0.7 }]}
                                            onPress={handleCreateNewCustomer}
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color={colors.textPrimary} />
                                            ) : (
                                                <Text style={styles.loginButtonTextSecondary}>Create Account</Text>
                                            )}
                                        </TouchableOpacity>
                                    </>
                                )}

                                {step === 'completeProfile' && (
                                    <>
                                        <Text style={styles.loginPrompt}>Complete Your Profile</Text>
                                        <View style={styles.emailDisplay}>
                                            <Text style={styles.emailDisplayText}>{email}</Text>
                                        </View>

                                        <TextInput
                                            style={styles.input}
                                            placeholder="Full Name"
                                            placeholderTextColor="#999"
                                            value={profileName}
                                            onChangeText={setProfileName}
                                            autoCapitalize="words"
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Phone Number"
                                            placeholderTextColor="#999"
                                            value={profilePhone}
                                            onChangeText={setProfilePhone}
                                            keyboardType="phone-pad"
                                        />

                                        {error ? <Text style={styles.errorText}>{error}</Text> : null}
                                        <TouchableOpacity
                                            style={[styles.loginButtonSecondary, loading && { opacity: 0.7 }]}
                                            onPress={handleCompleteProfile}
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color={colors.textPrimary} />
                                            ) : (
                                                <Text style={styles.loginButtonTextSecondary}>Continue</Text>
                                            )}
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Privacy Policy for Guests */}
                    <View style={styles.section}>
                        <TouchableOpacity
                            style={styles.toggleRow}
                            onPress={() => router.push('/(auth)/privacy-policy')}
                        >
                            <View style={styles.toggleInfo}>
                                <Ionicons name="document-text-outline" size={22} color={colors.textPrimary} />
                                <View style={styles.toggleText}>
                                    <Text style={styles.toggleLabel}>Privacy Policy</Text>
                                    <Text style={styles.toggleDesc}>How we handle your data</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </View>

                    {/* Appearance - Theme Toggle for Guests */}
                    <AppearanceSection styles={styles} appearanceStyles={appearanceStyles} />

                    {/* Delete Account - Only show if guest has provided email */}
                    {
                        guestEmail && (
                            <View style={styles.section}>
                                <TouchableOpacity
                                    style={styles.deleteButton}
                                    onPress={() => {
                                        Alert.alert(
                                            'Delete Account',
                                            'This will remove your email and order history. Are you sure?',
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Delete',
                                                    style: 'destructive',
                                                    onPress: () => {
                                                        setGuestEmail(null);
                                                        Alert.alert('Done', 'Your account data has been removed.');
                                                    },
                                                },
                                            ]
                                        );
                                    }}
                                >
                                    <Ionicons name="trash-outline" size={22} color={colors.error} />
                                    <Text style={styles.deleteText}>Delete Account</Text>
                                </TouchableOpacity>
                            </View>
                        )
                    }
                </ScrollView>

                {/* Member Mode Confirmation Modal */}
                <Modal
                    visible={showMemberModeModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowMemberModeModal(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Member Mode</Text>
                            <Text style={styles.modalText}>
                                Switch to Member Mode to access full features including workshop repairs and vendor tools. You'll need to create an account or sign in.
                            </Text>
                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.modalButtonSecondary]}
                                    onPress={() => {
                                        setIsMemberModeFlow(false);
                                        setShowMemberModeModal(false);
                                    }}
                                >
                                    <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.modalButtonSecondary]}
                                    onPress={() => {
                                        setShowMemberModeModal(false);
                                        setIsMemberModeFlow(false);
                                        router.push('/(marketplace)/member-auth');
                                    }}
                                >
                                    <Text style={styles.modalButtonTextSecondary}>Continue</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal >

                <WorkshopSelectorModal
                    visible={showWorkshopSelector}
                    onClose={() => setShowWorkshopSelector(false)}
                    onSelect={(ids) => {
                        setSelectedWorkshopIds(ids);
                        setShowWorkshopSelector(false);
                    }}
                    initialSelectedIds={selectedWorkshopIds}
                    title="Select Workshop(s)"
                    multiSelect={true}
                />
            </View >
        );
    }

    // Authenticated user view
    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <View style={styles.row}>
                        <View style={styles.iconContainer}>
                            <Ionicons name="person-circle-outline" size={24} color={colors.textPrimary} />
                        </View>
                        <View style={styles.rowContent}>
                            <Text style={styles.rowTitle}>{user?.name || 'User'}</Text>
                            <Text style={styles.rowSubtitle}>{user?.email}</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.menuItem} onPress={handleResetPassword}>
                        <Ionicons name="lock-closed-outline" size={22} color={colors.textPrimary} />
                        <Text style={styles.menuText}>Reset Password</Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleInfo}>
                            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
                            <View style={styles.toggleText}>
                                <Text style={styles.toggleLabel}>Push Notifications</Text>
                                <Text style={styles.toggleDesc}>Receive order and system updates</Text>
                            </View>
                        </View>
                        <Switch
                            value={pushEnabled}
                            onValueChange={handlePushToggle}
                            trackColor={{ false: colors.border, true: colors.textPrimary }}
                            thumbColor="#fff"
                            disabled={prefsLoading}
                        />
                    </View>
                    <View style={styles.toggleRow}>
                        <View style={styles.toggleInfo}>
                            <Ionicons name="mail-outline" size={22} color={colors.textPrimary} />
                            <View style={styles.toggleText}>
                                <Text style={styles.toggleLabel}>Email Notifications</Text>
                                <Text style={styles.toggleDesc}>Receive updates via email</Text>
                            </View>
                        </View>
                        <Switch
                            value={emailEnabled}
                            onValueChange={handleEmailToggle}
                            trackColor={{ false: colors.border, true: colors.textPrimary }}
                            thumbColor={colors.surface}
                            disabled={prefsLoading}
                        />
                    </View>

                    {/* Appearance - Theme Toggle for Authenticated Users */}
                    <AppearanceSection styles={styles} appearanceStyles={appearanceStyles} />

                </View>

                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => {
                            Alert.alert(
                                'Delete Account',
                                'Are you sure you want to delete your account? This action involves deleting all your data permanently and cannot be undone.',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Delete',
                                        style: 'destructive',
                                        onPress: async () => {
                                            try {
                                                const { deleteAccount } = useAuthStore.getState();
                                                await deleteAccount();
                                            } catch (error: any) {
                                                console.error('Delete account error:', error);
                                                if (error.code === 'auth/requires-recent-login') {
                                                    Alert.alert('Authentication Required', 'Please log out and log back in to delete your account.');
                                                } else {
                                                    Alert.alert('Error', error.message || 'Failed to delete account');
                                                }
                                            }
                                        },
                                    },
                                ]
                            );
                        }}
                    >
                        <Ionicons name="trash-outline" size={22} color={colors.error} />
                        <Text style={styles.deleteText}>Delete Account</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.toggleRow}
                        onPress={() => router.push('/(auth)/privacy-policy')}
                    >
                        <View style={styles.toggleInfo}>
                            <Ionicons name="document-text-outline" size={22} color={colors.textPrimary} />
                            <View style={styles.toggleText}>
                                <Text style={styles.toggleLabel}>Privacy Policy</Text>
                                <Text style={styles.toggleDesc}>How we handle your data</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>

                <View style={styles.section}>
                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <Ionicons name="log-out-outline" size={22} color={colors.error} />
                        <Text style={styles.logoutText}>Log Out</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

// Appearance Section for theme selection
function AppearanceSection({ styles, appearanceStyles }: { styles: any; appearanceStyles: any }) {
    const { themeMode, setThemeMode } = useThemeStore();
    const colors = useColors();

    const themeOptions: { value: 'light' | 'dark' | 'system'; label: string; icon: string }[] = [
        { value: 'light', label: 'Light', icon: 'sunny' },
        { value: 'dark', label: 'Dark', icon: 'moon' },
        { value: 'system', label: 'System', icon: 'phone-portrait' },
    ];

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Appearance</Text>

            <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                    <Ionicons name="contrast" size={22} color={colors.textPrimary} />
                    <View style={styles.toggleText}>
                        <Text style={styles.toggleLabel}>Theme</Text>
                        <Text style={styles.toggleDesc}>Choose your preferred appearance</Text>
                    </View>
                </View>
            </View>

            <View style={appearanceStyles.themeSelector}>
                {themeOptions.map((option) => (
                    <TouchableOpacity
                        key={option.value}
                        style={[
                            appearanceStyles.themeOption,
                            themeMode === option.value && appearanceStyles.themeOptionActive,
                        ]}
                        onPress={() => setThemeMode(option.value)}
                    >
                        <Ionicons
                            name={option.icon as any}
                            size={20}
                            color="#555"
                        />
                        <Text
                            style={[
                                appearanceStyles.themeOptionText,
                                themeMode === option.value && appearanceStyles.themeOptionTextActive,
                            ]}
                        >
                            {option.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

const getAppearanceStyles = (colors: any) => StyleSheet.create({
    themeSelector: {
        flexDirection: 'row',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    themeOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: colors.background,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    themeOptionActive: {
        backgroundColor: colors.primary + '20',
        borderColor: colors.textPrimary,
    },
    themeOptionText: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.textSecondary,
    },
    themeOptionTextActive: {
        color: colors.textPrimary,
        fontWeight: '600',
    },
});

const getStyles = (colors: any) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: colors.background,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: colors.textPrimary,
    },
    content: {
        flex: 1,
    },
    section: {
        marginTop: 20,
        backgroundColor: colors.background,
        borderBottomWidth: 1,
        borderColor: colors.border,
    },
    sectionTitle: {
        fontSize: 14,
        color: colors.textSecondary,
        marginHorizontal: 15,
        marginVertical: 10,
        fontWeight: '600',
        textAlign: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
    },
    iconContainer: {
        marginRight: 15,
    },
    rowContent: {
        flex: 1,
    },
    rowTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    rowSubtitle: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    menuText: {
        flex: 1,
        marginLeft: 15,
        fontSize: 16,
        color: colors.textPrimary,
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
    },
    logoutText: {
        marginLeft: 10,
        color: colors.error,
        fontWeight: '600',
        fontSize: 16,
    },
    deleteButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        backgroundColor: colors.error + '20',
        marginHorizontal: 15,
        marginBottom: 15,
        borderRadius: 8,
    },
    deleteText: {
        marginLeft: 10,
        color: colors.error,
        fontWeight: '600',
        fontSize: 16,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    toggleInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 15,
    },
    toggleText: {
        flex: 1,
    },
    toggleLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    toggleDesc: {
        fontSize: 12,
        color: colors.textSecondary,
    },
    // Login form styles for guests
    loginCard: {
        padding: 20,
        alignItems: 'center',
    },
    loginPrompt: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: 20,
    },
    input: {
        width: '100%',
        backgroundColor: colors.background,
        padding: 15,
        borderRadius: 10,
        fontSize: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
        color: colors.textPrimary,
    },
    errorText: {
        color: colors.error,
        fontSize: 14,
        marginBottom: 12,
        textAlign: 'center',
    },
    loginButton: {
        width: '100%',
        backgroundColor: colors.primary,
        padding: 16,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 8,
    },
    loginButtonText: {
        color: colors.textInverse,
        fontSize: 16,
        fontWeight: '600',
    },
    loginButtonSecondary: {
        backgroundColor: colors.background,
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 8,
        borderWidth: 1,
        borderColor: colors.border,
    },
    loginButtonTextSecondary: {
        color: colors.textPrimary,
        fontSize: 16,
        fontWeight: '600',
    },
    forgotButton: {
        marginTop: 15,
        padding: 10,
    },
    forgotText: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    // Email display styles
    emailDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        backgroundColor: colors.background,
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
    },
    emailDisplayText: {
        fontSize: 14,
        color: colors.textPrimary,
        flex: 1,
    },
    changeLink: {
        color: colors.textPrimary,
        fontSize: 14,
        fontWeight: '500',
    },
    // Invitation info styles
    inviteInfoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.success + '20',
        padding: 12,
        borderRadius: 8,
        marginBottom: 15,
        width: '100%',
        gap: 8,
    },
    inviteInfoText: {
        fontSize: 14,
        color: colors.success,
        flex: 1,
    },
    roleText: {
        fontWeight: 'bold',
        color: colors.success,
    },
    // Modal styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 340,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: colors.textPrimary,
        marginBottom: 12,
    },
    modalText: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    modalButtonSecondary: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalButtonPrimary: {
        backgroundColor: colors.primary,
    },
    modalButtonTextSecondary: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    modalButtonTextPrimary: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    // Create account link
    createAccountLink: {
        marginTop: 16,
        alignItems: 'center',
    },
    createAccountText: {
        color: colors.textSecondary,
        fontSize: 14,
    },
    createAccountBold: {
        color: colors.primary,
        fontWeight: 'bold',
    },
    // Workshop selection styles
    workshopSelectionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.primary + '10',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
        gap: 12,
    },
    workshopSelectionText: {
        color: colors.textPrimary,
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    selectWorkshopsButton: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 12,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 16,
    },
    selectWorkshopsButtonText: {
        color: colors.textPrimary,
        fontWeight: '600',
    },
});
