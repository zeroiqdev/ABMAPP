import React, { useEffect } from 'react';
import { Image, ImageStyle, StyleProp, View } from 'react-native';
import { useConfigStore } from '@/store/configStore';
import { getCarBrandDomain } from '@/constants/carBrands';
import { Ionicons } from '@expo/vector-icons';

interface BrandLogoProps {
    brand: string;
    size?: number;
    style?: StyleProp<ImageStyle>;
    fallbackIcon?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
    brand,
    size = 30,
    style,
    fallbackIcon = 'car-sport'
}) => {
    const { brandfetchKey, fetchConfig } = useConfigStore();
    const domain = getCarBrandDomain(brand);

    useEffect(() => {
        if (!brandfetchKey) {
            fetchConfig();
        }
    }, [brandfetchKey]);

    if (domain && brandfetchKey) {
        const uri = `https://cdn.brandfetch.io/${domain}?c=${brandfetchKey}`;
        return (
            <Image
                source={{ uri }}
                style={[{ width: size, height: size }, style]}
                resizeMode="contain"
            />
        );
    }

    // Fallback if no domain mapping or no key
    return (
        <View style={[{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }, style]}>
            <Ionicons name={fallbackIcon as any} size={size * 0.8} color="#000" />
        </View>
    );
};
