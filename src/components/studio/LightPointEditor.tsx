import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Trash2, Lightbulb, Thermometer, Zap, Layers, Eye, EyeOff, Target, Move } from 'lucide-react';
import { LightPoint, LightPointType, LightPointShape, LightDecay } from '../../types/studio';
import { useStudioStore } from '../../store/studioStore';

interface LightPointEditorProps {
  light: LightPoint;
  onClose: () => void;
  imageUrl: string;
}

export const LightPointEditor: React.FC<LightPointEditorProps> = ({ light, onClose, imageUrl }) => {
  const [editedLight, setEditedLight] = useState<LightPoint>(light);
  const { updateLightPoint, deleteLightPoint } = useStudioStore();
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleSave = () => {
    updateLightPoint(light.id, editedLight);
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm('Tem certeza que deseja excluir este ponto de luz?')) {
      deleteLightPoint(light.id);
      onClose();
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingLocation || !imageRef.current) return;

    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setEditedLight(prev => ({
      ...prev,
      spatial_x_pct: Math.max(0, Math.min(100, x)),
      spatial_y_pct: Math.max(0, Math.min(100, y))
    }));
    setIsSelectingLocation(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-[#151619] border border-white/10 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-orange-500/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <Lightbulb className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Editar Ponto de Luz</h2>
              <p className="text-xs text-white/40 font-mono uppercase tracking-wider">{light.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-6 h-6 text-white/60" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Visual Placement */}
          <div className="space-y-6">
            <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-black group">
              <img
                ref={imageRef}
                src={imageUrl}
                alt="Referência de Iluminação"
                className="w-full h-full object-contain"
                onClick={handleImageClick}
              />
              
              {/* Light Point Indicator */}
              <motion.div
                style={{
                  left: `${editedLight.spatial_x_pct}%`,
                  top: `${editedLight.spatial_y_pct}%`,
                }}
                className="absolute w-8 h-8 -ml-4 -mt-4 flex items-center justify-center pointer-events-none"
              >
                <div className="absolute inset-0 bg-orange-500/40 rounded-full animate-ping" />
                <div className="relative w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(249,115,22,0.8)]" />
              </motion.div>

              {isSelectingLocation && (
                <div className="absolute inset-0 bg-orange-500/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                  <div className="bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    Clique na imagem para posicionar a luz
                  </div>
                </div>
              )}

              <button
                onClick={() => setIsSelectingLocation(!isSelectingLocation)}
                className={`absolute bottom-4 right-4 p-3 rounded-full shadow-lg transition-all flex items-center gap-2 ${
                  isSelectingLocation ? 'bg-orange-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Move className="w-5 h-5" />
                <span className="text-sm font-medium">Reposicionar</span>
              </button>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">Descrição da Localização</label>
              <input
                type="text"
                value={editedLight.location_description}
                onChange={(e) => setEditedLight({ ...editedLight, location_description: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500/50 transition-colors"
                placeholder="Ex: Canto superior esquerdo, sancas de gesso..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">Impacto Visual</label>
                <select
                  value={editedLight.visual_impact}
                  onChange={(e) => setEditedLight({ ...editedLight, visual_impact: e.target.value as any })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none"
                >
                  <option value="high">Alto</option>
                  <option value="medium">Médio</option>
                  <option value="low">Baixo</option>
                </select>
              </div>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <label className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2 block">Função</label>
                <select
                  value={editedLight.serves_as}
                  onChange={(e) => setEditedLight({ ...editedLight, serves_as: e.target.value as any })}
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none"
                >
                  <option value="key_light">Luz Principal (Key)</option>
                  <option value="fill_light">Luz de Preenchimento (Fill)</option>
                  <option value="back_light">Luz de Fundo (Back)</option>
                  <option value="rim_light">Luz de Contorno (Rim)</option>
                  <option value="accent">Destaque (Accent)</option>
                  <option value="ambient">Ambiente</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right Column: V-Ray Parameters */}
          <div className="space-y-6">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10 space-y-6">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-400" />
                Parâmetros V-Ray
              </h3>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs text-white/40 uppercase font-semibold">Tipo de Luz</label>
                  <select
                    value={editedLight.type}
                    onChange={(e) => setEditedLight({ ...editedLight, type: e.target.value as LightPointType })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="rectangle">Rectangle Light</option>
                    <option value="sphere">Sphere Light</option>
                    <option value="spot">Spot Light</option>
                    <option value="ies">IES Light</option>
                    <option value="omni">Omni Light</option>
                    <option value="dome">Dome Light</option>
                    <option value="emissive">Emissive</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-white/40 uppercase font-semibold">Forma</label>
                  <select
                    value={editedLight.shape}
                    onChange={(e) => setEditedLight({ ...editedLight, shape: e.target.value as LightPointShape })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="rectangular">Retangular</option>
                    <option value="elliptical">Elíptica</option>
                    <option value="spherical">Esférica</option>
                    <option value="conical">Cônica</option>
                    <option value="mesh">Mesh</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-white/40 uppercase font-semibold">Intensidade (%)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editedLight.intensity_initial}
                      onChange={(e) => setEditedLight({ ...editedLight, intensity_initial: parseInt(e.target.value) })}
                      className="flex-1 accent-orange-500"
                    />
                    <span className="text-sm font-mono text-white w-8">{editedLight.intensity_initial}%</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-white/40 uppercase font-semibold flex items-center gap-1">
                    <Thermometer className="w-3 h-3" />
                    Temperatura (K)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="2700"
                      max="8000"
                      value={editedLight.temp_k_initial}
                      onChange={(e) => setEditedLight({ ...editedLight, temp_k_initial: parseInt(e.target.value) })}
                      className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-white/40 uppercase font-semibold">Decaimento</label>
                  <select
                    value={editedLight.decay}
                    onChange={(e) => setEditedLight({ ...editedLight, decay: e.target.value as LightDecay })}
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="inverse_square">Inverse Square</option>
                    <option value="linear">Linear</option>
                    <option value="none">None</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-white/40 uppercase font-semibold">Cor (HEX)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editedLight.color_hex}
                      onChange={(e) => setEditedLight({ ...editedLight, color_hex: e.target.value })}
                      className="w-8 h-8 rounded border-none bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={editedLight.color_hex}
                      onChange={(e) => setEditedLight({ ...editedLight, color_hex: e.target.value })}
                      className="flex-1 bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white text-sm font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <h4 className="text-xs font-bold text-white/60 uppercase tracking-widest">Influência e Visibilidade</h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'affect_specular', label: 'Afetar Especular' },
                    { key: 'affect_diffuse', label: 'Afetar Difusa' },
                    { key: 'affect_reflections', label: 'Afetar Reflexos' },
                    { key: 'visible_in_render', label: 'Visível no Render' },
                    { key: 'ray_traced_shadows', label: 'Sombras Ray-Traced' },
                    { key: 'bloom_glare', label: 'Bloom & Glare' },
                  ].map((toggle) => (
                    <button
                      key={toggle.key}
                      onClick={() => setEditedLight({ ...editedLight, [toggle.key]: !editedLight[toggle.key as keyof LightPoint] })}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        editedLight[toggle.key as keyof LightPoint]
                          ? 'bg-orange-500/10 border-orange-500/50 text-orange-400'
                          : 'bg-black/30 border-white/5 text-white/40'
                      }`}
                    >
                      <span className="text-xs font-medium">{toggle.label}</span>
                      {editedLight[toggle.key as keyof LightPoint] ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 bg-black/20 flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            <span className="font-medium">Excluir Ponto</span>
          </button>
          
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-white/60 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-8 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/20 transition-all active:scale-95"
            >
              <Save className="w-5 h-5" />
              Salvar Alterações
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
