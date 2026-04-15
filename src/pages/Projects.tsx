import React, { useState, useEffect } from 'react';
import { 
  FolderKanban, Plus, Search, Filter, MoreVertical, 
  Loader2, History, ChevronRight, Edit3, Wand2, 
  Image as ImageIcon, Clock, Trash2, Eye, Download, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase, getCurrentUser } from '../supabase';
// Migrated to Supabase - import here will be replaced in next refactor
import { useStudioStore } from '../store/studioStore';

const Projects: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewingResults, setViewingResults] = useState<any | null>(null);
  const [selectedResultIndex, setSelectedResultIndex] = useState(0);
  const navigate = useNavigate();
  const { loadProject } = useStudioStore();

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const user = await getCurrentUser();
        if (!user?.id) {
          setLoading(false);
          return;
        }

        // Fetch initial projects
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setProjects(data || []);

        // Subscribe to real-time changes
        const subscription = supabase
          .channel('projects-list')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'projects',
              filter: `user_id=eq.${user.id}`
            },
            () => {
              // Reload projects on any change
              loadProjects();
            }
          )
          .subscribe();

        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error('Error fetching projects:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  const handleEdit = (project: any) => {
    loadProject(project);
    navigate('/studio');
  };

  const handleGenerate = (project: any) => {
    navigate(`/image-generation?projectId=${project.id}`);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;
      setDeleteId(null);
      setProjects(projects.filter(p => p.id !== deleteId));
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meus Projetos</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1">
            Gerencie e organize suas visualizações arquitetônicas salvas.
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
            placeholder="Buscar projetos pelo nome..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-primary" size={48} />
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredProjects.map((project, i) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm hover:border-primary/30 transition-all group flex flex-col"
              >
                <div className="aspect-video bg-neutral-100 dark:bg-neutral-800 relative overflow-hidden">
                  {project.originalImage ? (
                    <img 
                      src={project.originalImage} 
                      alt={project.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-400">
                      <ImageIcon size={48} />
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                      onClick={() => setDeleteId(project.id)}
                      className="p-2 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm rounded-lg border border-neutral-200 dark:border-neutral-700 hover:text-error transition-colors shadow-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col space-y-4">
                  <div className="space-y-1">
                    <h4 className="font-bold text-lg truncate">{project.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Clock size={12} />
                      {new Date(project.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex-1">
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-3 italic bg-neutral-50 dark:bg-neutral-800/50 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800">
                      "{project.prompt}"
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                    <button 
                      onClick={() => handleEdit(project)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl text-sm font-bold transition-all"
                    >
                      <Edit3 size={16} />
                      Editar
                    </button>
                    <button 
                      onClick={() => handleGenerate(project)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl text-sm font-bold transition-all"
                    >
                      <Wand2 size={16} />
                      Gerar
                    </button>
                  </div>

                  {project.generatedImages && project.generatedImages.length > 0 && (
                    <button 
                      onClick={() => {
                        setViewingResults(project);
                        setSelectedResultIndex(0);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-secondary/10 text-secondary hover:bg-secondary/20 rounded-xl text-sm font-bold transition-all mt-2"
                    >
                      <Eye size={16} />
                      Ver Resultados ({project.generatedImages.length})
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-20 text-center space-y-6">
          <div className="w-20 h-20 bg-neutral-50 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto text-neutral-300">
            <FolderKanban size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold">Nenhum projeto encontrado</h3>
            <p className="text-neutral-500 dark:text-neutral-400 max-w-xs mx-auto">
              Você ainda não salvou nenhum projeto. Comece criando um novo prompt no Studio!
            </p>
          </div>
          <button 
            onClick={() => navigate('/studio')}
            className="inline-flex items-center gap-2 text-primary font-bold hover:underline"
          >
            Ir para o Studio
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 p-8 max-w-sm w-full shadow-2xl space-y-6"
            >
              <div className="w-16 h-16 bg-error/10 text-error rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={32} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold">Excluir Projeto?</h3>
                <p className="text-neutral-500 dark:text-neutral-400">
                  Esta ação não pode ser desfeita. O projeto será removido permanentemente.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-4 py-3 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded-xl font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-3 bg-error text-white hover:bg-error-dark rounded-xl font-bold transition-all shadow-lg shadow-error/20"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Results Viewer Modal */}
      <AnimatePresence>
        {viewingResults && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingResults(null)}
              className="absolute inset-0 bg-white/20 dark:bg-black/60 backdrop-blur-3xl"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-neutral-900 rounded-[3rem] border border-neutral-200 dark:border-neutral-800 w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-bold">{viewingResults.name}</h3>
                  <p className="text-xs text-neutral-500">Resultados Gerados</p>
                </div>
                <button 
                  onClick={() => setViewingResults(null)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 flex flex-col md:flex-row gap-8">
                {/* Main Viewer */}
                <div className="flex-1 flex flex-col gap-6">
                  <div className="aspect-video bg-neutral-50 dark:bg-neutral-950 rounded-3xl border border-neutral-100 dark:border-neutral-800 overflow-hidden flex items-center justify-center relative group">
                    <img 
                      src={viewingResults?.generatedImages?.[selectedResultIndex].url} 
                      className="max-w-full max-h-full object-contain"
                      alt="Result"
                    />
                    <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => window.open(viewingResults?.generatedImages?.[selectedResultIndex].url, '_blank')}
                        className="p-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md rounded-xl shadow-lg hover:scale-110 transition-transform"
                      >
                        <Download size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-4">
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase block">Resolução</span>
                        <span className="font-bold text-sm">{viewingResults?.generatedImages?.[selectedResultIndex].resolution}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase block">Formato</span>
                        <span className="font-bold text-sm">{viewingResults?.generatedImages?.[selectedResultIndex].aspectRatio}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase block">Data</span>
                        <span className="font-bold text-sm">{new Date(viewingResults?.generatedImages?.[selectedResultIndex].createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => window.open(viewingResults?.generatedImages?.[selectedResultIndex].url, '_blank')}
                      className="px-6 py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
                    >
                      <Download size={18} />
                      Download
                    </button>
                  </div>
                </div>

                {/* Thumbnails Sidebar */}
                <div className="w-full md:w-48 shrink-0 space-y-4">
                  <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Galeria</h4>
                  <div className="grid grid-cols-4 md:grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {viewingResults?.generatedImages?.map((img: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedResultIndex(idx)}
                        className={`aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          selectedResultIndex === idx ? 'border-primary scale-95 shadow-lg' : 'border-transparent hover:border-neutral-300'
                        }`}
                      >
                        <img src={img.url} className="w-full h-full object-cover" alt={`Thumb ${idx}`} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Projects;
