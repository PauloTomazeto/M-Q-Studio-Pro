import React from 'react';
import { motion } from 'framer-motion';
import { LogIn, ArrowRight, CheckCircle2, Sparkles, Camera, Layout as LayoutIcon } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { AnimatePresence } from 'framer-motion';

const LandingPage: React.FC = () => {
  const [error, setError] = React.useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setError(null);
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error("Login error:", err);
      if (err.code === 'auth/popup-blocked') {
        setError("O popup de login foi bloqueado pelo seu navegador. Por favor, permita popups para este site.");
      } else if (err.code === 'auth/cancelled-popup-request') {
        // User closed the popup, no need to show error
      } else {
        setError("Ocorreu um erro ao tentar entrar com o Google. Por favor, tente novamente.");
      }
    }
  };

  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const logoUrl = "https://ais-dev-jhwa7e6oplf3loc73vjg5s-71898116696.us-west2.run.app/api/files/d112afcf-eff3-4910-9578-794e6a8b8870/88950575-f260-466d-8e7c-473489811669.png";

  return (
    <div className="min-h-screen bg-[#f2f2f2] text-neutral-900 font-sans selection:bg-[#cfa697]/30">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-[#f2f2f2]/80 backdrop-blur-md border-b border-[#cfa697]/10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#cfa697] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#cfa697]/20">
              <Camera size={24} />
            </div>
            <span className="text-xl font-bold tracking-tighter text-[#cfa697]">M&Q STUDIO</span>
          </div>
          <button 
            onClick={handleLogin}
            className="flex items-center gap-2 bg-[#cfa697] hover:bg-[#b88f80] text-white px-6 py-2.5 rounded-full font-semibold transition-all active:scale-95 shadow-lg shadow-[#cfa697]/20"
          >
            <LogIn size={18} />
            Entrar
          </button>
        </div>
      </nav>

      {/* Error Notification */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] bg-red-500 text-white px-6 py-3 rounded-xl shadow-lg font-medium text-sm flex items-center gap-3"
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">!</div>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#cfa697]/10 text-[#cfa697] text-sm font-bold mb-6">
              <Sparkles size={16} />
              A Nova Era da Visualização Arquitetônica
            </div>
            <h1 className="text-6xl md:text-7xl font-extrabold leading-[1.1] mb-8 tracking-tighter">
              Transforme <span className="text-[#cfa697]">Scans</span> em <span className="italic">Fotografia</span> Pura.
            </h1>
            <p className="text-xl text-neutral-500 mb-10 leading-relaxed max-w-xl">
              O M&Q Studio utiliza inteligência artificial de ponta para converter seus modelos técnicos em imagens fotorrealistas com fidelidade absoluta.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={handleLogin}
                className="flex items-center justify-center gap-2 bg-[#cfa697] hover:bg-[#b88f80] text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-xl shadow-[#cfa697]/30 active:scale-95"
              >
                Começar Agora
                <ArrowRight size={20} />
              </button>
              <button className="flex items-center justify-center gap-2 bg-white border-2 border-[#cfa697]/20 hover:border-[#cfa697]/40 text-neutral-700 px-8 py-4 rounded-2xl font-bold text-lg transition-all active:scale-95">
                Ver Demonstração
              </button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, delay: 0.2 }}
            className="relative"
          >
            <div className="aspect-square rounded-[3rem] overflow-hidden shadow-2xl shadow-[#cfa697]/20 border-8 border-white relative group">
              <img 
                src="https://images.unsplash.com/photo-1556912177-c54030639a33?auto=format&fit=crop&w=1200&q=80" 
                alt="Modern Kitchen Visualization" 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#cfa697]/60 to-transparent opacity-40" />
              
              {/* Floating UI Elements */}
              <div className="absolute top-8 right-8 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-xl border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#cfa697] flex items-center justify-center text-white">
                    <Camera size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Câmera</p>
                    <p className="font-bold">Sony Alpha 7R V</p>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-8 left-8 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-xl border border-white/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Status</p>
                    <p className="font-bold">Fidelidade 100%</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Decorative Elements */}
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-[#cfa697]/10 rounded-full blur-3xl -z-10" />
            <div className="absolute -bottom-10 -right-10 w-60 h-60 bg-[#cfa697]/20 rounded-full blur-3xl -z-10" />
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl font-bold mb-4 tracking-tight">Por que escolher o M&Q Studio?</h2>
            <p className="text-neutral-500 max-w-2xl mx-auto">
              Combinamos o rigor técnico da arquitetura com a sensibilidade artística da fotografia cinematográfica.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Fidelidade Absoluta",
                desc: "Nossos guardrails garantem que nenhum elemento seja inventado. O que está no scan é o que aparece na imagem.",
                icon: <LayoutIcon className="text-[#cfa697]" size={32} />
              },
              {
                title: "Câmeras Profissionais",
                desc: "Simulação real de sensores Canon, Nikon, Sony e iPhone para um look fotográfico autêntico.",
                icon: <Camera className="text-[#cfa697]" size={32} />
              },
              {
                title: "Iluminação Física",
                desc: "Cálculos reais de temperatura de cor e sombras baseados em regimes de luz naturais.",
                icon: <Sparkles className="text-[#cfa697]" size={32} />
              }
            ].map((feature, i) => (
              <div key={i} className="p-10 rounded-[2.5rem] bg-[#f2f2f2] border border-neutral-100 transition-all hover:shadow-xl hover:shadow-[#cfa697]/5 group">
                <div className="mb-6 w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-4">{feature.title}</h3>
                <p className="text-neutral-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-[#cfa697]/10 bg-[#f2f2f2]">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#cfa697] rounded-lg flex items-center justify-center text-white">
              <Camera size={18} />
            </div>
            <span className="text-lg font-bold tracking-tighter text-[#cfa697]">M&Q STUDIO</span>
          </div>
          <p className="text-neutral-400 text-sm">
            © 2026 M&Q Studio. Todos os direitos reservados.
          </p>
          <div className="flex gap-6 text-sm font-bold text-neutral-500">
            <a href="#" className="hover:text-[#cfa697]">Termos</a>
            <a href="#" className="hover:text-[#cfa697]">Privacidade</a>
            <a href="#" className="hover:text-[#cfa697]">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
