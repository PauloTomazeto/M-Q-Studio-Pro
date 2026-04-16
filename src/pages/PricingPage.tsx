import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Zap, Crown, Sparkles, ArrowRight, Camera, Video, Layout as LayoutIcon, Loader2, Coins, Plus } from 'lucide-react';
import { useStudioStore } from '../store/studioStore';
import { useNavigate } from 'react-router-dom';
import adminService from '../services/adminService';
import { supabase, getCurrentUser } from '../supabase';
// import { doc, updateDoc, increment } from 'firebase/firestore'; // Migrated to Supabase
import confetti from 'canvas-confetti';

interface PlanConfig {
  id: string;
  name: string;
  price: number;
  credits: number;
}

interface CreditPackageConfig {
  id: string;
  price: number;
  amount: number;
}

const PricingPage: React.FC = () => {
  const { setUserPlan, setUserCredits, userCredits } = useStudioStore();
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [creditPackage, setCreditPackage] = useState<CreditPackageConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPurchasingCredits, setIsPurchasingCredits] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [p, cp] = await Promise.all([
          adminService.getPlans(),
          adminService.getCreditPackage()
        ]);
        
        if (p.length === 0 || p.some(plan => plan.features.some(f => f.includes('Milhão')))) {
          await adminService.bootstrapPlans();
          const p2 = await adminService.getPlans();
          setPlans(p2);
        } else {
          setPlans(p);
        }
        setCreditPackage(cp);
      } catch (error) {
        console.error('Failed to load pricing data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSelectPlan = async (plan: PlanConfig) => {
    const user = await getCurrentUser();
    if (!user) {
      navigate('/');
      return;
    }

    // Prepare for Stripe
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: plan.id,
          userId: user.id,
          email: user.email
        })
      });
      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Stripe error:', error);
      // Fallback for demo
      setUserPlan(plan.id as any);
      setUserCredits({ ...userCredits, image: plan.credits });
      navigate('/');
    }
  };

  const handleBuyCredits = async () => {
    if (!creditPackage) return;
    const user = await getCurrentUser();
    if (!user) {
      navigate('/');
      return;
    }

    setIsPurchasingCredits(true);
    try {
      // In a real app, this would be a Stripe checkout session for credits
      // For this demo, we'll simulate a successful purchase
      // Get current credits and add new amount
      const { data: userData } = await supabase
        .from('users')
        .select('credits')
        .eq('id', user.id)
        .single();

      const currentCredits = userData?.credits || 0;
      const newCredits = currentCredits + creditPackage.amount;

      const { error } = await supabase
        .from('users')
        .update({
          credits: newCredits,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      setUserCredits({ ...userCredits, image: userCredits.image + creditPackage.amount });
      
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#cfa697', '#ffffff', '#b88f80']
      });

      setNotification({ message: `${creditPackage.amount} créditos adicionados com sucesso!`, type: 'success' });
    } catch (error) {
      console.error('Failed to purchase credits:', error);
      setNotification({ message: 'Erro ao processar compra de créditos.', type: 'error' });
    } finally {
      setIsPurchasingCredits(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f2f2] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#cfa697]" size={48} />
      </div>
    );
  }

  const getPlanIcon = (id: string) => {
    if (id === 'premium') return <Crown className="text-[#cfa697]" size={32} />;
    if (id === 'pro') return <Zap className="text-white" size={32} />;
    return <LayoutIcon className="text-[#cfa697]" size={32} />;
  };

  return (
    <div className="min-h-screen bg-[#f2f2f2] text-neutral-900 py-24 px-6 font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex justify-center mb-8"
          >
            <div className="w-16 h-16 bg-[#cfa697] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-[#cfa697]/20">
              <Camera size={32} />
            </div>
          </motion.div>
          <h1 className="text-5xl font-extrabold mb-6 tracking-tighter">Escolha seu <span className="text-[#cfa697]">Plano de Poder</span></h1>
          <p className="text-xl text-neutral-500 max-w-2xl mx-auto">
            Selecione o nível de fidelidade e capacidade produtiva que seu estúdio necessita.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 items-stretch mb-20">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`relative flex flex-col p-8 rounded-[3rem] transition-all duration-500 ${
                plan.id === 'pro' 
                  ? 'bg-[#cfa697] text-white shadow-2xl shadow-[#cfa697]/40 scale-105 z-10' 
                  : 'bg-white border border-[#cfa697]/10 hover:shadow-xl hover:shadow-[#cfa697]/5'
              }`}
            >
              {plan.id === 'pro' && (
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-white text-[#cfa697] px-6 py-2 rounded-full text-sm font-bold shadow-lg flex items-center gap-2">
                  <Sparkles size={16} />
                  MAIS POPULAR
                </div>
              )}

              <div className="mb-8">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
                  plan.id === 'pro' ? 'bg-white/20' : 'bg-[#f2f2f2]'
                }`}>
                  {getPlanIcon(plan.id)}
                </div>
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className={`text-sm ${plan.id === 'pro' ? 'text-white/80' : 'text-neutral-500'}`}>
                  {plan.id === 'basic' ? 'Ideal para entusiastas e exploração técnica.' : 
                   plan.id === 'pro' ? 'O padrão ouro para arquitetos e designers.' : 
                   'Para estúdios que exigem a perfeição absoluta.'}
                </p>
              </div>

              <div className="mb-10">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">R$ {plan.price}</span>
                  <span className={`text-sm font-bold ${plan.id === 'pro' ? 'text-white/60' : 'text-neutral-400'}`}>/mês</span>
                </div>
              </div>

              <div className="flex-1 space-y-4 mb-10">
                {plan.features.map((feature, j) => (
                  <div key={j} className="flex items-start gap-3">
                    <div className={`mt-1 p-0.5 rounded-full ${plan.id === 'pro' ? 'bg-white/20' : 'bg-[#cfa697]/10'}`}>
                      <Check size={14} className={plan.id === 'pro' ? 'text-white' : 'text-[#cfa697]'} />
                    </div>
                    <span className={`text-sm font-medium ${plan.id === 'pro' ? 'text-white/90' : 'text-neutral-600'}`}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => handleSelectPlan(plan)}
                className={`w-full py-4 rounded-2xl font-bold text-lg transition-all active:scale-95 flex items-center justify-center gap-2 ${
                  plan.id === 'pro' 
                    ? 'bg-white text-[#cfa697] hover:bg-[#f2f2f2] shadow-xl shadow-black/10' 
                    : 'bg-[#cfa697] text-white hover:bg-[#b88f80] shadow-lg shadow-[#cfa697]/20'
                }`}
              >
                {plan.id === 'basic' ? 'Começar Grátis' : 'Assinar Agora'}
                <ArrowRight size={20} />
              </button>
            </motion.div>
          ))}
        </div>

        {/* Credit Purchase Section */}
        {creditPackage && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto bg-white rounded-[3rem] p-10 border border-[#cfa697]/20 shadow-xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#cfa697]/5 rounded-full -mr-32 -mt-32 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#cfa697]/5 rounded-full -ml-32 -mb-32 blur-3xl" />
            
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-[#cfa697]/10 rounded-3xl flex items-center justify-center text-[#cfa697]">
                  <Coins size={40} />
                </div>
                <div>
                  <h3 className="text-3xl font-black mb-2">Recarga de Créditos</h3>
                  <p className="text-neutral-500 font-medium">
                    Precisa de mais fôlego? Adicione créditos avulsos ao seu plano atual.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col items-center md:items-end gap-4">
                <div className="text-center md:text-right">
                  <div className="text-4xl font-black text-[#cfa697]">R$ {creditPackage.price.toFixed(2).replace('.', ',')}</div>
                  <div className="text-sm font-bold text-neutral-400 uppercase tracking-widest">{creditPackage.amount.toLocaleString()} Créditos</div>
                </div>
                
                <button
                  onClick={handleBuyCredits}
                  disabled={isPurchasingCredits}
                  className="px-10 py-5 bg-neutral-900 text-white rounded-2xl font-bold text-lg hover:bg-black transition-all active:scale-95 flex items-center gap-3 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPurchasingCredits ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <Plus size={20} />
                  )}
                  Comprar Créditos
                </button>
              </div>
            </div>
          </motion.div>
        )}

        <div className="mt-20 text-center">
          <p className="text-neutral-400 text-sm mb-8">
            Precisa de um plano personalizado para grandes equipes?
          </p>
          <button className="text-[#cfa697] font-bold hover:underline">
            Fale com nosso time comercial
          </button>
        </div>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 right-8 px-6 py-4 rounded-2xl shadow-2xl z-[100] flex items-center gap-3 ${
              notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {notification.type === 'success' ? <Check size={20} /> : <Plus size={20} className="rotate-45" />}
            <span className="font-medium">{notification.message}</span>
            <button 
              onClick={() => setNotification(null)}
              className="ml-4 p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Plus size={18} className="rotate-45" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PricingPage;
