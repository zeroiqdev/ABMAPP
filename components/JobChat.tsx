import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Modal,
    SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { firebaseService } from '@/services/firebaseService';
import { ChatMessage, User } from '@/types';
import { Colors, Spacing } from '@/constants/design';
import { format } from 'date-fns';

interface JobChatProps {
    jobId: string;
    currentUser: User;
    visible: boolean;
    onClose: () => void;
    messages: ChatMessage[];
}

export default function JobChat({ jobId, currentUser, visible, onClose, messages }: JobChatProps) {
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Mark messages as read when they appear and modal is visible
    useEffect(() => {
        if (visible && messages.length > 0) {
            const unreadIds = messages
                .filter((m) => !m.readBy.includes(currentUser.id))
                .map((m) => m.id);

            if (unreadIds.length > 0) {
                firebaseService.markMessagesAsRead(jobId, unreadIds, currentUser.id).catch(console.error);
            }
        }
    }, [visible, messages, currentUser.id, jobId]);

    const handleSend = async () => {
        if (!inputText.trim()) return;

        setSending(true);
        try {
            await firebaseService.sendJobMessage(jobId, {
                senderId: currentUser.id,
                senderName: currentUser.name || 'Unknown',
                senderRole: currentUser.role,
                text: inputText.trim(),
                readBy: [currentUser.id],
            });
            setInputText('');
        } catch (error) {
            Alert.alert('Error', 'Failed to send message');
            console.error(error);
        } finally {
            setSending(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.7,
            allowsEditing: true,
        });

        if (!result.canceled && result.assets[0]) {
            uploadImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri: string) => {
        setSending(true);
        try {
            const imageUrl = await firebaseService.uploadChatImage(uri, jobId);
            await firebaseService.sendJobMessage(jobId, {
                senderId: currentUser.id,
                senderName: currentUser.name || 'Unknown',
                senderRole: currentUser.role,
                imageUrl,
                readBy: [currentUser.id],
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to upload image');
            console.error(error);
        } finally {
            setSending(false);
        }
    };

    const renderMessage = ({ item }: { item: ChatMessage }) => {
        const isOwn = item.senderId === currentUser.id;
        return (
            <View style={[styles.messageRow, isOwn ? styles.ownMessageRow : styles.otherMessageRow]}>
                {!isOwn && (
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{item.senderName.charAt(0).toUpperCase()}</Text>
                    </View>
                )}
                <View style={[styles.messageBubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
                    {!isOwn && <Text style={styles.senderName}>{item.senderName}</Text>}

                    {item.imageUrl ? (
                        <Image source={{ uri: item.imageUrl }} style={styles.messageImage} resizeMode="cover" />
                    ) : (
                        <Text style={[styles.messageText, isOwn ? styles.ownMessageText : styles.otherMessageText]}>
                            {item.text}
                        </Text>
                    )}

                    <Text style={[styles.timestamp, isOwn ? styles.ownTimestamp : styles.otherTimestamp]}>
                        {item.createdAt ? format(item.createdAt, 'HH:mm') : '...'}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Chat</Text>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <Ionicons name="close" size={24} color="#000" />
                    </TouchableOpacity>
                </View>

                <KeyboardAvoidingView
                    style={styles.keyboardView}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <FlatList
                        ref={flatListRef}
                        data={[...messages].reverse()}
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.id}
                        inverted
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
                            </View>
                        }
                    />

                    <View style={styles.inputContainer}>
                        <TouchableOpacity style={styles.attachButton} onPress={pickImage} disabled={sending}>
                            <Ionicons name="image-outline" size={24} color={Colors.primary} />
                        </TouchableOpacity>

                        <TextInput
                            style={styles.input}
                            value={inputText}
                            onChangeText={setInputText}
                            placeholder="Type a message..."
                            multiline
                            maxLength={500}
                        />

                        <TouchableOpacity
                            style={[styles.sendButton, (!inputText.trim() && !sending) && styles.sendButtonDisabled]}
                            onPress={handleSend}
                            disabled={!inputText.trim() || sending}
                        >
                            {sending ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Ionicons name="send" size={20} color="#fff" />
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    keyboardView: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: '#fff',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
    },
    closeButton: {
        position: 'absolute',
        right: 16,
        padding: 4,
    },
    listContent: {
        padding: Spacing.md,
    },
    emptyContainer: {
        padding: Spacing.xl,
        alignItems: 'center',
    },
    emptyText: {
        color: Colors.textTertiary,
        fontStyle: 'italic',
    },
    messageRow: {
        flexDirection: 'row',
        marginBottom: Spacing.md,
        alignItems: 'flex-end',
    },
    ownMessageRow: {
        justifyContent: 'flex-end',
    },
    otherMessageRow: {
        justifyContent: 'flex-start',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: Colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    avatarText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Colors.textSecondary,
    },
    messageBubble: {
        maxWidth: '75%',
        padding: 12,
        borderRadius: 16,
        borderBottomLeftRadius: 4,
    },
    ownBubble: {
        backgroundColor: Colors.primary,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 4,
    },
    otherBubble: {
        backgroundColor: '#f0f0f0',
        borderBottomLeftRadius: 4,
    },
    senderName: {
        fontSize: 10,
        color: '#666',
        marginBottom: 4,
        fontWeight: '600',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
    },
    ownMessageText: {
        color: '#fff',
    },
    otherMessageText: {
        color: '#000',
    },
    messageImage: {
        width: 200,
        height: 200,
        borderRadius: 8,
    },
    timestamp: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    ownTimestamp: {
        color: 'rgba(255,255,255,0.7)',
    },
    otherTimestamp: {
        color: '#999',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.border,
        backgroundColor: '#fff',
    },
    attachButton: {
        padding: 8,
    },
    input: {
        flex: 1,
        backgroundColor: '#f5f5f5',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginHorizontal: 8,
        maxHeight: 100,
        fontSize: 15,
    },
    sendButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#ccc',
    },
});
