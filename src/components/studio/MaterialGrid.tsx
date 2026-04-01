import React from 'react';
import { useStudioStore } from '../../store/studioStore';
import MaterialCard from './MaterialCard';
import { calculateMaterialMetrics, createBlankMaterial } from '../../utils/materialUtils';
import { motion } from 'framer-motion';
import { Layers, Plus } from 'lucide-react';

const MaterialGrid: React.FC = () => {
  const { materials, setMaterialMetrics, addMaterial } = useStudioStore();

  const handleAddMaterial = () => {
    const newId = `mat_manual_${Date.now()}`;
    const newMaterial = createBlankMaterial(newId);
    addMaterial(newMaterial);
  };

  React.useEffect(() => {
    if (materials.length > 0) {
      const metrics = calculateMaterialMetrics(materials);
      setMaterialMetrics(metrics);
    }
  }, [materials, setMaterialMetrics]);

  if (materials.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <Layers size={20} />
          </div>
          <div>
            <h3 className="text-xl font-bold">Análise de Materiais</h3>
            <p className="text-sm text-neutral-500">{materials.length} materiais identificados</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {materials.map((material, index) => (
          <motion.div
            key={material.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <MaterialCard material={material} />
          </motion.div>
        ))}

        {/* Add Material Card */}
        <motion.button
          onClick={handleAddMaterial}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="h-full min-h-[180px] flex flex-col items-center justify-center gap-3 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 text-neutral-400 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all group"
        >
          <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <Plus size={24} />
          </div>
          <div className="text-center">
            <p className="font-bold text-sm">Adicionar Material</p>
            <p className="text-[10px]">Manual ou via referência</p>
          </div>
        </motion.button>
      </div>
    </div>
  );
};

export default MaterialGrid;
