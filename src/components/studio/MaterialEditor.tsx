import React, { useState } from 'react';
import { Material, MaterialCategory } from '../../types/studio';
import { useStudioStore } from '../../store/studioStore';
import { X, Save, Layers, Sun, Activity, Box, Info, Trash2, Camera, Loader2, Maximize2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { validateMaterial, MATERIAL_CATEGORIES } from '../../utils/materialUtils';
import kieService from '../../services/kieService';

interface MaterialEditorProps {
  material: Material;
  onClose: () => void;
}

const MaterialEditor: React.FC<MaterialEditorProps> = ({ material, onClose }) => {
  const { updateMaterial } = useStudioStore();
  const [edited, setEdited] = useState<Material>({ ...material });
  const [isAnalyzingReflection, setIsAnalyzingReflection] = useState(false);
  const reflectionInputRef = React.useRef<HTMLInputElement>(null);

  const handleSave = () => {
    const validated = validateMaterial(edited);
    updateMaterial(material.id, { ...validated, user_edited: true });
    onClose();
  };

  const updateField = (path: string, value: any) => {
    const newEdited = { ...edited };
    const parts = path.split('.');
    let current: any = newEdited;
    for (let i = 0; i < parts.length - 1; i++) {
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    setEdited(newEdited);
  };

  const handleReflectionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAnalyzingReflection(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        // Analyze the reflection image
        const analysis = await kieService.analyzeMaterialImage(base64);
        
        updateField('reflection_image_url', base64);
        updateField('reflection_analysis', analysis);
        setIsAnalyzingReflection(false);
      };
    } catch (err) {
      console.error('Error analyzing reflection image:', err);
      setIsAnalyzingReflection(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-white dark:bg-neutral-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50 dark:bg-neutral-800/50">
          <div className="flex items-center gap-4">
            <div 
              className="w-12 h-12 rounded-2xl border-2 border-white dark:border-neutral-700 shadow-lg"
              style={{ backgroundColor: edited.pbr_diffuse.color_hex }}
            />
            <div>
              <h3 className="text-xl font-bold">Editar Material</h3>
              <p className="text-sm text-neutral-500 uppercase tracking-wider font-bold">{edited.elemento}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-10">
          {/* Basic Info */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-neutral-500 ml-1">Elemento</label>
              <input
                type="text"
                value={edited.elemento}
                onChange={(e) => updateField('elemento', e.target.value)}
                className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-2xl py-3 px-4 font-bold focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-neutral-500 ml-1">Acabamento</label>
              <input
                type="text"
                value={edited.acabamento}
                onChange={(e) => updateField('acabamento', e.target.value)}
                className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-2xl py-3 px-4 font-bold focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-neutral-500 ml-1">Referência de Localização</label>
              <input
                type="text"
                value={edited.location_reference || ''}
                onChange={(e) => updateField('location_reference', e.target.value)}
                placeholder="Ex: Parede ao fundo, Piso central..."
                className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-2xl py-3 px-4 font-bold focus:ring-2 focus:ring-primary transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-neutral-500 ml-1">Categoria</label>
              <select
                value={edited.material_category}
                onChange={(e) => updateField('material_category', e.target.value)}
                className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-2xl py-3 px-4 font-bold focus:ring-2 focus:ring-primary transition-all"
              >
                {MATERIAL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-neutral-500 ml-1">Reflectância</label>
              <select
                value={edited.reflectancia}
                onChange={(e) => updateField('reflectancia', e.target.value)}
                className="w-full bg-neutral-100 dark:bg-neutral-800 border-none rounded-2xl py-3 px-4 font-bold focus:ring-2 focus:ring-primary transition-all"
              >
                <option value="matte">Matte</option>
                <option value="semi-matte">Semi-Matte</option>
                <option value="semi-gloss">Semi-Gloss</option>
                <option value="gloss">Gloss</option>
                <option value="espelhado">Espelhado</option>
              </select>
            </div>
          </section>

          {/* PBR Layers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Diffuse & Reflection */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2 text-primary uppercase tracking-widest text-xs">
                  <Layers size={14} /> Diffuse Layer
                </h4>
                <div className="bg-neutral-50 dark:bg-neutral-950 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 space-y-6">
                  <div className="flex items-center gap-4">
                    <input
                      type="color"
                      value={edited.pbr_diffuse.color_hex}
                      onChange={(e) => updateField('pbr_diffuse.color_hex', e.target.value)}
                      className="w-12 h-12 rounded-xl cursor-pointer border-none bg-transparent"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-neutral-500 mb-1">Color Hex</p>
                      <input
                        type="text"
                        value={edited.pbr_diffuse.color_hex}
                        onChange={(e) => updateField('pbr_diffuse.color_hex', e.target.value)}
                        className="w-full bg-transparent border-none p-0 font-mono font-bold text-sm focus:ring-0"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase">Texture Type</p>
                      <select
                        value={edited.pbr_diffuse.texture_type}
                        onChange={(e) => updateField('pbr_diffuse.texture_type', e.target.value)}
                        className="w-full bg-white dark:bg-neutral-900 border-none rounded-xl py-2 px-3 text-xs font-bold"
                      >
                        <option value="solid">Solid</option>
                        <option value="pattern">Pattern</option>
                        <option value="natural">Natural</option>
                        <option value="fabric_weave">Fabric</option>
                        <option value="rough">Rough</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase">Scale</p>
                      <select
                        value={edited.pbr_diffuse.texture_scale}
                        onChange={(e) => updateField('pbr_diffuse.texture_scale', e.target.value)}
                        className="w-full bg-white dark:bg-neutral-900 border-none rounded-xl py-2 px-3 text-xs font-bold"
                      >
                        <option value="micro">Micro</option>
                        <option value="fine">Fine</option>
                        <option value="medium">Medium</option>
                        <option value="coarse">Coarse</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2 text-warning uppercase tracking-widest text-xs">
                  <Sun size={14} /> Reflection Layer
                </h4>
                <div className="bg-neutral-50 dark:bg-neutral-950 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-neutral-500">Intensity</p>
                      <p className="text-xs font-bold text-primary">{Math.round(edited.pbr_reflection.intensity * 100)}%</p>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={edited.pbr_reflection.intensity}
                      onChange={(e) => updateField('pbr_reflection.intensity', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <p className="text-xs font-bold">Metallic</p>
                    <button
                      onClick={() => updateField('pbr_reflection.is_metallic', !edited.pbr_reflection.is_metallic)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${edited.pbr_reflection.is_metallic ? 'bg-primary' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${edited.pbr_reflection.is_metallic ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Glossiness & Bump */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2 text-secondary uppercase tracking-widest text-xs">
                  <Activity size={14} /> Glossiness & Surface
                </h4>
                <div className="bg-neutral-50 dark:bg-neutral-950 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-neutral-500">Smoothness</p>
                      <p className="text-xs font-bold text-primary">{Math.round(edited.pbr_glossiness.smoothness * 100)}%</p>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={edited.pbr_glossiness.smoothness}
                      onChange={(e) => updateField('pbr_glossiness.smoothness', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-neutral-500">Micro Surface Variation</p>
                      <p className="text-xs font-bold text-primary">{Math.round(edited.pbr_glossiness.micro_surface_variation * 100)}%</p>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={edited.pbr_glossiness.micro_surface_variation}
                      onChange={(e) => updateField('pbr_glossiness.micro_surface_variation', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold flex items-center gap-2 text-error uppercase tracking-widest text-xs">
                  <Box size={14} /> Bump & Relief
                </h4>
                <div className="bg-neutral-50 dark:bg-neutral-950 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 space-y-6">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-neutral-500">Bump Height</p>
                      <p className="text-xs font-bold text-primary">{Math.round(edited.pbr_bump.bump_height * 100)}%</p>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={edited.pbr_bump.bump_height}
                      onChange={(e) => updateField('pbr_bump.bump_height', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-neutral-400 uppercase">Bump Pattern</p>
                    <select
                      value={edited.pbr_bump.bump_pattern}
                      onChange={(e) => updateField('pbr_bump.bump_pattern', e.target.value)}
                      className="w-full bg-white dark:bg-neutral-900 border-none rounded-xl py-2 px-3 text-xs font-bold"
                    >
                      <option value="smooth">Smooth</option>
                      <option value="subtle">Subtle</option>
                      <option value="pronounced">Pronounced</option>
                      <option value="extreme">Extreme</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Light Behavior & Subsurface */}
            <div className="lg:col-span-2 space-y-4">
              <h4 className="font-bold flex items-center gap-2 text-info uppercase tracking-widest text-xs">
                <Info size={14} /> Light Behavior & Translucency
              </h4>
              <div className="bg-neutral-50 dark:bg-neutral-950 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-neutral-500">Scattering Description</p>
                    <input
                      type="text"
                      value={edited.pbr_light_behavior.scattering_description}
                      onChange={(e) => updateField('pbr_light_behavior.scattering_description', e.target.value)}
                      className="w-full bg-white dark:bg-neutral-900 border-none rounded-xl py-2 px-3 text-xs font-bold"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                    <p className="text-xs font-bold">Subsurface Scattering</p>
                    <button
                      onClick={() => updateField('pbr_light_behavior.subsurface_scattering', !edited.pbr_light_behavior.subsurface_scattering)}
                      className={`w-12 h-6 rounded-full transition-colors relative ${edited.pbr_light_behavior.subsurface_scattering ? 'bg-primary' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${edited.pbr_light_behavior.subsurface_scattering ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-neutral-500">Translucency</p>
                      <p className="text-xs font-bold text-primary">{Math.round((edited.pbr_light_behavior.translucency || 0) * 100)}%</p>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={edited.pbr_light_behavior.translucency || 0}
                      onChange={(e) => updateField('pbr_light_behavior.translucency', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-bold text-neutral-500">Index of Refraction (IOR)</p>
                      <p className="text-xs font-bold text-primary">{edited.pbr_light_behavior.ior || 1.5}</p>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="2.5"
                      step="0.01"
                      value={edited.pbr_light_behavior.ior || 1.5}
                      onChange={(e) => updateField('pbr_light_behavior.ior', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mirror Configuration */}
          <section className="space-y-6 pt-10 border-t border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center justify-between">
              <h4 className="font-bold flex items-center gap-2 text-primary uppercase tracking-widest text-xs">
                <Maximize2 size={14} /> Configuração de Espelho
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">Este material é um espelho?</span>
                <button
                  onClick={() => updateField('is_mirror', !edited.is_mirror)}
                  className={`w-12 h-6 rounded-full transition-colors relative ${edited.is_mirror ? 'bg-primary' : 'bg-neutral-300 dark:bg-neutral-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${edited.is_mirror ? 'left-7' : 'left-1'}`} />
                </button>
              </div>
            </div>

            {edited.is_mirror && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8 overflow-hidden"
              >
                <div className="space-y-4">
                  <div className="bg-neutral-50 dark:bg-neutral-950 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 space-y-4">
                    <p className="text-xs font-bold text-neutral-500 uppercase">Cor da Localidade (Onde está o espelho)</p>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={edited.mirror_location_color_hex || '#ffffff'}
                        onChange={(e) => updateField('mirror_location_color_hex', e.target.value)}
                        className="w-12 h-12 rounded-xl cursor-pointer border-none bg-transparent"
                      />
                      <input
                        type="text"
                        value={edited.mirror_location_color_hex || '#ffffff'}
                        onChange={(e) => updateField('mirror_location_color_hex', e.target.value)}
                        className="flex-1 bg-white dark:bg-neutral-900 border-none rounded-xl py-2 px-3 font-mono font-bold text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-neutral-50 dark:bg-neutral-950 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 space-y-4">
                    <p className="text-xs font-bold text-neutral-500 uppercase">Imagem de Reflexo</p>
                    <div 
                      onClick={() => reflectionInputRef.current?.click()}
                      className="aspect-video rounded-2xl border-2 border-dashed border-neutral-200 dark:border-neutral-800 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all overflow-hidden relative group"
                    >
                      {edited.reflection_image_url ? (
                        <>
                          <img 
                            src={edited.reflection_image_url} 
                            className="w-full h-full object-cover" 
                            alt="Reflexo"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <p className="text-white text-xs font-bold">Trocar Imagem</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <ImageIcon size={24} className="text-neutral-400" />
                          <p className="text-[10px] font-bold text-neutral-400">Anexar imagem que será refletida</p>
                        </>
                      )}
                      
                      {isAnalyzingReflection && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-neutral-900/80 flex flex-col items-center justify-center gap-2">
                          <Loader2 size={24} className="animate-spin text-primary" />
                          <p className="text-[10px] font-bold">Analisando reflexo...</p>
                        </div>
                      )}
                    </div>
                    <input
                      type="file"
                      ref={reflectionInputRef}
                      onChange={handleReflectionUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    {edited.reflection_analysis && (
                      <div className="p-3 bg-success/10 rounded-xl flex items-center gap-2">
                        <CheckCircle2 size={14} className="text-success" />
                        <p className="text-[10px] font-bold text-success">Reflexo analisado com sucesso</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-4 bg-neutral-50 dark:bg-neutral-800/50">
          <button
            onClick={onClose}
            className="px-6 py-3 font-bold text-neutral-500 hover:text-neutral-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-8 py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-2xl transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
          >
            <Save size={18} />
            Salvar Alterações
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MaterialEditor;
