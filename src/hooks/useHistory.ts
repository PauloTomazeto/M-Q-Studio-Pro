import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

export interface ScanHistoryItem {
  id: string;
  userId: string;
  sessionId: string;
  scanData: any;
  createdAt: string;
}

export const useHistory = (maxItems: number = 10) => {
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'scan_results'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(maxItems)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ScanHistoryItem[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as ScanHistoryItem);
      });
      setHistory(items);
      setLoading(false);
    }, (err) => {
      console.error('History fetch error:', err);
      setError(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [maxItems]);

  return { history, loading, error };
};
