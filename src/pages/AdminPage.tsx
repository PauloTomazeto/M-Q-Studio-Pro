import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  Settings, 
  Search, 
  Edit2, 
  Trash2, 
  CheckCircle, 
  XCircle,
  ArrowLeft,
  Save,
  Plus,
  RefreshCw,
  BarChart3,
  DollarSign,
  Activity,
  Clock,
  Cpu,
  Monitor,
  Wand2,
  History,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
// import { adminService TODO
// import { usageService TODO
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { Coins } from 'lucide-react';

const ADMIN_EMAILS = [
  "paulosilvatomazeto@gmail.com",
  "paulo.silva.tamazeta@gmail.com"
];

const isAdminEmail = (email: string | null | undefined) => {
  return email && ADMIN_EMAILS.includes(email);
};

const AdminPage: React.FC = () => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [plans, setPlans] = useState<PlanConfig[]>([]);
  const [creditPackage, setCreditPackage] = useState<CreditPackageConfig | null>(null);
  const [usageLogs, setUsageLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'pricing' | 'usage'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editingPlan, setEditingPlan] = useState<PlanConfig | null>(null);
  const [isEditingCreditPackage, setIsEditingCreditPackage] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string, email: string } | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [userUsageLogs, setUserUsageLogs] = useState<any[]>([]);
  const [loadingUserUsage, setLoadingUserUsage] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    displayName: '',
    plan: 'basic',
    credits: 10,
    role: 'user',
    subscriptionStatus: 'inactive'
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const checkAdmin = async () => {
      const user = auth.currentUser;
      if (!user || !isAdminEmail(user.email)) {
        navigate('/');
        return;
      }
      loadData();
    };
    checkAdmin();
  }, [navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, u, p, l, cp] = await Promise.all([
        adminService.getStats(),
        adminService.getAllUsers(),
        adminService.getPlans(),
        usageService.getLogs(),
        adminService.getCreditPackage()
      ]);
      setStats(s);
      setUsers(u);
      setPlans(p);
      setUsageLogs(l);
      setCreditPackage(cp);
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = async (user: any) => {
    setEditingUser(user);
    setLoadingUserUsage(true);
    try {
      const logs = await usageService.getLogs(user.id, 20);
      setUserUsageLogs(logs);
    } catch (error) {
      console.error('Failed to load user usage logs:', error);
    } finally {
      setLoadingUserUsage(false);
    }
  };
  const handleUpdateUser = async (userId: string, plan: string, credits: number, subscriptionStatus: string) => {
    try {
      await adminService.updateUserPlan(userId, plan, credits, subscriptionStatus);
      setEditingUser(null);
      setNotification({ message: 'Usuário atualizado com sucesso!', type: 'success' });
      loadData();
    } catch (error) {
      setNotification({ message: 'Erro ao atualizar usuário', type: 'error' });
    }
  };

  const handleDeleteUser = async (userId: string, userEmail: string) => {
    if (userEmail === auth.currentUser?.email) {
      setNotification({ message: 'Você não pode excluir sua própria conta de administrador.', type: 'error' });
      return;
    }
    setUserToDelete({ id: userId, email: userEmail });
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    try {
      await adminService.deleteUser(userToDelete.id);
      setUserToDelete(null);
      setEditingUser(null);
      setNotification({ message: 'Usuário excluído com sucesso!', type: 'success' });
      loadData();
    } catch (error) {
      console.error('Erro ao excluir usuário:', error);
      setNotification({ message: 'Erro ao excluir usuário', type: 'error' });
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.displayName) {
      setNotification({ message: 'Por favor, preencha o e-mail e o nome.', type: 'error' });
      return;
    }
    try {
      await adminService.createUser(newUser);
      setIsCreatingUser(false);
      setNotification({ message: 'Usuário criado com sucesso!', type: 'success' });
      setNewUser({
        email: '',
        displayName: '',
        plan: 'basic',
        credits: 10,
        role: 'user',
        subscriptionStatus: 'inactive'
      });
      loadData();
    } catch (error) {
      setNotification({ message: 'Erro ao criar usuário', type: 'error' });
    }
  };

  const handleUpdatePlan = async (planId: string, price: number, credits: number) => {
    try {
      await adminService.updatePlan(planId, isNaN(price) ? 0 : price, isNaN(credits) ? 0 : credits);
      setEditingPlan(null);
      setNotification({ message: 'Plano atualizado com sucesso!', type: 'success' });
      loadData();
    } catch (error) {
      setNotification({ message: 'Erro ao atualizar plano', type: 'error' });
    }
  };

  const handleUpdateCreditPackage = async (amount: number, price: number) => {
    try {
      await adminService.updateCreditPackage(isNaN(amount) ? 0 : amount, isNaN(price) ? 0 : price);
      setIsEditingCreditPackage(false);
      setNotification({ message: 'Pacote de créditos atualizado!', type: 'success' });
      loadData();
    } catch (error) {
      setNotification({ message: 'Erro ao atualizar pacote de créditos', type: 'error' });
    }
  };

  const filteredUsers = users.filter(u => 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#cfa697]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-[#cfa697]/10 px-8 py-6 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">Painel Administrativo</h1>
              <p className="text-sm text-neutral-500">M&Q Studio Control Center</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => adminService.bootstrapPlans().then(loadData)}
              className="px-4 py-2 bg-[#cfa697]/10 text-[#cfa697] rounded-lg font-medium hover:bg-[#cfa697]/20 transition-colors flex items-center gap-2"
            >
              <RefreshCw size={18} />
              Resetar Planos
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          {[
            { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
            { id: 'users', label: 'Usuários', icon: Users },
            { id: 'pricing', label: 'Precificação', icon: DollarSign },
            { id: 'usage', label: 'Logs de Uso', icon: Activity },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-all ${
                activeTab === tab.id 
                ? 'bg-[#cfa697] text-white shadow-lg shadow-[#cfa697]/20' 
                : 'bg-white text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total de Usuários" value={stats.totalUsers} icon={Users} color="blue" />
            <StatCard title="Usuários Premium" value={stats.premiumUsers} icon={TrendingUp} color="purple" />
            <StatCard title="Usuários Pro" value={stats.proUsers} icon={CheckCircle} color="green" />
            <StatCard title="Receita Estimada" value={`R$ ${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} color="amber" />
            
            <div className="col-span-full grid grid-cols-1 md:grid-cols-5 gap-4">
              <UsageStatCard title="Prompts" value={stats.usageStats.prompt} icon={Wand2} color="amber" />
              <UsageStatCard title="Escaneamentos" value={stats.usageStats.scan} icon={Search} color="green" />
              <UsageStatCard title="Leituras" value={stats.usageStats.read} icon={History} color="blue" />
              <UsageStatCard title="Imagens" value={stats.usageStats.image} icon={ImageIcon} color="purple" />
              <UsageStatCard title="Vídeos" value={stats.usageStats.video} icon={Monitor} color="indigo" />
            </div>

            <div className="col-span-full bg-white p-8 rounded-3xl border border-[#cfa697]/10">
              <h3 className="text-xl font-bold mb-6">Distribuição de Planos</h3>
              <div className="h-4 w-full bg-neutral-100 rounded-full overflow-hidden flex">
                <div 
                  className="bg-[#cfa697] h-full" 
                  style={{ width: `${(stats.premiumUsers / stats.totalUsers) * 100}%` }}
                />
                <div 
                  className="bg-[#cfa697]/60 h-full" 
                  style={{ width: `${(stats.proUsers / stats.totalUsers) * 100}%` }}
                />
                <div 
                  className="bg-[#cfa697]/20 h-full" 
                  style={{ width: `${(stats.basicUsers / stats.totalUsers) * 100}%` }}
                />
              </div>
              <div className="flex gap-6 mt-4 text-sm font-medium">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#cfa697]" /> Premium
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#cfa697]/60" /> Pro
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#cfa697]/20" /> Básico
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl border border-[#cfa697]/10 overflow-hidden">
            <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
              <div className="relative w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar por e-mail ou nome..."
                  className="w-full pl-10 pr-4 py-2 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-[#cfa697]/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button 
                onClick={() => setIsCreatingUser(true)}
                className="px-4 py-2 bg-[#cfa697] text-white rounded-lg font-medium hover:bg-[#cfa697]/90 transition-colors flex items-center gap-2"
              >
                <Plus size={18} />
                Novo Usuário
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-neutral-50 text-neutral-500 text-sm uppercase tracking-wider">
                    <th className="px-6 py-4 font-semibold">Usuário</th>
                    <th className="px-6 py-4 font-semibold">Plano</th>
                    <th className="px-6 py-4 font-semibold">Créditos</th>
                    <th className="px-6 py-4 font-semibold">Status</th>
                    <th className="px-6 py-4 font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredUsers.map(user => (
                    <tr key={user.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#cfa697]/10 flex items-center justify-center text-[#cfa697] font-bold">
                            {user.email?.[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-neutral-900">{user.displayName || 'Sem nome'}</div>
                            <div className="text-sm text-neutral-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                          user.plan === 'premium' ? 'bg-amber-100 text-amber-700' :
                          user.plan === 'pro' ? 'bg-blue-100 text-blue-700' :
                          'bg-neutral-100 text-neutral-600'
                        }`}>
                          {user.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-medium text-neutral-700">
                        {user.credits?.toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {user.subscriptionStatus === 'active' ? (
                            <CheckCircle size={16} className="text-green-500" />
                          ) : (
                            <XCircle size={16} className="text-red-400" />
                          )}
                          <span className="text-sm capitalize">{user.subscriptionStatus || 'Inativo'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => handleEditUser(user)}
                            className="p-2 hover:bg-[#cfa697]/10 text-[#cfa697] rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user.id, user.email)}
                            className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                            title="Excluir Usuário"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pricing Tab */}
        {activeTab === 'pricing' && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.length > 0 ? (
                plans.map(plan => (
                  <div key={plan.id} className="bg-white p-8 rounded-3xl border border-[#cfa697]/10 flex flex-col">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-xl font-bold text-neutral-900">{plan.name}</h3>
                        <p className="text-sm text-neutral-500 uppercase tracking-widest font-bold mt-1">{plan.id}</p>
                      </div>
                      <button 
                        onClick={() => setEditingPlan(plan)}
                        className="p-2 hover:bg-[#cfa697]/10 text-[#cfa697] rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                    </div>
                    
                    <div className="mb-8">
                      <div className="text-4xl font-bold text-neutral-900">R$ {plan.price}</div>
                      <div className="text-sm text-neutral-500">por mês</div>
                    </div>

                    <div className="space-y-4 flex-grow">
                      <div className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                        <CreditCard size={16} className="text-[#cfa697]" />
                        {plan.credits.toLocaleString()} créditos inclusos
                      </div>
                      <div className="pt-4 border-t border-neutral-100">
                        <h4 className="text-xs font-bold text-neutral-400 uppercase mb-3">Recursos</h4>
                        <ul className="space-y-2">
                          {plan.features.map((f, i) => (
                            <li key={i} className="text-sm text-neutral-600 flex items-center gap-2">
                              <CheckCircle size={14} className="text-green-500" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full bg-white p-12 rounded-3xl border border-dashed border-[#cfa697]/30 text-center">
                  <p className="text-neutral-500 mb-4">Nenhum plano configurado no banco de dados.</p>
                  <button 
                    onClick={() => adminService.bootstrapPlans().then(loadData)}
                    className="px-6 py-3 bg-[#cfa697] text-white rounded-xl font-bold hover:bg-[#cfa697]/90 transition-all"
                  >
                    Bootstrap Planos Padrão
                  </button>
                </div>
              )}
            </div>

            {/* Credit Package Configuration */}
            <div className="bg-white p-8 rounded-3xl border border-[#cfa697]/10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#cfa697]/10 rounded-2xl flex items-center justify-center text-[#cfa697]">
                    <Coins size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Configuração de Créditos Avulsos</h3>
                    <p className="text-sm text-neutral-500">Gerencie o pacote de recarga disponível para os usuários</p>
                  </div>
                </div>
                {!isEditingCreditPackage && (
                  <button 
                    onClick={() => setIsEditingCreditPackage(true)}
                    className="px-4 py-2 bg-[#cfa697]/10 text-[#cfa697] rounded-lg font-bold hover:bg-[#cfa697]/20 transition-colors flex items-center gap-2"
                  >
                    <Edit2 size={18} />
                    Editar Pacote
                  </button>
                )}
              </div>

              {creditPackage && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-6 bg-neutral-50 rounded-2xl">
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Quantidade de Créditos</p>
                    {isEditingCreditPackage ? (
                      <input 
                        type="number" 
                        className="text-2xl font-bold bg-white border border-[#cfa697]/20 rounded-xl px-4 py-2 w-full focus:ring-2 focus:ring-[#cfa697]/20 outline-none"
                        value={isNaN(creditPackage.amount) ? '' : creditPackage.amount}
                        onChange={(e) => setCreditPackage({ ...creditPackage, amount: e.target.value === '' ? NaN : parseInt(e.target.value) })}
                      />
                    ) : (
                      <p className="text-3xl font-black text-neutral-900">{creditPackage.amount.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="p-6 bg-neutral-50 rounded-2xl">
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Preço de Venda (R$)</p>
                    {isEditingCreditPackage ? (
                      <input 
                        type="number" 
                        step="0.01"
                        className="text-2xl font-bold bg-white border border-[#cfa697]/20 rounded-xl px-4 py-2 w-full focus:ring-2 focus:ring-[#cfa697]/20 outline-none"
                        value={isNaN(creditPackage.price) ? '' : creditPackage.price}
                        onChange={(e) => setCreditPackage({ ...creditPackage, price: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                      />
                    ) : (
                      <p className="text-3xl font-black text-neutral-900">R$ {creditPackage.price.toFixed(2)}</p>
                    )}
                  </div>
                </div>
              )}

              {isEditingCreditPackage && (
                <div className="flex gap-3 mt-8">
                  <button 
                    onClick={() => {
                      setIsEditingCreditPackage(false);
                      loadData();
                    }}
                    className="px-6 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => handleUpdateCreditPackage(creditPackage!.amount, creditPackage!.price)}
                    className="px-6 py-3 bg-[#cfa697] text-white rounded-xl font-bold hover:bg-[#cfa697]/90 transition-colors flex items-center gap-2"
                  >
                    <Save size={18} />
                    Salvar Configuração
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Usage Logs Tab */}
        {activeTab === 'usage' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-[#cfa697]/10 overflow-hidden">
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <h3 className="text-xl font-bold">Atividade Recente da API</h3>
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Clock size={16} />
                  Últimas 100 requisições
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-neutral-50 text-neutral-500 text-sm uppercase tracking-wider">
                      <th className="px-6 py-4 font-semibold">Usuário</th>
                      <th className="px-6 py-4 font-semibold">Tipo de Processo</th>
                      <th className="px-6 py-4 font-semibold">Modelo / Resolução</th>
                      <th className="px-6 py-4 font-semibold">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {usageLogs.map(log => {
                      const user = users.find(u => u.id === log.userId);
                      return (
                        <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold">
                                {user?.email?.[0].toUpperCase() || '?'}
                              </div>
                              <div>
                                <div className="text-sm font-bold text-neutral-900">{user?.displayName || 'Usuário Desconhecido'}</div>
                                <div className="text-xs text-neutral-500">{user?.email || log.userId}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                                log.type === 'image' ? 'bg-purple-100 text-purple-700' :
                                log.type === 'video' ? 'bg-blue-100 text-blue-700' :
                                log.type === 'prompt' ? 'bg-amber-100 text-amber-700' :
                                log.type === 'scan' ? 'bg-green-100 text-green-700' :
                                'bg-neutral-100 text-neutral-700'
                              }`}>
                                {log.type === 'prompt' ? 'Geração de Prompt' :
                                 log.type === 'scan' ? 'Escaneamento' :
                                 log.type === 'read' ? 'Leitura Arquitetônica' :
                                 log.type === 'image' ? 'Geração de Imagem' :
                                 log.type === 'video' ? 'Geração de Vídeo' : log.type}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="text-sm font-medium flex items-center gap-1">
                                <Cpu size={14} className="text-neutral-400" />
                                {log.model || 'N/A'}
                              </div>
                              {log.resolution && log.resolution !== 'n/a' && (
                                <div className="text-xs text-neutral-500 flex items-center gap-1">
                                  <Monitor size={14} className="text-neutral-400" />
                                  {log.resolution}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-neutral-500">
                            {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : 'Recentemente'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Create User Modal */}
      {isCreatingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <h2 className="text-2xl font-bold mb-6">Novo Usuário</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-neutral-500 uppercase mb-2">Nome Completo</label>
                <input 
                  type="text" 
                  className="w-full p-3 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-[#cfa697]/20"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                  placeholder="Ex: João Silva"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-500 uppercase mb-2">E-mail</label>
                <input 
                  type="email" 
                  className="w-full p-3 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-[#cfa697]/20"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  placeholder="Ex: joao@email.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-neutral-500 uppercase mb-2">Plano</label>
                  <select 
                    className="w-full p-3 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-[#cfa697]/20"
                    value={newUser.plan}
                    onChange={(e) => setNewUser({ ...newUser, plan: e.target.value })}
                  >
                    <option value="basic">Básico</option>
                    <option value="pro">Profissional</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-500 uppercase mb-2">Função</label>
                  <select 
                    className="w-full p-3 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-[#cfa697]/20"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="user">Usuário</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-500 uppercase mb-2">Créditos Iniciais</label>
                <input 
                  type="number" 
                  className="w-full p-3 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-[#cfa697]/20"
                  value={isNaN(newUser.credits) ? '' : newUser.credits}
                  onChange={(e) => setNewUser({ ...newUser, credits: e.target.value === '' ? NaN : parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-500 uppercase mb-2">Status da Assinatura</label>
                <select 
                  className="w-full p-3 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-[#cfa697]/20"
                  value={newUser.subscriptionStatus}
                  onChange={(e) => setNewUser({ ...newUser, subscriptionStatus: e.target.value })}
                >
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="trialing">Trial</option>
                  <option value="canceled">Cancelado</option>
                </select>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsCreatingUser(false)}
                  className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleCreateUser}
                  className="flex-1 py-3 bg-[#cfa697] text-white rounded-xl font-bold hover:bg-[#cfa697]/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Criar Usuário
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-2xl font-bold mb-6">Editar Usuário</h2>
            <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-neutral-500 uppercase mb-2">Plano</label>
                  <select 
                    className="w-full p-3 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-[#cfa697]/20"
                    value={editingUser.plan}
                    onChange={(e) => setEditingUser({ ...editingUser, plan: e.target.value })}
                  >
                    <option value="basic">Básico</option>
                    <option value="pro">Profissional</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-neutral-500 uppercase mb-2">Status</label>
                  <select 
                    className="w-full p-3 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-[#cfa697]/20"
                    value={editingUser.subscriptionStatus || 'inactive'}
                    onChange={(e) => setEditingUser({ ...editingUser, subscriptionStatus: e.target.value })}
                  >
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                    <option value="trialing">Trial</option>
                    <option value="canceled">Cancelado</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-neutral-500 uppercase mb-2">Créditos</label>
                <input 
                  type="number" 
                  className="w-full p-3 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-[#cfa697]/20"
                  value={isNaN(editingUser.credits) ? '' : editingUser.credits}
                  onChange={(e) => setEditingUser({ ...editingUser, credits: e.target.value === '' ? NaN : parseInt(e.target.value) })}
                />
              </div>
              
              <div className="pt-4 border-t border-neutral-100">
                <h3 className="text-sm font-bold text-neutral-400 uppercase mb-4">Uso Recente</h3>
                {loadingUserUsage ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="animate-spin text-[#cfa697]" size={20} />
                  </div>
                ) : userUsageLogs.length > 0 ? (
                  <div className="space-y-2">
                    {userUsageLogs.map(log => (
                      <div key={log.id} className="flex items-center justify-between text-xs p-2 bg-neutral-50 rounded-lg">
                        <span className="font-medium capitalize">{log.type}</span>
                        <span className="text-neutral-500">{log.timestamp?.toDate ? log.timestamp.toDate().toLocaleDateString() : 'Recent'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-neutral-400 text-center py-4">Nenhum log de uso encontrado.</p>
                )}
              </div>
              
              <div className="flex gap-3 pt-4 sticky bottom-0 bg-white pb-2">
                <button 
                  onClick={() => handleDeleteUser(editingUser.id, editingUser.email)}
                  className="p-3 bg-red-50 text-red-500 rounded-xl hover:bg-red-100 transition-colors"
                  title="Excluir Usuário"
                >
                  <Trash2 size={20} />
                </button>
                <button 
                  onClick={() => setEditingUser(null)}
                  className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleUpdateUser(editingUser.id, editingUser.plan, editingUser.credits, editingUser.subscriptionStatus || 'inactive')}
                  className="flex-1 py-3 bg-[#cfa697] text-white rounded-xl font-bold hover:bg-[#cfa697]/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Salvar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
          >
            <h2 className="text-2xl font-bold mb-6">Editar Plano: {editingPlan.name}</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-neutral-500 uppercase mb-2">Preço (R$)</label>
                <input 
                  type="number" 
                  step="0.01"
                  className="w-full p-3 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-[#cfa697]/20"
                  value={isNaN(editingPlan.price) ? '' : editingPlan.price}
                  onChange={(e) => setEditingPlan({ ...editingPlan, price: e.target.value === '' ? NaN : parseFloat(e.target.value) })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-neutral-500 uppercase mb-2">Créditos</label>
                <input 
                  type="number" 
                  className="w-full p-3 bg-neutral-50 border-none rounded-xl focus:ring-2 focus:ring-[#cfa697]/20"
                  value={isNaN(editingPlan.credits) ? '' : editingPlan.credits}
                  onChange={(e) => setEditingPlan({ ...editingPlan, credits: e.target.value === '' ? NaN : parseInt(e.target.value) })}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setEditingPlan(null)}
                  className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => handleUpdatePlan(editingPlan.id, editingPlan.price, editingPlan.credits)}
                  className="flex-1 py-3 bg-[#cfa697] text-white rounded-xl font-bold hover:bg-[#cfa697]/90 transition-colors flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Salvar
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

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
            {notification.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
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

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
          >
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">Excluir Usuário?</h2>
            <p className="text-neutral-500 mb-8">
              Tem certeza que deseja excluir <strong>{userToDelete.email}</strong>? Esta ação é permanente e não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setUserToDelete(null)}
                className="flex-1 py-3 bg-neutral-100 text-neutral-600 rounded-xl font-bold hover:bg-neutral-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmDeleteUser}
                className="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

const UsageStatCard = ({ title, value, icon: Icon, color }: any) => {
  const colors: any = {
    blue: 'text-blue-600 bg-blue-50',
    purple: 'text-purple-600 bg-purple-50',
    green: 'text-green-600 bg-green-50',
    amber: 'text-amber-600 bg-amber-50',
    indigo: 'text-indigo-600 bg-indigo-50',
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-[#cfa697]/10 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">{title}</p>
        <p className="text-lg font-bold text-neutral-900">{value}</p>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }: any) => {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-[#cfa697]/10">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-500">{title}</p>
          <p className="text-2xl font-bold text-neutral-900">{value}</p>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
