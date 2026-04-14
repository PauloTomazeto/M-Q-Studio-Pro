import React, { useState } from 'react';
import { Material } from '../../types/studio';
import { useStudioStore } from '../../store/studioStore';
import kieService from '../../services/kieService';
import { Edit3, Image as ImageIcon, CheckCircle2, AlertCircle, Loader2, Upload, Maximize2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MaterialEditor from './MaterialEditor';

interface MaterialCardProps {
  material: Material;
}

const MaterialCard: React.FC<MaterialCardProps> = ({ material }) => {
  const { updateMaterial, setMaterialAnalysisStatus } = useStudioStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzing(true);
    setMaterialAnalysisStatus('processing');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        const analysis = await kieService.analyzeMaterialImage(base64);
        
        // Update material with analyzed data
        updateMaterial(material.id, {
          ...analysis,
          attached_image_url: base64,
          confidence: 100, // Manual upload analysis is high confidence
          user_edited: true
        });
        setIsAnalyzing(false);
        setMaterialAnalysisStatus('completed');
      };
    } catch (err) {
      console.error('Error analyzing material image:', err);
      setIsAnalyzing(false);
      setMaterialAnalysisStatus('failed');
    }
  };

  const getReflectanceIcon = (type: string) => {
    switch (type) {
      case 'matte': return '○';
      case 'semi-matte': return '◐';
      case 'semi-gloss': return '◑';
      case 'gloss': return '●';
      case 'espelhado': return '✦';
      default: return '○';
    }
  };

  return (
    <>
      <div className={`relative bg-white dark:bg-neutral-900 rounded-2xl border transition-all overflow-hidden ${
        material.is_dominant ? 'border-primary/50 shadow-md' : 'border-neutral-200 dark:border-neutral-800'
      }`}>
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-inner"
                style={{ backgroundColor: material.pbr_diffuse.color_hex }}
              />
              <div>
                <h4 className="font-bold text-sm leading-tight">{material.elemento}</h4>
                <p className="text-[10px] text-neutral-500 line-clamp-1">{material.acabamento}</p>
                {material.location_reference && (
                  <p className="text-[9px] text-primary/70 font-medium mt-0.5 italic">
                    📍 {material.location_reference}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {material.is_mirror && (
                <Maximize2 size={12} className="text-primary" title="Espelho" />
              )}
              {material.user_edited && (
                <div className="w-2 h-2 bg-success rounded-full" title="Editado pelo usuário" />
              )}
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                material.confidence > 80 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
              }`}>
                {material.confidence}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-neutral-50 dark:bg-neutral-950 p-2 rounded-lg border border-neutral-100 dark:border-neutral-800">
              <p className="text-[10px] text-neutral-500 uppercase font-bold mb-1">Reflectância</p>
              <div className="flex items-center gap-1.5">
                <span className="text-primary font-bold">{getReflectanceIcon(material.reflectancia)}</span>
                <span className="text-xs font-bold capitalize">{material.reflectancia.replace('-', ' ')}</span>
              </div>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-950 p-2 rounded-lg border border-neutral-100 dark:border-neutral-800">
              <p className="text-[10px] text-neutral-500 uppercase font-bold mb-1">Visibilidade</p>
              <div className="flex items-center gap-1.5">
                <div className="flex-1 h-1 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${material.visibility}%` }} />
                </div>
                <span className="text-[10px] font-bold">{material.visibility}%</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <button
              onClick={() => setIsEditing(true)}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-xl text-xs font-bold transition-colors"
            >
              <Edit3 size={14} />
              Editar
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="w-10 h-10 flex items-center justify-center bg-primary/10 text-primary hover:bg-primary/20 rounded-xl transition-colors disabled:opacity-50"
              title="Anexar imagem do material"
            >
              {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>

        {material.attached_image_url && (
          <div className="h-1 bg-primary/30" />
        )}
      </div>

      <AnimatePresence>
        {isEditing && (
          <MaterialEditor
            material={material}
            onClose={() => setIsEditing(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
};

export default MaterialCard;
