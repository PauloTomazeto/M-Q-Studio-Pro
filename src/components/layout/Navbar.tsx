import React from 'react';
import { useCredits } from '../../hooks/useCredits';
import { auth } from '../../firebase';
import { LogOut, Bell, CreditCard, User, Crown } from 'lucide-react';
import { motion } from 'framer-motion';
import ModeSwitcher from '../studio/ModeSwitcher';
import { useStudioStore } from '../../store/studioStore';
import { useNavigate } from 'react-router-dom';

const Navbar: React.FC = () => {
  const { credits } = useCredits();
  const { userPlan, userCredits } = useStudioStore();
  const navigate = useNavigate();

  return (
    <header className="h-16 bg-white border-b border-[#cfa697]/10 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-bold text-[#cfa697] md:hidden">M&Q STUDIO</h2>
      </div>

      <div className="flex items-center gap-4 md:gap-6">
        <div className="hidden sm:block">
          <ModeSwitcher />
        </div>

        {userPlan !== 'basic' && (
          <motion.div 
            whileHover={{ scale: 1.02 }}
            onClick={() => navigate('/pricing')}
            className="hidden sm:flex items-center gap-2 bg-[#cfa697]/10 text-[#cfa697] px-3 py-1.5 rounded-full border border-[#cfa697]/20 cursor-pointer"
          >
            <CreditCard size={16} />
            <span className="text-sm font-bold">
              {userCredits.image} CR
            </span>
          </motion.div>
        )}

        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/pricing')}
            className="p-2 text-neutral-500 hover:bg-[#f2f2f2] rounded-lg transition-colors"
          >
            <Crown size={20} className={userPlan !== 'basic' ? 'text-[#cfa697]' : ''} />
          </button>
          
          <div className="h-8 w-[1px] bg-neutral-200 mx-1" />

          <div className="flex items-center gap-3 pl-2">
            <div className="text-right hidden md:block">
              <p className="text-sm font-bold leading-none">{auth.currentUser?.displayName}</p>
              <p className="text-[10px] font-black text-[#cfa697] mt-1 uppercase tracking-widest">{userPlan}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#f2f2f2] overflow-hidden border border-[#cfa697]/20">
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
