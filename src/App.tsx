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
    console.log("Iniciando monitoramento de autenticação...");
    
    // Fallback de segurança: se em 10 segundos não carregar, libera o loading
    const safetyTimer = setTimeout(() => {
      if (loading) {
        console.warn("Aviso: O carregamento de autenticação demorou demais. Liberando interface.");
        setLoading(false);
      }
    }, 15000);

    const unsubscribe = supabase.auth.onAuthStateChange(async (event, session) => {
      const authUser = session?.user;
      console.log("Evento de Autenticação:", event, authUser?.email);
      
      try {
        if (authUser) {
          // Sync user profile with Supabase
          try {
            // Tenta buscar por auth_id (que é o id do auth.users do Supabase)
            const { data: userData, error: fetchError } = await supabase
              .from('users')
              .select('*')
              .eq('auth_id', authUser.id)
              .single();

            if (fetchError || !userData) {
              console.log("Usuário novo detectado, criando perfil...");
              const isAdmin = isAdminEmail(authUser.email);
              
              const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert([{
                  auth_id: authUser.id,
                  email: authUser.email || '',
                  display_name: authUser.user_metadata?.name || authUser.email?.split('@')[0],
                  role: isAdmin ? 'admin' : 'user',
                  plan: isAdmin ? 'premium' : 'basic',
                  credits: isAdmin ? 3000 : 10,
                  subscription_status: isAdmin ? 'active' : 'inactive',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }])
                .select()
                .single();

              if (createError) throw createError;

              if (newUser) {
                setUserPlan(newUser.plan);
                setUserCredits({ image: newUser.credits || 10, video: 0, proImage: 0 });
              }
            } else {
              console.log("Usuário existente:", userData.email);
              setUserPlan(userData.plan);
              setUserCredits({ image: userData.credits || 10, video: 0, proImage: 0 });
            }
          } catch (dbError) {
            console.error("Erro ao sincronizar com banco de dados:", dbError);
          }
        }
      } catch (error) {
        console.error("Auth sync error:", error);
      } finally {
        setUser(authUser || null);
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    });
    return () => {
      unsubscribe?.data?.subscription?.unsubscribe();
      clearTimeout(safetyTimer);
    };
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
