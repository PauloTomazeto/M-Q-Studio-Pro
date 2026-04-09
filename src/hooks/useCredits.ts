import { useState, useEffect } from 'react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, onSnapshot, updateDoc, increment, setDoc, getDoc } from 'firebase/firestore';

import { useStudioStore } from '../store/studioStore';

export const useCredits = () => {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const { setUserCredits, setUserPlan } = useStudioStore();

  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, 'users', auth.currentUser.uid);
    const isAdminEmail = auth.currentUser.email === 'paulosilvatomazeto@gmail.com';
    
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Force admin privileges if email matches
        if (isAdminEmail && (data.plan !== 'premium' || data.role !== 'admin' || data.credits < 900000)) {
          updateDoc(userRef, { 
            plan: 'premium', 
            role: 'admin', 
            credits: 999999,
            monthlyLimit: 999999 
          }).catch(console.error);
        }

        const currentCredits = isAdminEmail ? 999999 : data.credits;
        setCredits(currentCredits);
        setUserProfile(isAdminEmail ? { ...data, plan: 'premium', role: 'admin', credits: 999999 } : data);
        
        // Sync with Studio Store
        setUserPlan(data.plan);
        setUserCredits({ 
          image: currentCredits, 
          video: data.videoCredits || 0, 
          proImage: data.proCredits || 0 
        });
      } else {
        // Initialize user if not exists
        const initialData = {
          uid: auth.currentUser!.uid,
          email: auth.currentUser!.email,
          displayName: auth.currentUser!.displayName,
          photoURL: auth.currentUser!.photoURL,
          role: isAdminEmail ? 'admin' : 'user',
          plan: isAdminEmail ? 'premium' : 'basic',
          credits: isAdminEmail ? 999999 : 100,
          monthlySpent: 0,
          monthlyLimit: isAdminEmail ? 999999 : 100,
          resetDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          defaultMode: null,
          lastUsedMode: null,
          lastModeSelectedAt: null,
          modeHistory: [],
        };
        setDoc(userRef, initialData).catch(err => {
          try {
            handleFirestoreError(err, OperationType.CREATE, 'users');
          } catch (e) {
            console.error(e);
          }
        });
      }
      setLoading(false);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, 'users');
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const updatePreferences = async (params: any) => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    try {
      await updateDoc(userRef, params);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const logModeSelection = async (mode: 'prompt' | 'move') => {
    if (!auth.currentUser) return;
    const userRef = doc(db, 'users', auth.currentUser.uid);
    const timestamp = new Date().toISOString();
    
    try {
      const historyEntry = { mode, timestamp };
      const currentHistory = userProfile?.modeHistory || [];
      const newHistory = [historyEntry, ...currentHistory].slice(0, 50); // Keep last 50

      await updateDoc(userRef, {
        lastUsedMode: mode,
        lastModeSelectedAt: timestamp,
        modeHistory: newHistory
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const consumeCredits = async (amount: number, reason: string) => {
    if (!auth.currentUser) return false;
    
    const isAdminEmail = auth.currentUser.email === 'paulosilvatomazeto@gmail.com';
    if (isAdminEmail) return true; // Unlimited use for admin

    if (credits === null || credits < amount) return false;

    const userRef = doc(db, 'users', auth.currentUser.uid);
    try {
      await updateDoc(userRef, {
        credits: increment(-amount),
        monthlySpent: increment(amount),
      });
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
      return false;
    }
  };

  const refundCredits = async (amount: number, reason: string) => {
    if (!auth.currentUser) return;
    
    const isAdminEmail = auth.currentUser.email === 'paulosilvatomazeto@gmail.com';
    if (isAdminEmail) return; // No need to refund for admin

    const userRef = doc(db, 'users', auth.currentUser.uid);
    try {
      await updateDoc(userRef, {
        credits: increment(amount),
        monthlySpent: increment(-amount),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  return { credits, loading, userProfile, consumeCredits, refundCredits, updatePreferences, logModeSelection };
};
