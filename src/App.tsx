import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { useStudioStore } from './store/studioStore';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import Studio from './pages/Studio';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import ImageGeneration from './pages/ImageGeneration';
import LandingPage from './pages/LandingPage';
import PricingPage from './pages/PricingPage';
import AdminPage from './pages/AdminPage';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Layout as LayoutIcon } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db, isAdminEmail } from './firebase';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setUserPlan, setUserCredits } = useStudioStore();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Sync user profile with Firestore
          let userRef = doc(db, 'users', user.uid);
          let userSnap = await getDoc(userRef);
          let userData: any = null;
          
          if (!userSnap.exists()) {
            // Check if user was pre-registered by admin using email
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', user.email));
            const querySnap = await getDocs(q);
            
            if (!querySnap.empty) {
              // User exists but with a different ID (probably created by admin)
              const existingDoc = querySnap.docs[0];
              const existingData = existingDoc.data();
              
              // Migrate data to the new UID-based document
              userData = {
                ...existingData,
                uid: user.uid,
                photoURL: user.photoURL || existingData.photoURL,
                displayName: user.displayName || existingData.displayName,
                updatedAt: new Date().toISOString()
              };
              
              await setDoc(userRef, userData);
              
              // Delete the old document created by admin to avoid duplicates
              if (existingDoc.id !== user.uid) {
                try {
                  await deleteDoc(existingDoc.ref);
                } catch (e) {
                  console.error("Error cleaning up old user doc:", e);
                }
              }
            } else {
              // Truly new user
              const isAdmin = isAdminEmail(user.email);
              userData = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                role: isAdmin ? 'admin' : 'user',
                plan: isAdmin ? 'premium' : 'basic',
                credits: isAdmin ? 3000 : 10,
                subscriptionStatus: isAdmin ? 'active' : 'inactive',
                createdAt: new Date().toISOString(),
              };
              await setDoc(userRef, userData);
            }
            
            if (userData) {
              setUserPlan(userData.plan as any);
              setUserCredits({ image: userData.credits, video: 0, proImage: 0 });
            }
          } else {
            const data = userSnap.data();
            setUserPlan(data.plan);
            setUserCredits({ image: data.credits, video: 0, proImage: 0 });
          }
        }
      } catch (error) {
        console.error("Auth sync error:", error);
      } finally {
        setUser(user);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [setUserPlan, setUserCredits]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-50 dark:bg-neutral-950">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <Router>
      <div className="flex h-screen bg-[#f2f2f2] text-neutral-900 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/studio" element={<Studio />} />
                <Route path="/image-generation" element={<ImageGeneration />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </Router>
  );
};

export default App;
