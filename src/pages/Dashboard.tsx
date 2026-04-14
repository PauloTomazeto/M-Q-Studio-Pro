import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Palette, 
  History, 
  Star, 
  TrendingUp, 
  Clock,
  ArrowRight,
  Zap,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCredits } from '../hooks/useCredits';
import { useStudioStore } from '../store/studioStore';
import { useHistory } from '../hooks/useHistory';
import ModeSelection from '../components/studio/ModeSelection';
import { supabase } from '../supabase';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { credits, loading: creditsLoading } = useCredits();
  const { mode, setMode, userPlan, userCredits } = useStudioStore();
  const { history, loading: historyLoading } = useHistory(5);
  const [showModeSelection, setShowModeSelection] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
    });
  }, []);

  useEffect(() => {
    if (creditsLoading) return;

    // Logic from PRD:
    // 1. Current session (already in store from sessionStorage)
    if (mode) return;

    // Default to selection screen if no mode is set
    setShowModeSelection(true);
  }, [creditsLoading, mode]);

  const stats = [
    { label: 'Créditos', value: userCredits.image, icon: Star, color: 'text-[#cfa697]', bg: 'bg-[#cfa697]/10' },
    { label: 'Projetos', value: history.length, icon: Palette, color: 'text-[#cfa697]', bg: 'bg-[#cfa697]/10' },
    { label: 'Análises', value: history.length, icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Histórico', value: history.length, icon: History, color: 'text-neutral-500', bg: 'bg-neutral-500/10' },
  ];

  if (showModeSelection && !mode) {
    return (
      <div className="max-w-6xl mx-auto space-y-12 py-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Escolha seu fluxo de trabalho</h1>
          <p className="text-neutral-500 dark:text-neutral-400 text-lg max-w-2xl mx-auto">
            Selecione o modo que melhor se adapta ao seu projeto atual. Você pode alterar esta escolha a qualquer momento.
          </p>
        </div>
        <ModeSelection onSelect={() => setShowModeSelection(false)} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Olá, {(currentUser?.user_metadata?.name || currentUser?.email?.split('@')[0])?.split(' ')[0]}!</h1>
          <p className="text-neutral-500 mt-1">
            Bem-vindo ao seu painel de controle arquitetônico.
          </p>
        </div>
        <button
          onClick={() => navigate('/studio')}
          className="flex items-center justify-center gap-2 bg-[#cfa697] hover:bg-[#b88f80] text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-[#cfa697]/20 active:scale-95"
        >
          Nova Análise
          <ArrowRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-[#cfa697]/10 shadow-sm"
          >
            <div className={stat.bg + " w-12 h-12 rounded-xl flex items-center justify-center " + stat.color + " mb-4"}>
              <stat.icon size={24} />
            </div>
            <p className="text-sm font-medium text-neutral-500">{stat.label}</p>
            <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Clock size={20} className="text-[#cfa697]" />
              Atividade Recente
            </h2>
            <button 
              onClick={() => navigate('/projects')}
              className="text-sm font-medium text-[#cfa697] hover:underline"
            >
              Ver tudo
            </button>
          </div>
          
          {historyLoading ? (
            <div className="flex items-center justify-center p-20">
              <Loader2 className="animate-spin text-[#cfa697]" size={32} />
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-4">
              {history.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white p-4 rounded-2xl border border-neutral-200 shadow-sm flex items-center gap-4 hover:border-[#cfa697]/30 transition-colors cursor-pointer group"
                >
                  <div className="w-12 h-12 bg-[#f2f2f2] rounded-xl flex items-center justify-center text-neutral-500 group-hover:text-[#cfa697] transition-colors overflow-hidden">
                    <History size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold truncate capitalize">{item.scanData.typology} Analysis</h4>
                    <p className="text-xs text-neutral-500 flex items-center gap-2">
                      {new Date(item.createdAt).toLocaleDateString()} • {item.scanData.confidence.general}% Confiança
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-neutral-300 group-hover:text-[#cfa697] transition-colors" />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center">
              <div className="w-16 h-16 bg-[#f2f2f2] rounded-full flex items-center justify-center mx-auto mb-4 text-neutral-400">
                <History size={32} />
              </div>
              <h3 className="text-lg font-semibold">Nenhuma atividade ainda</h3>
              <p className="text-neutral-500 mt-2 max-w-xs mx-auto">
                Comece sua primeira análise no Studio para ver seu histórico aqui.
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Star size={20} className="text-[#cfa697]" />
            Seu Plano
          </h2>
          <div className="bg-gradient-to-br from-[#cfa697] to-[#b88f80] p-6 rounded-[2.5rem] text-white shadow-xl shadow-[#cfa697]/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
              <Zap size={120} fill="currentColor" />
            </div>
            <h3 className="text-lg font-bold capitalize">{userPlan}</h3>
            <p className="text-white/80 text-sm mt-1">
              {userPlan === 'premium' ? 'Acesso total ilimitado' : userPlan === 'pro' ? 'Padrão profissional' : 'Acesso básico à plataforma'}
            </p>
            <div className="mt-6 pt-6 border-t border-white/20">
              <div className="flex justify-between text-sm mb-2">
                <span>Créditos disponíveis</span>
                <span>{userCredits.image} CR</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  className="h-full bg-white"
                />
              </div>
            </div>
            <button 
              onClick={() => navigate('/pricing')}
              className="w-full mt-6 bg-white text-[#cfa697] font-bold py-3 rounded-xl hover:bg-neutral-50 transition-colors active:scale-95"
            >
              Fazer Upgrade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
