import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';
import { useAuth } from '@/providers/AuthProvider';

interface CustomGoogleButtonProps {
    onPress: () => void
}


const CustomGoogleButton: React.FC<CustomGoogleButtonProps> = ({ onPress }) => {
    const { signingIn } = useAuth();

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.button, signingIn && styles.buttonDisabled]}
            disabled={signingIn}
            onPress={onPress}
        >
            <View style={styles.content}>
                {signingIn ? <ActivityIndicator color={colors.acid} style={{ marginTop: 8 }} /> : <View style={{display: "flex", flexDirection: "row", gap: 10, alignItems: "center"}}>
                    <Ionicons name="logo-google" size={22} color="#000" />
                    <Text style={styles.text}>
                        Continue with Google
                    </Text>
                </View>}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        width: '100%',
        height: 56,
        backgroundColor: '#fff',
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    buttonDisabled: {
        opacity: 0.75,
    },

    content: {
        display: "flex",
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },

    text: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
    },
});

export default CustomGoogleButton
