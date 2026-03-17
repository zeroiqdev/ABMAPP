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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/store/authStore';
import { useColors } from '@/constants/design';
import * as AppleAuthentication from 'expo-apple-authentication';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
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
    const styles = getStyles(colors);
    const { setGuest, acceptStaffInvite, registerCustomerAccount, loginWithApple } = useAuthStore();
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

    // Step 1: Check email for existing account or invitation
    const handleEmailContinue = async () => {
        const trimmedEmail = email.trim().toLowerCase();
        if (!trimmedEmail || !trimmedEmail.includes('@')) {
            setError('Please enter a valid email address');
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
                    type: data.role === 'customer' ? 'customer' : 'staff',
                    role: data.role === 'customer' ? 'Customer' : (data.role || 'Staff'),
                    code: data.invitationCode,
                    id: staffDoc.id
                });

                if (data.role === 'customer') {
                    setIsExistingCustomer(true);
                    setExistingWorkshops([data.workshopId]);
                }

                setStep('create');
                setLoading(false);
                return;
            }

            // No invitation found -> Proceed to Login/Signup
            setStep('login');
        } catch (err) {
            console.error('Error checking email:', err);
            setStep('login');
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
            const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
            setGuest(false);

            const userDocRef = doc(db, 'users', userCredential.user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                if (!userData.name || !userData.name.trim()) {
                    setNewUserId(userCredential.user.uid);
                    setFirstName('');
                    setLastName('');
                    setPhone(userData.phone || '');
                    setStep('completeProfile');
                    return;
                }
                navigateUser({ ...userData, role: userData.role } as any);
            } else {
                router.replace('/(marketplace)/home');
            }
        } catch (err: any) {
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                // User doesn't exist - go to create customer flow
                setStep('createCustomer');
            } else if (err.code === 'auth/wrong-password') {
                setError('Incorrect password. Please try again.');
            } else {
                setError(err.message || 'Login failed');
            }
        } finally {
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
                    navigateUser(userData);
                }
            } else {
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
            const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
            const uid = userCredential.user.uid;

            await setDoc(doc(db, 'users', uid), {
                email: email.trim().toLowerCase(),
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
                navigateUser({ ...userDocSnap.data(), role: userDocSnap.data().role } as any);
            } else {
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
        if (userData.role === 'super_admin' || workshopRoles.includes(userData.role)) {
            router.replace('/(workshop)/dashboard');
        } else if (userData.role === 'vendor') {
            if (userData.vendorStatus === 'active') {
                router.replace('/(marketplace)/home');
            } else {
                router.replace('/(marketplace)/vendor-registration');
            }
        } else if (userData.role === 'customer') {
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
                // Check if this is a new user who needs workshop selection & profile setup
                const hasWorkshop = userData.workshopId || (userData.connectedWorkshopIds && userData.connectedWorkshopIds.length > 0);
                if (!hasWorkshop && userData.role === 'customer') {
                    // New Apple user — needs to select workshops and complete profile
                    setNewUserId(userData.id);
                    setIsAppleUser(true);
                    setEmail(userData.email || '');
                    setStep('appleWorkshopSelect');
                } else {
                    navigateUser(userData);
                }
            } else {
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

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>
                    {step === 'email' && 'Sign In'}
                    {step === 'login' && 'Welcome Back'}
                    {step === 'create' && 'Create Account'}
                    {step === 'createCustomer' && 'Create Account'}
                    {step === 'appleWorkshopSelect' && 'Select Workshop'}
                    {step === 'selectWorkshops' && 'Select Workshop'}
                    {step === 'completeProfile' && 'Complete Profile'}
                </Text>
                <View style={{ width: 24 }} />
            </View>

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
                            <Text style={styles.subtitle}>Enter your email to continue</Text>
                            <View style={styles.card}>
                                <View style={styles.inputGroup}>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="your@email.com"
                                        placeholderTextColor={colors.textTertiary}
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                        autoCorrect={false}
                                        autoFocus
                                    />
                                </View>
                            </View>
                            {error ? <Text style={styles.errorText}>{error}</Text> : null}
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleEmailContinue}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={colors.textInverse} />
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
                            <Text style={styles.subtitle}>Enter your password to sign in</Text>
                            <View style={styles.card}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Email</Text>
                                    <View style={styles.emailDisplayRow}>
                                        <Text style={styles.emailDisplayText}>{email}</Text>
                                        <TouchableOpacity onPress={handleBack}>
                                            <Text style={styles.changeLink}>Change</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Password</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Enter password"
                                        placeholderTextColor={colors.textTertiary}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                    />
                                </View>
                            </View>
                            {error ? <Text style={styles.errorText}>{error}</Text> : null}
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleUnifiedAuth}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={colors.textInverse} />
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
                                    You've been invited as {invitation.role}
                                </Text>
                            </View>
                            <Text style={styles.subtitle}>Create your password to get started</Text>
                            <View style={styles.card}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Email</Text>
                                    <Text style={styles.emailDisplayText}>{email}</Text>
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Password</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Create password"
                                        placeholderTextColor={colors.textTertiary}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                    />
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Confirm Password</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Confirm password"
                                        placeholderTextColor={colors.textTertiary}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry
                                    />
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Birthday (Optional)</Text>
                                    <TouchableOpacity
                                        style={styles.dateSelector}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Text style={[styles.dateText, !birthday && { color: colors.textTertiary }]}>
                                            {birthday ? format(birthday, 'MMM dd, yyyy') : 'Select Birthday'}
                                        </Text>
                                        <Ionicons name="calendar-outline" size={20} color={colors.textTertiary} />
                                    </TouchableOpacity>
                                </View>

                                {showDatePicker && (
                                    <DateTimePicker
                                        value={birthday || new Date()}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        maximumDate={new Date()}
                                        onChange={(event, selectedDate) => {
                                            setShowDatePicker(Platform.OS === 'ios');
                                            if (selectedDate) {
                                                setBirthday(selectedDate);
                                            }
                                        }}
                                    />
                                )}
                            </View>
                            {error ? <Text style={styles.errorText}>{error}</Text> : null}
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleCreateAccount}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={colors.textInverse} />
                                ) : (
                                    <Text style={styles.primaryButtonText}>Create Account</Text>
                                )}
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Create New Customer Step */}
                    {step === 'createCustomer' && (
                        <>
                            <Text style={styles.subtitle}>Create your account</Text>
                            <View style={styles.card}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Email</Text>
                                    <Text style={styles.emailDisplayText}>{email}</Text>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Password</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Create password"
                                        placeholderTextColor={colors.textTertiary}
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Confirm Password</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Confirm password"
                                        placeholderTextColor={colors.textTertiary}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry
                                    />
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Birthday (YYYY-MM-DD)</Text>
                                    <TouchableOpacity
                                        style={styles.dateSelector}
                                        onPress={() => setShowDatePicker(true)}
                                    >
                                        <Text style={[styles.dateText, !birthday && { color: colors.textTertiary }]}>
                                            {birthday ? format(birthday, 'MMM dd, yyyy') : 'Select Birthday'}
                                        </Text>
                                        <Ionicons name="calendar-outline" size={20} color={colors.textTertiary} />
                                    </TouchableOpacity>
                                </View>

                                {showDatePicker && (
                                    <DateTimePicker
                                        value={birthday || new Date()}
                                        mode="date"
                                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                        maximumDate={new Date()}
                                        onChange={(event, selectedDate) => {
                                            setShowDatePicker(Platform.OS === 'ios');
                                            if (selectedDate) {
                                                setBirthday(selectedDate);
                                            }
                                        }}
                                    />
                                )}
                            </View>

                            {/* Workshop Selector */}
                            <Text style={[styles.inputLabel, { marginTop: 20, marginBottom: 10 }]}>
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
                                onPress={handleCreateNewCustomer}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color={colors.textInverse} />
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
                            <Text style={styles.subtitle}>Complete your profile</Text>
                            <View style={styles.card}>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>First name</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="First name"
                                        placeholderTextColor={colors.textTertiary}
                                        value={firstName}
                                        onChangeText={setFirstName}
                                        autoCapitalize="words"
                                        autoFocus
                                    />
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Last name</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Last name"
                                        placeholderTextColor={colors.textTertiary}
                                        value={lastName}
                                        onChangeText={setLastName}
                                        autoCapitalize="words"
                                    />
                                </View>
                                <View style={styles.divider} />
                                <View style={styles.inputGroup}>
                                    <Text style={styles.inputLabel}>Phone (optional)</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="Phone number"
                                        placeholderTextColor={colors.textTertiary}
                                        value={phone}
                                        onChangeText={setPhone}
                                        keyboardType="phone-pad"
                                    />
                                </View>
                            </View>
                            {error ? <Text style={styles.errorText}>{error}</Text> : null}
                            <TouchableOpacity
                                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                                onPress={handleCompleteProfile}
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

const getStyles = (colors: any) => StyleSheet.create({
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
        padding: 20,
        paddingBottom: 40,
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
    emailDisplayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    emailDisplayText: {
        fontSize: 16,
        color: colors.textPrimary,
    },
    changeLink: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
    },
    primaryButton: {
        backgroundColor: colors.textPrimary,
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
});
