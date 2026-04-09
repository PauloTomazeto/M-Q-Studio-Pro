import React from 'react';
import { useStudioStore } from '../../store/studioStore';
import TypeBadge from './TypeBadge';
import LightingParametersPanel from './LightingParametersPanel';
import AtmosphereParametersPanel from './AtmosphereParametersPanel';
import BloomParametersPanel from './BloomParametersPanel';
import ColorGradingParametersPanel from './ColorGradingParametersPanel';
import { ENVIRONMENT_LABELS, EnvironmentType, HUMANIZATION_STYLE_LABELS, HumanizationStyle, TopDownAngle } from '../../types/studio';
import { Sun, Thermometer, Palette, Camera, Sparkles, Wand2, MapPin, Compass, Info, Lock, Layout, Smartphone, Home } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STYLE_OPTIONS = [
  { id: 'contemp', label: 'Contemporâneo', description: 'Linhas limpas, vidro e materiais mistos' },
  { id: 'minimalista', label: 'Minimalista', description: 'Volumes puros, sem ornamentos' },
  { id: 'colonial', label: 'Colonial Brasileiro', description: 'Tradicional, madeira e telhas de barro' },
  { id: 'industrial', label: 'Industrial', description: 'Tijolo, concreto e metal exposto' },
  { id: 'brutalista', label: 'Brutalista', description: 'Concreto aparente e volumes monumentais' },
];

const CAMERA_OPTIONS = [
  { id: 'canon_r5', label: 'Canon EOS R5', brand: 'Canon', lens: 'RF 35mm f/1.4L', type: 'Professional' },
  { id: 'nikon_z9', label: 'Nikon Z9', brand: 'Nikon', lens: 'NIKKOR Z 35mm f/1.8 S', type: 'Professional' },
  { id: 'sony_a7rv', label: 'Sony Alpha 7R V', brand: 'Sony', lens: 'FE 35mm f/1.4 GM', type: 'Professional' },
  { id: 'panasonic_s1h', label: 'Panasonic Lumix S1H', brand: 'Panasonic', lens: 'Leica DG Summilux 35mm', type: 'Professional' },
  { id: 'iphone_15_pro', label: 'iPhone 15 Pro Max', brand: 'Apple', lens: 'Main 24mm', type: 'Smartphone' },
  { id: 'iphone_14_pro', label: 'iPhone 14 Pro', brand: 'Apple', lens: 'Main 24mm', type: 'Smartphone' },
  { id: 'iphone_13_pro', label: 'iPhone 13 Pro', brand: 'Apple', lens: 'Main 26mm', type: 'Smartphone' },
];

const ConfigStep: React.FC = () => {
  const { 
    scanResult, 
    configParams, 
    updateConfig, 
    setStep, 
    typeMetadata, 
    base64Image,
    isModeLocked,
    availableModes
  } = useStudioStore();

  const handleParamChange = (name: string, value: any) => {
    updateConfig({ [name]: value });
  };

  const isBlocksAvailable = availableModes.includes('blocks');

  const sections = [
    {
      id: 'effects',
      title: 'Efeitos Especiais',
      icon: Sparkles,
      params: [
        { id: 'chromaticAberration', label: 'Aberração Cromática (%)', min: 0, max: 100, step: 1 },
        { id: 'vignette', label: 'Vignette (%)', min: 0, max: 100, step: 1 },
        { id: 'grain', label: 'Grain (%)', min: 0, max: 100, step: 1 },
      ]
    }
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Configuração de Parâmetros</h2>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-neutral-500 dark:text-neutral-400">
              Ajuste os detalhes técnicos para refinar a geração do prompt.
            </p>
            <div className="hidden sm:block w-px h-4 bg-neutral-200 dark:bg-neutral-800" />
            <TypeBadge />
          </div>
        </div>
        <button
          onClick={() => setStep('result')}
          className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-primary/20 active:scale-95 flex items-center gap-2"
        >
          <Wand2 size={18} />
          Gerar Prompts
        </button>
      </div>

      {/* New Lighting Parameters Panel */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm sticky top-8">
            <div className="aspect-square rounded-2xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 relative group">
              {base64Image ? (
                <>
                  <img 
                    src={base64Image} 
                    alt="Preview" 
                    className="w-full h-full object-cover transition-all duration-300"
                    style={{
                      filter: `
                        brightness(${100 + configParams.brightness + (configParams.bloom_intensity / 4) + (configParams.highlights_white_point / 5) - (configParams.shadows_black_point / 10)}%) 
                        contrast(${100 + (configParams.contrast || 0) + (configParams.bloom_intensity / 8)}%)
                        saturate(${100 + (configParams.saturation || 0) + (configParams.vibrance / 2)}%)
                        hue-rotate(${configParams.hue_shift || 0}deg)
                        blur(${configParams.fog_density / 50}px)
                      `
                    }}
                  />
                  {/* Fog Simulation Overlay */}
                  <div 
                    className="absolute inset-0 pointer-events-none transition-all duration-500"
                    style={{ 
                      backgroundColor: configParams.fog_color,
                      opacity: configParams.fog_density / 200,
                      mixBlendMode: configParams.atmosphere_type === 'night' ? 'multiply' : 'screen'
                    }}
                  />
                  {/* Bloom Simulation Overlay */}
                  {configParams.bloom_enabled && configParams.bloom_intensity > 0 && (
                    <div 
                      className="absolute inset-0 pointer-events-none transition-all duration-500"
                      style={{ 
                        backgroundColor: configParams.bloom_color_tint,
                        opacity: (configParams.bloom_intensity / 100) * 0.3,
                        mixBlendMode: 'screen',
                        filter: `blur(${configParams.bloom_radius * 2}px)`
                      }}
                    />
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-neutral-400">
                  <Camera size={48} />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                <p className="text-white text-xs font-medium">Visualização em Tempo Real</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-xs font-medium text-neutral-500">
                <span>Brilho Atual</span>
                <span className="font-mono text-primary">{100 + configParams.brightness}%</span>
              </div>
              <div className="w-full h-1 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-300" 
                  style={{ width: `${((100 + configParams.brightness) / 200) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <LightingParametersPanel />
          <AtmosphereParametersPanel />
          <BloomParametersPanel />
          <ColorGradingParametersPanel />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {sections.map((section) => (
          <div key={section.id} className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-primary">
              <section.icon size={24} />
              <h3 className="text-xl font-bold">{section.title}</h3>
            </div>
            
            <div className="space-y-6">
              {section.params.map((param) => (
                <div key={param.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{param.label}</label>
                    <span className="text-sm font-bold font-mono bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded">
                      {configParams[param.id]}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={param.min}
                    max={param.max}
                    step={param.step}
                    value={configParams[param.id]}
                    onChange={(e) => handleParamChange(param.id, Number(e.target.value))}
                    className="w-full h-2 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {typeMetadata?.imageType === 'PLANTA_BAIXA' && (
          <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6 md:col-span-2">
            <div className="flex items-center gap-3 text-primary">
              <Compass size={24} />
              <h3 className="text-xl font-bold">Configuração Planta Baixa</h3>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <label className="text-sm font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                  <Camera size={16} />
                  Ângulo de Visão (Drone)
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {[90, 80, 60, 45].map((angle) => (
                    <button
                      key={angle}
                      onClick={() => handleParamChange('topDownAngle', angle)}
                      className={`p-4 rounded-2xl border-2 transition-all text-left ${
                        configParams.topDownAngle === angle
                          ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                          : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700"
                      }`}
                    >
                      <p className="font-bold">{angle}°</p>
                      <p className="text-xs text-neutral-500 mt-1">
                        {angle === 90 ? 'Ortogonal (Top-down)' : 
                         angle === 80 ? 'Drone Quase Vertical' :
                         angle === 60 ? 'Perspectiva Elevada' : 'Aérea Lateral'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <label className="text-sm font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                    <Layout size={16} />
                    Estilo de Humanização
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {(Object.keys(HUMANIZATION_STYLE_LABELS) as HumanizationStyle[]).map((style) => (
                      <button
                        key={style}
                        onClick={() => handleParamChange('humanizationStyle', style)}
                        className={`p-3 px-4 rounded-xl border-2 transition-all text-left flex items-center justify-between ${
                          configParams.humanizationStyle === style
                            ? "border-primary bg-primary/5"
                            : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700"
                        }`}
                      >
                        <span className={configParams.humanizationStyle === style ? "font-bold text-primary" : "font-medium"}>
                          {HUMANIZATION_STYLE_LABELS[style]}
                        </span>
                        {configParams.humanizationStyle === style && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-sm font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                    <MapPin size={16} />
                    Tipo de Ambiente Externo
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {(Object.keys(ENVIRONMENT_LABELS) as EnvironmentType[]).map((env) => (
                      <button
                        key={env}
                        onClick={() => handleParamChange('environmentType', env)}
                        className={`p-3 px-4 rounded-xl border-2 transition-all text-left flex items-center justify-between ${
                          configParams.environmentType === env
                            ? "border-primary bg-primary/5"
                            : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700"
                        }`}
                      >
                        <span className={configParams.environmentType === env ? "font-bold text-primary" : "font-medium"}>
                          {ENVIRONMENT_LABELS[env]}
                        </span>
                        {configParams.environmentType === env && (
                          <div className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <Home size={24} />
            <h3 className="text-xl font-bold">Estilo Arquitetônico</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-3">
            {STYLE_OPTIONS.map((style) => (
              <button
                key={style.id}
                onClick={() => handleParamChange('styleCode', style.id)}
                className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center justify-between ${
                  configParams.styleCode === style.id
                    ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                    : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700"
                }`}
              >
                <div>
                  <p className="font-bold">{style.label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{style.description}</p>
                </div>
                {configParams.styleCode === style.id && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
          <div className="flex items-center gap-3 text-primary">
            <Camera size={24} />
            <h3 className="text-xl font-bold">Seleção de Câmera</h3>
          </div>
          
          <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
            {CAMERA_OPTIONS.map((cam) => (
              <button
                key={cam.id}
                onClick={() => handleParamChange('cameraSelection', cam.id)}
                className={`p-4 rounded-2xl border-2 transition-all text-left flex items-center gap-4 ${
                  configParams.cameraSelection === cam.id
                    ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                    : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  cam.type === 'Smartphone' ? 'bg-blue-500/10 text-blue-500' : 'bg-primary/10 text-primary'
                }`}>
                  {cam.type === 'Smartphone' ? <Smartphone size={20} /> : <Camera size={20} />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{cam.label}</p>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">{cam.brand}</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">{cam.lens}</p>
                </div>
                {configParams.cameraSelection === cam.id && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-secondary">
              <Camera size={24} />
              <h3 className="text-xl font-bold">Modo de Saída</h3>
            </div>
            {isModeLocked && (
              <div className="flex items-center gap-2 text-xs font-bold text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full">
                <Lock size={12} />
                BLOQUEADO
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <button
              disabled={isModeLocked}
              onClick={() => handleParamChange('promptMode', 'single')}
              className={`p-4 rounded-2xl border-2 transition-all text-left relative group ${
                configParams.promptMode === 'single'
                  ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                  : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700"
              } ${isModeLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex justify-between items-start">
                <p className="font-bold">Single</p>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Info size={14} className="text-neutral-400" />
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-1">Prompt único e coeso</p>
              <div className="mt-2 inline-block px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                Midjourney / DALL-E
              </div>
              {configParams.promptMode === 'single' && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
              )}
            </button>

            <button
              disabled={isModeLocked || !isBlocksAvailable}
              onClick={() => handleParamChange('promptMode', 'blocks')}
              className={`p-4 rounded-2xl border-2 transition-all text-left relative group ${
                configParams.promptMode === 'blocks'
                  ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                  : "border-neutral-100 dark:border-neutral-800 hover:border-neutral-200 dark:hover:border-neutral-700"
              } ${isModeLocked || !isBlocksAvailable ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <p className="font-bold">Blocks</p>
                  {!isBlocksAvailable && (
                    <span className="text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-black uppercase">PRO</span>
                  )}
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Info size={14} className="text-neutral-400" />
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-1">Dividido por temas</p>
              <div className="mt-2 inline-block px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 rounded text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                Stable Diffusion
              </div>
              {configParams.promptMode === 'blocks' && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
              )}
            </button>
          </div>
          
          {!isBlocksAvailable && (
            <p className="text-xs text-center text-neutral-500 italic">
              Faça upgrade para o plano Pro para liberar o modo Blocks.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConfigStep;
