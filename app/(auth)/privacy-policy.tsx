import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/constants/design';

export default function PrivacyPolicyScreen() {
    const router = useRouter();
    const colors = useColors();
    const styles = getStyles(colors);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Policy</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <Text style={styles.lastUpdated}>Last Updated: February 15, 2026</Text>

                <Text style={styles.sectionTitle}>1. Introduction</Text>
                <Text style={styles.paragraph}>
                    ABM Workshop & Marketplace ("we," "our," or "us") is committed to protecting your privacy.
                    This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                    when you use our mobile application.
                </Text>

                <Text style={styles.sectionTitle}>2. Information We Collect</Text>
                <Text style={styles.subTitle}>Personal Information</Text>
                <Text style={styles.paragraph}>
                    When you create an account, we may collect:{'\n'}
                    • Full name{'\n'}
                    • Email address{'\n'}
                    • Phone number{'\n'}
                    • Profile information
                </Text>

                <Text style={styles.subTitle}>Vehicle Information</Text>
                <Text style={styles.paragraph}>
                    If you use workshop services, we may collect:{'\n'}
                    • Vehicle make, model, and year{'\n'}
                    • License plate number{'\n'}
                    • VIN (Vehicle Identification Number){'\n'}
                    • Service and maintenance history
                </Text>

                <Text style={styles.subTitle}>Location Data</Text>
                <Text style={styles.paragraph}>
                    We collect location data only when you use tow request services to calculate distances and
                    provide accurate pricing. Location data is collected only while the app is in use and is not
                    stored permanently.
                </Text>

                <Text style={styles.subTitle}>Photos and Camera</Text>
                <Text style={styles.paragraph}>
                    We access your camera and photo library only when you choose to upload images for service
                    requests, product listings, or profile photos. Images are stored securely in our cloud storage.
                </Text>

                <Text style={styles.sectionTitle}>3. How We Use Your Information</Text>
                <Text style={styles.paragraph}>
                    We use the information we collect to:{'\n'}
                    • Provide, operate, and maintain our services{'\n'}
                    • Process transactions and send related information{'\n'}
                    • Send push notifications about orders, jobs, and service updates{'\n'}
                    • Facilitate tow truck services and distance-based pricing{'\n'}
                    • Improve our app and develop new features{'\n'}
                    • Communicate with you about your account and services{'\n'}
                    • Detect and prevent fraud or abuse
                </Text>

                <Text style={styles.sectionTitle}>4. Data Sharing</Text>
                <Text style={styles.paragraph}>
                    We may share your information with:{'\n'}
                    • Workshop service providers you interact with{'\n'}
                    • Payment processors (Monnify) to process transactions{'\n'}
                    • Cloud service providers (Firebase, Cloudinary) for data storage{'\n'}
                    • Law enforcement when required by law{'\n\n'}
                    We do not sell your personal information to third parties.
                </Text>

                <Text style={styles.sectionTitle}>5. Data Security</Text>
                <Text style={styles.paragraph}>
                    We implement industry-standard security measures to protect your data, including encrypted
                    data transmission, secure authentication via Firebase, and access controls. However, no
                    method of electronic storage is 100% secure.
                </Text>

                <Text style={styles.sectionTitle}>6. Data Retention</Text>
                <Text style={styles.paragraph}>
                    We retain your personal data for as long as your account is active or as needed to provide
                    services. You can request deletion of your account and associated data at any time through
                    the Settings section of the app.
                </Text>

                <Text style={styles.sectionTitle}>7. Your Rights</Text>
                <Text style={styles.paragraph}>
                    You have the right to:{'\n'}
                    • Access your personal data{'\n'}
                    • Correct inaccurate data{'\n'}
                    • Delete your account and data{'\n'}
                    • Opt out of push notifications{'\n'}
                    • Opt out of email notifications{'\n'}
                    • Withdraw consent for data processing
                </Text>

                <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
                <Text style={styles.paragraph}>
                    Our service is not intended for users under the age of 13. We do not knowingly collect
                    personal information from children under 13.
                </Text>

                <Text style={styles.sectionTitle}>9. Changes to This Policy</Text>
                <Text style={styles.paragraph}>
                    We may update this Privacy Policy from time to time. We will notify you of any changes
                    by posting the new policy in the app and updating the "Last Updated" date.
                </Text>

                <Text style={styles.sectionTitle}>10. Contact Us</Text>
                <Text style={styles.paragraph}>
                    If you have questions about this Privacy Policy or our data practices, please contact us at:
                </Text>
                <TouchableOpacity onPress={() => Linking.openURL('mailto:support@abmtek.com')}>
                    <Text style={styles.link}>support@abmtek.com</Text>
                </TouchableOpacity>

                <View style={{ height: 60 }} />
            </ScrollView>
        </View>
    );
}

const getStyles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: colors.background,
        },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 20,
            paddingTop: 60,
            backgroundColor: colors.background,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        backButton: {
            padding: 4,
        },
        headerTitle: {
            fontSize: 17,
            fontWeight: '600',
            color: colors.textPrimary,
        },
        content: {
            flex: 1,
        },
        contentContainer: {
            padding: 20,
        },
        lastUpdated: {
            fontSize: 13,
            color: colors.textTertiary,
            marginBottom: 24,
        },
        sectionTitle: {
            fontSize: 18,
            fontWeight: '700',
            color: colors.textPrimary,
            marginTop: 24,
            marginBottom: 8,
        },
        subTitle: {
            fontSize: 15,
            fontWeight: '600',
            color: colors.textPrimary,
            marginTop: 12,
            marginBottom: 4,
        },
        paragraph: {
            fontSize: 15,
            lineHeight: 22,
            color: colors.textSecondary,
            marginBottom: 12,
        },
        link: {
            fontSize: 15,
            color: '#007AFF',
            textDecorationLine: 'underline',
            marginBottom: 12,
        },
    });
