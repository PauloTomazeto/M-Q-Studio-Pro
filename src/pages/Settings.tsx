import React from 'react';
import { User, Shield, CreditCard, Bell, Moon, Sun, Monitor } from 'lucide-react';
import { auth } from '../firebase';
import { useCredits } from '../hooks/useCredits';

const Settings: React.FC = () => {
  const { userProfile } = useCredits();

  const sections = [
    {
      id: 'profile',
      title: 'Perfil',
      icon: User,
      items: [
        { label: 'Nome', value: auth.currentUser?.displayName },
        { label: 'Email', value: auth.currentUser?.email },
        { label: 'Plano Atual', value: userProfile?.plan?.toUpperCase() },
      ]
    },
    {
      id: 'billing',
      title: 'Faturamento',
      icon: CreditCard,
      items: [
        { label: 'Créditos Disponíveis', value: userProfile?.credits },
        { label: 'Próximo Reset', value: userProfile?.resetDate ? new Date(userProfile.resetDate).toLocaleDateString() : 'N/A' },
      ]
    },
    {
      id: 'appearance',
      title: 'Aparência',
      icon: Moon,
      items: [
        { label: 'Tema', value: 'Sistema' },
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          Gerencie sua conta e preferências da plataforma.
        </p>
      </div>

      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.id} className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm">
            <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center gap-3 text-primary">
              <section.icon size={20} />
              <h2 className="font-bold">{section.title}</h2>
            </div>
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {section.items.map((item) => (
                <div key={item.label} className="p-6 flex items-center justify-between gap-4">
                  <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-4">
        <button className="text-error font-bold hover:underline">Deletar Conta</button>
      </div>
    </div>
  );
};

export default Settings;
