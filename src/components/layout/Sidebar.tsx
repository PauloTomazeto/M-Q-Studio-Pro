import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Palette, 
  Wand2,
  FolderKanban, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
  Crown,
  Camera,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../../supabase';
// import { signOut } from 'firebase/auth';
import { motion } from 'framer-motion';

const ADMIN_EMAILS = [
  "paulosilvatomazeto@gmail.com",
  "paulo.silva.tamazeta@gmail.com"
];

const isAdminEmail = (email: string | null | undefined) => {
  return email && ADMIN_EMAILS.includes(email);
};
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStudioStore } from '../../store/studioStore';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const { userPlan } = useStudioStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Palette, label: 'Studio', path: '/studio' },
    { icon: Wand2, label: 'Geração de Imagem', path: '/image-generation' },
    { icon: FolderKanban, label: 'Projetos', path: '/projects' },
    { icon: Crown, label: 'Planos', path: '/pricing' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ];

  const isAdmin = isAdminEmail(auth.currentUser?.email);

  if (isAdmin) {
    navItems.push({ icon: ShieldCheck, label: 'Painel Admin', path: '/admin' });
  }

  const logoUrl = "https://ais-dev-jhwa7e6oplf3loc73vjg5s-71898116696.us-west2.run.app/api/files/d112afcf-eff3-4910-9578-794e6a8b8870/88950575-f260-466d-8e7c-473489811669.png";

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      className="hidden md:flex flex-col bg-white border-r border-[#cfa697]/10 h-full relative z-50"
    >
      <div className="p-6 flex items-center gap-3 overflow-hidden">
        <div className="w-10 h-10 bg-white rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden shadow-lg shadow-[#cfa697]/20">
          <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        </div>
        {!isCollapsed && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xl font-bold tracking-tighter text-[#cfa697] whitespace-nowrap"
          >
            M&Q STUDIO
          </motion.span>
        )}
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all group",
              isActive 
                ? "bg-[#cfa697] text-white shadow-lg shadow-[#cfa697]/20" 
                : "text-neutral-500 hover:bg-[#f2f2f2] hover:text-neutral-900"
            )}
          >
            <item.icon size={22} className={cn("flex-shrink-0", !isCollapsed && "group-hover:scale-110 transition-transform")} />
            {!isCollapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-medium whitespace-nowrap"
              >
                {item.label}
              </motion.span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-[#cfa697]/10">
        {!isCollapsed && (
          <div className="mb-4 p-4 bg-[#f2f2f2] rounded-2xl border border-[#cfa697]/10">
            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Seu Plano</p>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#cfa697] capitalize">{userPlan}</span>
              {userPlan === 'basic' && (
                <button 
                  onClick={() => navigate('/pricing')}
                  className="text-[10px] font-black text-white bg-[#cfa697] px-2 py-1 rounded-lg hover:bg-[#b88f80] transition-colors"
                >
                  UPGRADE
                </button>
              )}
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-neutral-500 hover:bg-red-50 hover:text-red-500 transition-all group"
        >
          <LogOut size={22} className="flex-shrink-0 group-hover:translate-x-1 transition-transform" />
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-medium whitespace-nowrap"
            >
              Sair
            </motion.span>
          )}
        </button>
      </div>

      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-full flex items-center justify-center text-neutral-500 hover:text-primary transition-colors shadow-sm"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>
    </motion.aside>
  );
};

export default Sidebar;
