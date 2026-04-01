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
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Layout as LayoutIcon } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
    return <LoginScreen />;
  }

  return (
    <Router>
      <div className="flex h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <AnimatePresence mode="wait">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/studio" element={<Studio />} />
                <Route path="/projects" element={<Projects />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </Router>
  );
};

const LoginScreen = () => {
  const handleLogin = () => {
    signInWithPopup(auth, googleProvider);
  };

  return (
    <div className="flex items-center justify-center h-screen bg-neutral-50 dark:bg-neutral-950">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full p-8 bg-white dark:bg-neutral-900 rounded-2xl shadow-xl border border-neutral-200 dark:border-neutral-800 text-center"
      >
        <div className="mb-8 flex justify-center">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <LayoutIcon size={32} />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2 font-sans tracking-tight">M&QSTUDIO</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mb-8">
          Advanced architectural prompt generator for high-fidelity rendering.
        </p>
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95"
        >
          <LogIn size={20} />
          Continuar com Google
        </button>
        <p className="mt-6 text-xs text-neutral-400 dark:text-neutral-500">
          Ao continuar, você concorda com nossos Termos de Serviço e Política de Privacidade.
        </p>
      </motion.div>
    </div>
  );
};

export default App;
