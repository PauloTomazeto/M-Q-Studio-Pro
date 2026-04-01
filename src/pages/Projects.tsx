import React from 'react';
import { FolderKanban, Plus, Search, Filter, MoreVertical, Star, Loader2, History, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useHistory } from '../hooks/useHistory';
import { useNavigate } from 'react-router-dom';

const Projects: React.FC = () => {
  const { history, loading } = useHistory(50);
  const navigate = useNavigate();

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Projetos</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Gerencie e organize suas visualizações arquitetônicas.
          </p>
        </div>
        <button 
          onClick={() => navigate('/studio')}
          className="flex items-center justify-center gap-2 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95"
        >
          <Plus size={18} />
          Novo Projeto
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar projetos..." 
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
          <Filter size={18} />
          Filtros
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      ) : history.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {history.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm hover:border-primary/30 transition-all group cursor-pointer"
            >
              <div className="aspect-video bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-400 group-hover:text-primary transition-colors relative overflow-hidden">
                <History size={48} />
                <div className="absolute top-4 right-4">
                  <button className="p-2 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm rounded-lg border border-neutral-200 dark:border-neutral-700 hover:text-primary transition-colors">
                    <MoreVertical size={16} />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold truncate capitalize">{item.scanData.typology} Analysis</h4>
                    <p className="text-xs text-neutral-500 mt-1">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="bg-success/10 text-success text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {item.scanData.confidence.general}%
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((_, i) => (
                      <div key={i} className="w-2 h-2 rounded-full bg-primary/20" />
                    ))}
                  </div>
                  <button className="text-primary text-sm font-bold flex items-center gap-1 hover:underline">
                    Ver Detalhes
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="sm:col-span-2 lg:col-span-3 bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto text-neutral-400">
              <FolderKanban size={32} />
            </div>
            <h3 className="text-lg font-semibold">Nenhum projeto encontrado</h3>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto">
              Você ainda não criou nenhum projeto. Comece agora mesmo no Studio!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
