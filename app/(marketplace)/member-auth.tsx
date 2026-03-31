import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    useColorScheme,
    Image,
    Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { firebaseService } from '@/services/firebaseService';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/constants/design';
import * as AppleAuthentication from 'expo-apple-authentication';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, limit } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { WorkshopSelectorModal } from '@/components/WorkshopSelectorModal';

// Account flow steps
type AuthStep = 'email' | 'login' | 'create' | 'createCustomer' | 'selectWorkshops' | 'completeProfile' | 'appleWorkshopSelect';

// Workshop Roles - for routing after login
const workshopRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor', 'super_admin'];

export default function MemberAuthScreen() {
    const router = useRouter();
    const colors = useColors();
    const isDark = useColorScheme() === 'dark';
    const styles = getStyles(colors, isDark);
    const { user, login, setGuest, setUser, acceptStaffInvite, registerCustomerAccount, loginWithApple, setProfileLoaded } = useAuthStore();
    const colorScheme = useColorScheme();

    // Auth state
    const [step, setStep] = useState<AuthStep>('email');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Profile completion state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');

    // Invitation info
    const [invitation, setInvitation] = useState<{
        type: 'staff' | 'customer' | null;
        role: string;
        code: string;
        id: string;
    } | null>(null);

    // Existing customer detection
    const [isExistingCustomer, setIsExistingCustomer] = useState(false);
    const [existingWorkshops, setExistingWorkshops] = useState<string[]>([]);

    // Workshop selection
    const [selectedWorkshopIds, setSelectedWorkshopIds] = useState<string[]>([]);
    const [showWorkshopSelector, setShowWorkshopSelector] = useState(false);

    // Birthday field
    const [birthday, setBirthday] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // New user ID for profile completion
    const [newUserId, setNewUserId] = useState<string | null>(null);

    // Track if user signed in with Apple (already authenticated, no password needed)
    const [isAppleUser, setIsAppleUser] = useState(false);

    // Navigation state for clearing screen after success
    const [isNavigating, setIsNavigating] = useState(false);

    // AUTO-NAVIGATE: If a user is already logged in, send them to their dashboard immediately.
    // This prevents trapped users on the login screen after a splash timeout.
    React.useEffect(() => {
        if (user && !isNavigating) {
            console.log('[MemberAuth] Auto-navigating authenticated user:', user.email);
            navigateUser(user);
        }
    }, [user]);

    const handleEmailContinue = async () => {
        const trimmedEmail = email.trim().toLowerCase();
        const originalEmail = email.trim();
        
        if (!trimmedEmail || !trimmedEmail.includes('@')) {
            setError('Please enter a valid email address');
            return;
        }

        setLoading(true);
        setError('');
        setInvitation(null);

        try {
            // 1. Check if user already exists in Firestore (Priority 1)
            // Try both lowercase (standard) and original (fallback)
            const userQ = query(
                collection(db, 'users'),
                where('email', 'in', [trimmedEmail, originalEmail])
            );
            const userSnap = await getDocs(userQ);
            let foundUser = false;
            if (!userSnap.empty) {
                foundUser = true;
                setStep('login');
            } else {
                // 2. Failsafe: Check Firebase Auth directly if Firestore check is inconclusive
                try {
                    await signInWithEmailAndPassword(auth, trimmedEmail, 'check-existence-only-dummy');
                    foundUser = true;
                    setStep('login');
                } catch (authErr: any) {
                    if (
                        authErr.code === 'auth/wrong-password' || 
                        authErr.code === 'auth/too-many-requests' ||
                        authErr.code === 'auth/invalid-credential'
                    ) {
                        foundUser = true;
                        setStep('login');
                    }
                }
            }

            // 3. Check for invitations (Priority 2) - ALWAYS check, even if user found
            const staffQ = query(
                collection(db, 'staffInvitations'),
                where('email', 'in', [trimmedEmail, originalEmail, email.trim().toLowerCase().replace(/\+.*@/, '@')])
            );
            const staffSnap = await getDocs(staffQ);
 
            if (!staffSnap.empty) {
                const staffDoc = staffSnap.docs[0];
                const data = staffDoc.data();
                const rawRole = (data.role || '').toLowerCase().trim();
                
                // If it's already used, we simply proceed to login flow without bothering the user with a signal to accept it
                if (data.used) {
                    setStep('login');
                } else {
                    setInvitation({
                        type: rawRole === 'customer' ? 'customer' : 'staff',
                        role: rawRole === 'vendor' ? 'Vendor' : (rawRole === 'customer' ? 'Customer' : (data.role || 'Staff')),
                        code: data.invitationCode,
                        id: staffDoc.id
                    });
                }
 
                if (rawRole === 'customer') {
                    setIsExistingCustomer(true);
                    setExistingWorkshops([data.workshopId]);
                }
 
                // Only change step to 'create' if the user DOES NOT have an account yet AND has a valid invite
                if (!foundUser && !data.used) {
                    setStep('create');
                }
                setLoading(false);
                return;
            }

            // 4. Completely new user -> Route to customer registration
            if (!foundUser) {
                setStep('createCustomer');
            }
        } catch (err: any) {
            console.error('Error checking email:', err);
            // SURFACE the error so we know if an index is missing!
            setError(`Account check error: ${err.message || 'Unknown error'}`);
            // Fallback to customer signup as a survival measure, but the error will be visible
            setStep('createCustomer');
        } finally {
            setLoading(false);
        }
    };

    // Handle unified login/signup
    const handleUnifiedAuth = async () => {
        if (!password) {
            setError('Please enter your password');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Use the store's login() which atomically sets user + firebaseUser + isGuest
            await login(email.trim(), password);
 
            // SUCCESS! Now check if we have a pending invitation to process
            if (invitation) {
                try {
                    // acceptStaffInvite handles role promotion for existing accounts
                    await acceptStaffInvite(email.trim(), password, invitation.code);
                    console.log('[Login] Successfully accepted invitation for existing user');
                } catch (acceptErr) {
                    console.error('[Login] Error accepting invitation during login:', acceptErr);
                    // Non-blocking for the login itself
                }
            } else {
                // Failsafe: Check the database one last time just in case the UI missed it
                const staffQ = query(
                    collection(db, 'staffInvitations'),
                    where('email', 'in', [email.toLowerCase().trim(), email.trim()]),
                    where('used', '==', false),
                    limit(1)
                );
                const staffSnap = await getDocs(staffQ);
                if (!staffSnap.empty) {
                    const data = staffSnap.docs[0].data();
                    if (data.role?.toLowerCase() === 'vendor') {
                        await acceptStaffInvite(email.trim(), password, data.invitationCode);
                    }
                }
            }
 
            // Get the fully hydrated user from the store
            const userData = useAuthStore.getState().user;
            
            if (userData) {
                if (!userData.name || !userData.name.trim()) {
                    setNewUserId(userData.id);
                    setFirstName('');
                    setLastName('');
                    setPhone(userData.phone || '');
                    setStep('completeProfile');
                    return;
                }
                setIsNavigating(true);
                navigateUser(userData);
            } else {
                setIsNavigating(true);
                router.replace('/(marketplace)/home');
            }
        } catch (err: any) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                // User doesn't exist - Check if we have an invitation
                if (invitation) {
                    setStep('create'); // Go to registration for invited users
                } else {
                    setStep('createCustomer'); // Normal new customer flow
                }
            } else if (err.code === 'auth/wrong-password') {
                setError('Incorrect password. Please try again.');
            } else if (err.message === 'User data not found') {
                // Firebase Auth account exists but no Firestore document
                router.replace('/(marketplace)/home');
            } else {
                setError(err.message || 'Login failed');
            }
            // Reset loading ONLY on error. Success will be handled by navigation.
            setLoading(false);
        }
    };

    // Handle invited or existing user account creation
    const handleCreateAccount = async () => {
        if (!password || password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!birthday) {
            setError('Please enter your birthday');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (invitation?.type === 'staff') {
                await acceptStaffInvite(email.trim(), password, invitation.code, birthday ? format(birthday, 'yyyy-MM-dd') : undefined);
            } else {
                // For existing customers or general signup
                await registerCustomerAccount(email.trim(), password, undefined, undefined, undefined, birthday ? format(birthday, 'yyyy-MM-dd') : undefined);
            }
            setGuest(false);

            // Navigate user after successful creation
            const userData = useAuthStore.getState().user;
            if (userData) {
                if (userData.needsProfileCompletion || !userData.name) {
                    setNewUserId(userData.id);
                    setStep('completeProfile');
                } else {
                    setIsNavigating(true);
                    navigateUser(userData);
                }
            } else {
                setIsNavigating(true);
                router.replace('/(marketplace)/home');
            }
        } catch (err: any) {
            setError(err.message || 'Account creation failed');
        } finally {
            setLoading(false);
        }
    };

    // Handle new customer creation
    const handleCreateNewCustomer = async () => {
        if (!password || password.length < 6) {
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
            // REDUNDANT CHECK: Look for invitations one last time before creating a customer
            // This catches vendors who might have ended up in this flow by mistake (e.g. via Apple or minor typos)
            const trimmedEmail = email.toLowerCase().trim();
            const staffQ = query(
                collection(db, 'staffInvitations'),
                where('email', 'in', [trimmedEmail, email.trim()]),
                where('used', '==', false),
                limit(1)
            );
            const staffSnap = await getDocs(staffQ);
            
            if (!staffSnap.empty) {
                const doc = staffSnap.docs[0];
                const data = doc.data();
                
                // If a vendor invitation exists, REDIRECT them to the correct flow
                if (data.role?.toLowerCase() === 'vendor') {
                    setInvitation({
                        type: 'staff',
                        role: 'Vendor',
                        code: data.invitationCode,
                        id: doc.id
                    });
                    setStep('create');
                    setError('A vendor invitation was found for this email. Please complete your registration here.');
                    setLoading(false);
                    return;
                }
            }

            const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const uid = userCredential.user.uid;

            await setDoc(doc(db, 'users', uid), {
                id: uid,
                email: trimmedEmail,
                role: 'customer',
                selectedWorkshopIds: selectedWorkshopIds,
                connectedWorkshopIds: selectedWorkshopIds,
                workshopId: selectedWorkshopIds[0] || '',
                birthday: birthday ? format(birthday, 'yyyy-MM-dd') : '',
                createdAt: new Date(),
                updatedAt: new Date(),
                needsProfileCompletion: true,
            });

            setNewUserId(uid);
            setStep('completeProfile');
        } catch (err: any) {
            if (err.code === 'auth/email-already-in-use') {
                setError('This email is already registered. Please sign in instead.');
                setStep('login');
            } else {
                setError(err.message || 'Account creation failed');
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle Apple user workshop selection (already authenticated, just needs workshops)
    const handleAppleWorkshopSave = async () => {
        if (selectedWorkshopIds.length === 0) {
            setError('Please select at least one workshop');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const uid = newUserId || auth.currentUser?.uid;
            if (!uid) throw new Error('User ID not found');

            await updateDoc(doc(db, 'users', uid), {
                selectedWorkshopIds: selectedWorkshopIds,
                workshopId: selectedWorkshopIds[0],
                connectedWorkshopIds: selectedWorkshopIds,
            });

            setStep('completeProfile');
        } catch (err: any) {
            setError(err.message || 'Failed to save workshop selection');
        } finally {
            setLoading(false);
        }
    };

    // Handle profile completion
    const handleCompleteProfile = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            setError('Please enter your first and last name');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const uid = newUserId || auth.currentUser?.uid;
            if (!uid) throw new Error('User ID not found');

            await updateDoc(doc(db, 'users', uid), {
                name: `${firstName.trim()} ${lastName.trim()}`,
                phone: phone.trim(),
                needsProfileCompletion: false,
            });

            setGuest(false);

            const userDocRef = doc(db, 'users', uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                navigateUser({ ...userDocSnap.data(), id: userDocSnap.id } as any);
            } else {
                setIsNavigating(true);
                router.replace('/(customer)/home');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to save profile');
        } finally {
            setLoading(false);
        }
    };

    // Navigate user based on role
    const navigateUser = (userData: any) => {
        // Activate full-screen loading shield
        setIsNavigating(true);

        // CRITICAL: Set the user in the auth store so the entire app knows we're logged in
        const userForStore = {
            ...userData,
            id: userData.id || auth.currentUser?.uid,
            createdAt: userData.createdAt?.toDate ? userData.createdAt.toDate() : (userData.createdAt || new Date()),
            updatedAt: userData.updatedAt?.toDate ? userData.updatedAt.toDate() : (userData.updatedAt || new Date()),
        };
        setUser(userForStore);
        setGuest(false);
        setProfileLoaded(true); // Manually set loaded during login navigation

        const role = (userData.role || '').toLowerCase().trim();
        const hasVendorStatus = !!userData.vendorStatus;
        const workshopRoles = ['admin', 'technician', 'storekeeper', 'accountant', 'service_advisor', 'super_admin'];
        
        if (role === 'super_admin' || workshopRoles.includes(role)) {
            router.replace('/(workshop)/dashboard');
        } else if (role === 'vendor' || hasVendorStatus) {
            const status = (userData.vendorStatus || '').toLowerCase().trim();
            // Legacy vendors (no status but role=vendor) should NOT be forced to register
            const isExplicitlyUnregistered = status === 'pending_details' || status === 'rejected';

            if (isExplicitlyUnregistered) {
                router.replace('/(marketplace)/vendor-registration');
            } else if (status === 'pending_approval') {
                router.replace('/(marketplace)/pending-approval');
            } else {
                router.replace('/(marketplace)/home');
            }
        } else if (role === 'customer') {
            router.replace('/(customer)/home');
        } else if (userData.workshopId) {
            router.replace('/(workshop)/dashboard');
        } else {
            router.replace('/(customer)/home');
        }
    };

    const handleBack = () => {
        if (step === 'email') {
            router.back();
        } else if (step === 'completeProfile') {
            // Can't go back from profile completion
        } else {
            setStep('email');
            setPassword('');
            setConfirmPassword('');
            setError('');
        }
    };

    const handleAppleSignIn = async () => {
        setLoading(true);
        setError('');
        try {
            await loginWithApple();
            setGuest(false);
            // Get user data from store after login
            const userData = useAuthStore.getState().user;
            if (userData) {
                // If this is a new Apple user, we MUST check if they have a pending vendor invitation
                // before routing them to the workshop selection screen.
                const userEmail = userData.email || auth.currentUser?.email;
                let hasVendorInvite = false;
                
                if (userEmail) {
                    const staffQ = query(
                        collection(db, 'staffInvitations'),
                        where('email', 'in', [userEmail.toLowerCase().trim(), userEmail.trim()]),
                        where('used', '==', false),
                        limit(1)
                    );
                    const staffSnap = await getDocs(staffQ);
                    if (!staffSnap.empty) {
                        hasVendorInvite = true;
                    }
                }

                // Check if this is a new user who needs workshop selection & profile setup
                const hasWorkshop = userData.workshopId || (userData.connectedWorkshopIds && userData.connectedWorkshopIds.length > 0);
                
                if (!hasWorkshop && userData.role === 'customer' && !hasVendorInvite) {
                    // New Apple user — needs to select workshops and complete profile
                    setNewUserId(userData.id);
                    setIsAppleUser(true);
                    setEmail(userEmail || '');
                    setStep('appleWorkshopSelect');
                } else {
                    setIsNavigating(true);
                    navigateUser(userData);
                }
            } else {
                setIsNavigating(true);
                router.replace('/(marketplace)/home');
            }
        } catch (err: any) {
            if (err.code !== 'ERR_REQUEST_CANCELED') {
                setError(err.message || 'Apple Sign In failed');
            }
        } finally {
            setLoading(false);
        }
    };

    if (isNavigating) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header - Only show for steps after email for back navigation */}
            {step !== 'email' && (
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {step === 'login' && 'Sign In'}
                        {step === 'create' && 'Create Account'}
                        {step === 'createCustomer' && 'Create Account'}
                        {step === 'appleWorkshopSelect' && 'Select Workshop'}
                        {step === 'selectWorkshops' && 'Select Workshop'}
                        {step === 'completeProfile' && 'Complete Profile'}
                    </Text>
                    <View style={{ width: 24 }} />
                </View>
            )}

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.contentContainer}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Email Step */}
                    {step === 'email' && (
                        <>
                            <Text style={[styles.welcomeHeading, { marginTop: 100 }]}>Welcome</Text>
                            <Text style={styles.welcomeSubtitle}>Sign in to your account.</Text>

                            <Text style={styles.emailLabel}>Email</Text>
                            <View style={styles.emailInputContainer}>
                                <TextInput
                                    style={styles.emailInput}
                                    placeholder="Enter Email here"
                                    placeholderTextColor={'#bbb'}
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    autoCorrect={false}
                                    autoFocus
                                />
                            </View>
                            {error ? <Text style={styles.errorText}>{error}</Text> : null}
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleEmailContinue}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Continue</Text>
                                )}
                            </TouchableOpacity>

                            {Platform.OS === 'ios' && (
                                <>
                                    <View style={styles.orDivider}>
                                        <View style={styles.orDividerLine} />
                                        <Text style={styles.orDividerText}>or</Text>
                                        <View style={styles.orDividerLine} />
                                    </View>

                                    <AppleAuthentication.AppleAuthenticationButton
                                        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                                        buttonStyle={
                                            colorScheme === 'dark'
                                                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                                                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                                        }
                                        cornerRadius={12}
                                        style={styles.appleButton}
                                        onPress={handleAppleSignIn}
                                    />
                                </>
                            )}
                        </>
                    )}

                    {/* Login Step */}
                    {step === 'login' && (
                        <>
                            <Text style={styles.welcomeHeading}>Welcome Back</Text>
                            <Text style={styles.welcomeSubtitle}>Enter your password to sign in.</Text>

                            <Text style={styles.emailLabel}>Email</Text>
                            <View style={[styles.emailInputContainer, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                                <Text style={styles.emailDisplayText}>{email}</Text>
                                <TouchableOpacity onPress={handleBack}>
                                    <Text style={styles.changeLink}>Change</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.emailLabel}>Password</Text>
                            <View style={styles.emailInputContainer}>
                                <TextInput
                                    style={styles.emailInput}
                                    placeholder="Enter password"
                                    placeholderTextColor={'#bbb'}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    autoFocus
                                />
                            </View>

                            {error ? <Text style={styles.errorText}>{error}</Text> : null}
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleUnifiedAuth}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Sign In</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Create Invited Account Step */}
                    {step === 'create' && invitation && (
                        <>
                            <View style={styles.invitationBadge}>
                                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                                <Text style={styles.invitationText}>
                                    Invitation: {invitation.role}
                                </Text>
                            </View>
                            <Text style={styles.welcomeHeading}>Set Password</Text>
                            <Text style={styles.welcomeSubtitle}>Create your password to get started.</Text>

                            <Text style={styles.emailLabel}>Email</Text>
                            <View style={styles.emailInputContainer}>
                                <Text style={styles.emailDisplayText}>{email}</Text>
                            </View>

                            <Text style={styles.emailLabel}>Password</Text>
                            <View style={styles.emailInputContainer}>
                                <TextInput
                                    style={styles.emailInput}
                                    placeholder="Create password"
                                    placeholderTextColor={'#bbb'}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                            </View>

                            <Text style={styles.emailLabel}>Confirm Password</Text>
                            <View style={styles.emailInputContainer}>
                                <TextInput
                                    style={styles.emailInput}
                                    placeholder="Confirm password"
                                    placeholderTextColor={'#bbb'}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                />
                            </View>

                            <Text style={styles.emailLabel}>Birthday (Optional)</Text>
                            <TouchableOpacity
                                style={styles.emailInputContainer}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={[styles.emailInput, !birthday && { color: '#bbb' }]}>
                                        {birthday ? format(birthday, 'MMM dd, yyyy') : 'Select Birthday'}
                                    </Text>
                                    <Ionicons name="calendar-outline" size={20} color={'#999'} />
                                </View>
                            </TouchableOpacity>

                            {showDatePicker && (
                                <View>
                                    {Platform.OS === 'ios' && (
                                        <TouchableOpacity
                                            style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 12 }}
                                            onPress={() => setShowDatePicker(false)}
                                        >
                                            <Text style={{ color: '#C41E24', fontWeight: '600', fontSize: 16 }}>Done</Text>
                                        </TouchableOpacity>
                                    )}
                                    <DateTimePicker
                                        value={birthday || new Date()}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        maximumDate={new Date()}
                                        onChange={(event, selectedDate) => {
                                            if (Platform.OS !== 'ios') {
                                                setShowDatePicker(false);
                                            }
                                            if (selectedDate) {
                                                setBirthday(selectedDate);
                                            }
                                        }}
                                    />
                                </View>
                            )}

                            {error ? <Text style={styles.errorText}>{error}</Text> : null}
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleCreateAccount}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Create Account</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Create New Customer Step */}
                    {step === 'createCustomer' && (
                        <>
                            <Text style={styles.welcomeHeading}>Create Account</Text>
                            <Text style={styles.welcomeSubtitle}>Join ABM as a new customer.</Text>

                            <Text style={styles.emailLabel}>Email</Text>
                            <View style={styles.emailInputContainer}>
                                <Text style={styles.emailDisplayText}>{email}</Text>
                            </View>

                            <Text style={styles.emailLabel}>Password</Text>
                            <View style={styles.emailInputContainer}>
                                <TextInput
                                    style={styles.emailInput}
                                    placeholder="Create password"
                                    placeholderTextColor={'#bbb'}
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                            </View>

                            <Text style={styles.emailLabel}>Confirm Password</Text>
                            <View style={styles.emailInputContainer}>
                                <TextInput
                                    style={styles.emailInput}
                                    placeholder="Confirm password"
                                    placeholderTextColor={'#bbb'}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry
                                />
                            </View>

                            <Text style={styles.emailLabel}>Birthday</Text>
                            <TouchableOpacity
                                style={styles.emailInputContainer}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={[styles.emailInput, !birthday && { color: '#bbb' }]}>
                                        {birthday ? format(birthday, 'MMM dd, yyyy') : 'Select Birthday'}
                                    </Text>
                                    <Ionicons name="calendar-outline" size={20} color={'#999'} />
                                </View>
                            </TouchableOpacity>

                            {showDatePicker && (
                                <View>
                                    {Platform.OS === 'ios' && (
                                        <TouchableOpacity
                                            style={{ alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 12 }}
                                            onPress={() => setShowDatePicker(false)}
                                        >
                                            <Text style={{ color: '#C41E24', fontWeight: '600', fontSize: 16 }}>Done</Text>
                                        </TouchableOpacity>
                                    )}
                                    <DateTimePicker
                                        value={birthday || new Date()}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        maximumDate={new Date()}
                                        onChange={(event, selectedDate) => {
                                            if (Platform.OS !== 'ios') {
                                                setShowDatePicker(false);
                                            }
                                            if (selectedDate) {
                                                setBirthday(selectedDate);
                                            }
                                        }}
                                    />
                                </View>
                            )}

                            <Text style={styles.emailLabel}>Select Workshop(s)</Text>
                            <TouchableOpacity
                                style={styles.emailInputContainer}
                                onPress={() => setShowWorkshopSelector(true)}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={[styles.emailInput, selectedWorkshopIds.length === 0 && { color: '#bbb' }]}>
                                        {selectedWorkshopIds.length === 0
                                            ? 'Select Workshop'
                                            : `${selectedWorkshopIds.length} workshop${selectedWorkshopIds.length > 1 ? 's' : ''} selected`}
                                    </Text>
                                    <Ionicons name="chevron-down" size={20} color={'#999'} />
                                </View>
                            </TouchableOpacity>

                            {error ? <Text style={styles.errorText}>{error}</Text> : null}
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleCreateNewCustomer}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Create Account</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Apple User Workshop Selection Step */}
                    {step === 'appleWorkshopSelect' && (
                        <>
                            <Text style={styles.subtitle}>Select your workshop to get started</Text>

                            <Text style={[styles.inputLabel, { marginTop: 10, marginBottom: 10 }]}>
                                Select Workshop(s)
                            </Text>
                            <TouchableOpacity
                                style={styles.workshopButton}
                                onPress={() => setShowWorkshopSelector(true)}
                            >
                                <Text style={{ color: selectedWorkshopIds.length === 0 ? colors.textTertiary : colors.textPrimary }}>
                                    {selectedWorkshopIds.length === 0
                                        ? 'Select Workshop'
                                        : `${selectedWorkshopIds.length} workshop${selectedWorkshopIds.length > 1 ? 's' : ''} selected`}
                                </Text>
                                <Ionicons name="chevron-down" size={20} color={colors.textTertiary} />
                            </TouchableOpacity>

                            {error ? <Text style={styles.errorText}>{error}</Text> : null}
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleAppleWorkshopSave}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={colors.textInverse} />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Continue</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Complete Profile Step */}
                    {step === 'completeProfile' && (
                        <>
                            <Text style={styles.welcomeHeading}>Profile</Text>
                            <Text style={styles.welcomeSubtitle}>Tell us a bit about yourself.</Text>

                            <Text style={styles.emailLabel}>First Name</Text>
                            <View style={styles.emailInputContainer}>
                                <TextInput
                                    style={styles.emailInput}
                                    placeholder="Enter first name"
                                    placeholderTextColor={'#bbb'}
                                    value={firstName}
                                    onChangeText={setFirstName}
                                    autoCapitalize="words"
                                    autoFocus
                                />
                            </View>

                            <Text style={styles.emailLabel}>Last Name</Text>
                            <View style={styles.emailInputContainer}>
                                <TextInput
                                    style={styles.emailInput}
                                    placeholder="Enter last name"
                                    placeholderTextColor={'#bbb'}
                                    value={lastName}
                                    onChangeText={setLastName}
                                    autoCapitalize="words"
                                />
                            </View>

                            <Text style={styles.emailLabel}>Phone (Optional)</Text>
                            <View style={styles.emailInputContainer}>
                                <TextInput
                                    style={styles.emailInput}
                                    placeholder="Enter phone number"
                                    placeholderTextColor={'#bbb'}
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                />
                            </View>

                            {error ? <Text style={styles.errorText}>{error}</Text> : null}
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleCompleteProfile}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Continue</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

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
        </View>
    );
}

const getStyles = (colors: any, isDark: boolean) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: colors.background,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.textPrimary,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 24,
        paddingBottom: 60,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: 20,
    },
    card: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    inputGroup: {
        padding: 16,
    },
    inputLabel: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: 8,
    },
    input: {
        fontSize: 16,
        color: colors.textPrimary,
        padding: 0,
    },
    divider: {
        height: 1,
        backgroundColor: colors.border,
    },
    emailDisplayContainer: {
        padding: 16,
        backgroundColor: isDark ? '#fff' : 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        marginBottom: 20,
    },
    inputLabelInner: {
        fontSize: 12,
        color: isDark ? '#666' : colors.textSecondary,
        marginBottom: 4,
    },
    emailDisplayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    emailDisplayText: {
        fontSize: 16,
        color: isDark ? '#000' : '#fff',
    },
    changeLink: {
        fontSize: 14,
        color: isDark ? '#000' : colors.primary,
        fontWeight: '600',
    },
    primaryButton: {
        backgroundColor: '#C41E24',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 24,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    primaryButtonText: {
        color: colors.textInverse,
        fontSize: 16,
        fontWeight: '600',
    },
    errorText: {
        color: colors.error,
        fontSize: 14,
        textAlign: 'center',
        marginTop: 12,
    },
    invitationBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.success + '20',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 16,
        gap: 8,
    },
    invitationText: {
        fontSize: 14,
        color: colors.success,
        fontWeight: '600',
    },
    workshopButton: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    orDivider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    orDividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: colors.border,
    },
    orDividerText: {
        marginHorizontal: 12,
        color: colors.textTertiary,
        fontSize: 14,
    },
    appleButton: {
        width: '100%',
        height: 50,
    },
    dateSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        backgroundColor: 'transparent',
    },
    dateText: {
        fontSize: 16,
        color: colors.textPrimary,
    },
    welcomeHeading: {
        fontSize: 32,
        fontWeight: '800',
        color: colors.textPrimary,
        marginBottom: 4,
    },
    welcomeSubtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        marginBottom: 20,
    },
    emailLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: isDark ? '#FFF' : '#000',
        marginTop: 14,
        marginBottom: 4,
    },
    emailInputContainer: {
        backgroundColor: isDark ? '#F5F5F5' : '#333',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    emailInput: {
        fontSize: 16,
        color: isDark ? '#000' : '#FFF',
        padding: 0,
    },
});
