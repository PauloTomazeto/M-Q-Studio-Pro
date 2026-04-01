import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Palette, 
  FolderKanban, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Sidebar: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Palette, label: 'Studio', path: '/studio' },
    { icon: FolderKanban, label: 'Projetos', path: '/projects' },
    { icon: Settings, label: 'Configurações', path: '/settings' },
  ];

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      className="hidden md:flex flex-col bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 h-full relative z-50"
    >
      <div className="p-6 flex items-center gap-3 overflow-hidden">
        <div className="w-10 h-10 bg-primary rounded-xl flex-shrink-0 flex items-center justify-center text-white shadow-lg shadow-primary/20">
          <Zap size={20} fill="currentColor" />
        </div>
        {!isCollapsed && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xl font-bold tracking-tight whitespace-nowrap"
          >
            M&QSTUDIO
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
                ? "bg-primary text-white shadow-lg shadow-primary/20" 
                : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-50"
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

      <div className="p-4 border-t border-neutral-200 dark:border-neutral-800">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-neutral-500 hover:bg-error/10 hover:text-error transition-all group"
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
