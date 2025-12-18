import { create } from 'zustand';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

interface ConfigState {
    brandfetchKey: string | null;
    isLoading: boolean;
    fetchConfig: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
    brandfetchKey: null,
    isLoading: false,
    fetchConfig: async () => {
        set({ isLoading: true });
        try {
            const docRef = doc(db, 'config', 'app_settings');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                set({ brandfetchKey: data.brandfetch_client_id || null });
            } else {
                console.log('No config document found');
            }
        } catch (error) {
            console.error('Error fetching config:', error);
        } finally {
            set({ isLoading: false });
        }
    },
}));
