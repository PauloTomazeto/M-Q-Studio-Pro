import { 
  collection, 
  addDoc, 
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
  limit
} from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';

export type UsageType = 'prompt' | 'scan' | 'read' | 'image' | 'video';

export interface UsageLog {
  id?: string;
  userId: string;
  type: UsageType;
  model?: string;
  resolution?: string;
  timestamp: any;
  metadata?: any;
}

export const usageService = {
  async logUsage(type: UsageType, details?: { model?: string; resolution?: string; metadata?: any }) {
    const user = auth.currentUser;
    if (!user) return;

    try {
      await addDoc(collection(db, 'usage_logs'), {
        userId: user.uid,
        type,
        model: details?.model || 'default',
        resolution: details?.resolution || 'n/a',
        timestamp: serverTimestamp(),
        metadata: details?.metadata || {}
      });
    } catch (error) {
      console.error('Failed to log usage:', error);
      // We don't throw here to avoid breaking the main flow if logging fails
    }
  },

  async getLogs(userId?: string, limitCount = 100) {
    try {
      let q = query(collection(db, 'usage_logs'), orderBy('timestamp', 'desc'), limit(limitCount));
      
      if (userId) {
        q = query(collection(db, 'usage_logs'), where('userId', '==', userId), orderBy('timestamp', 'desc'), limit(limitCount));
      }

      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UsageLog));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'usage_logs');
      throw error;
    }
  }
};
