import React from 'react';
import { useCredits } from '../../hooks/useCredits';
import { auth } from '../../firebase';
import { LogOut, Bell, CreditCard, User } from 'lucide-react';
import { motion } from 'framer-motion';
import ModeSwitcher from '../studio/ModeSwitcher';

const Navbar: React.FC = () => {
  const { credits, userProfile } = useCredits();

  return (
    <header className="h-16 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold md:hidden">M&Q</h2>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <div className="hidden sm:block">
          <ModeSwitcher />
        </div>

        <motion.div 
          whileHover={{ scale: 1.02 }}
          className="hidden sm:flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20 cursor-pointer"
        >
          <CreditCard size={16} />
          <span className="text-sm font-bold">{credits ?? 0} créditos</span>
        </motion.div>

        <div className="flex items-center gap-3">
          <button className="p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
            <Bell size={20} />
          </button>
          
          <div className="h-8 w-[1px] bg-neutral-200 dark:bg-neutral-800 mx-1" />

          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium leading-none">{auth.currentUser?.displayName}</p>
              <p className="text-xs text-neutral-500 mt-1 capitalize">{userProfile?.plan ?? 'Basic'}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden border border-neutral-200 dark:border-neutral-700">
              {auth.currentUser?.photoURL ? (
                <img src={auth.currentUser.photoURL} alt="User" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-500">
                  <User size={20} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
