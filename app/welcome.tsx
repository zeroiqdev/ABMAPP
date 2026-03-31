import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '@/store/authStore';

const { width } = Dimensions.get('window');

const LOGO_URL = 'https://res.cloudinary.com/dyg7neetr/image/upload/v1772036824/ABM_BLACK_g6i4dm.png';
const CAR_URL = 'https://res.cloudinary.com/dyg7neetr/image/upload/v1774606939/Vector_tbcv1d.png';
const ICON_BROWSE = 'https://res.cloudinary.com/dyg7neetr/image/upload/v1774606939/Frame_tkigt4.png';
const ICON_MAINTAIN = 'https://res.cloudinary.com/dyg7neetr/image/upload/v1774606939/Frame_1_nnwofs.png';

type Selection = 'browse' | 'maintain' | null;

export default function WelcomeScreen() {
  const router = useRouter();
  const { setGuest, setPreferredMode } = useAuthStore();
  const [selected, setSelected] = useState<Selection>(null);

  const handleContinue = async () => {
    if (!selected) return;

    await AsyncStorage.setItem('hasSeenWelcome', 'true');

    // Set guest = true because they haven't logged in yet, 
    // but we also track their INTENT (preferredMode)
    setGuest(true);
    setPreferredMode(selected === 'browse' ? 'guest' : 'member');

    if (selected === 'browse') {
      router.replace('/(marketplace)/home');
    } else {
      router.replace('/(marketplace)/member-auth');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Logo */}
      <Image
        source={{ uri: LOGO_URL }}
        style={styles.logo}
        resizeMode="contain"
      />

      {/* Heading */}
      <Text style={styles.heading}>
        How can we help your{'\n'}Car today?
      </Text>

      {/* Car Illustration */}
      <Image
        source={{ uri: CAR_URL }}
        style={styles.carImage}
        resizeMode="contain"
      />

      {/* Option Cards */}
      <View style={styles.cardsRow}>
        <TouchableOpacity
          style={[
            styles.card,
            selected === 'browse' && styles.cardSelected,
          ]}
          onPress={() => setSelected('browse')}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: ICON_BROWSE }}
            style={[styles.cardIcon, selected === 'browse' && styles.cardIconSelected]}
            resizeMode="contain"
          />
          <Text style={[styles.cardTitle, selected === 'browse' && styles.cardTitleSelected]}>
            Browse & Buy Parts
          </Text>
          <Text style={[styles.cardDesc, selected === 'browse' && styles.cardDescSelected]}>
            Find filters, tires, and performance upgrades.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.card,
            selected === 'maintain' && styles.cardSelected,
          ]}
          onPress={() => setSelected('maintain')}
          activeOpacity={0.7}
        >
          <Image
            source={{ uri: ICON_MAINTAIN }}
            style={[styles.cardIcon, selected === 'maintain' && styles.cardIconSelected]}
            resizeMode="contain"
          />
          <Text style={[styles.cardTitle, selected === 'maintain' && styles.cardTitleSelected]}>
            Maintain your Car
          </Text>
          <Text style={[styles.cardDesc, selected === 'maintain' && styles.cardDescSelected]}>
            Schedule repairs, oil changes, or diagnostics.
          </Text>
        </TouchableOpacity>
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[styles.continueButton, !selected && styles.continueButtonDisabled]}
        onPress={handleContinue}
        disabled={!selected}
        activeOpacity={0.8}
      >
        <Text style={styles.continueText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 50,
  },
  logo: {
    width: 80,
    height: 50,
    marginBottom: 30,
  },
  heading: {
    fontSize: 28,
    fontWeight: '800',
    color: '#000',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 20,
  },
  carImage: {
    width: width * 0.85,
    height: width * 0.45,
    marginBottom: 40,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 'auto',
    width: '100%',
  },
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 14,
    padding: 16,
    minHeight: 140,
  },
  cardSelected: {
    borderColor: '#C41E24',
    backgroundColor: '#FFF5F5',
  },
  cardIcon: {
    width: 28,
    height: 28,
    marginBottom: 14,
    tintColor: '#333',
  },
  cardIconSelected: {
    tintColor: '#C41E24',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginBottom: 6,
  },
  cardTitleSelected: {
    color: '#000',
  },
  cardDesc: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },
  cardDescSelected: {
    color: '#666',
  },
  continueButton: {
    width: '100%',
    backgroundColor: '#C41E24',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
