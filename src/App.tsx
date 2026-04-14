import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabase';
import type { User } from '@supabase/supabase-js';
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
import * as adminService from './services/adminService';

const ADMIN_EMAILS = [
  "paulosilvatomazeto@gmail.com",
  "paulo.silva.tamazeta@gmail.com"
];

const isAdminEmail = (email: string | null | undefined) => {
  return email && ADMIN_EMAILS.includes(email);
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { setUserPlan, setUserCredits } = useStudioStore();

  useEffect(() => {
    const unsubscribe = supabase.auth.onAuthStateChange(async (event, authUser) => {
      try {
        if (authUser) {
          // Sync user profile with Supabase
          const userData = await adminService.getUser(authUser.id);

          if (!userData) {
            // Create new user if doesn't exist
            const isAdmin = isAdminEmail(authUser.email);
            const newUser = await adminService.createUser({
              id: authUser.id,
              email: authUser.email || '',
              display_name: authUser.user_metadata?.name || authUser.email?.split('@')[0],
              photo_url: authUser.user_metadata?.avatar_url,
              role: isAdmin ? 'admin' : 'user',
              plan: isAdmin ? 'premium' : 'basic',
              credits_available: isAdmin ? 3000 : 10,
              subscription_status: isAdmin ? 'active' : 'inactive',
              created_at: new Date().toISOString()
            });

            if (newUser) {
              setUserPlan(newUser.plan);
              setUserCredits({ image: newUser.credits_available || 10, video: 0, proImage: 0 });
            }
          } else {
            setUserPlan(userData.plan);
            setUserCredits({ image: userData.credits_available || 10, video: 0, proImage: 0 });
          }
        }
      } catch (error) {
        console.error("Auth sync error:", error);
      } finally {
        setUser(authUser || null);
        setLoading(false);
      }
    });
    return () => unsubscribe?.();
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
