
import React, { ReactNode } from 'react';
import { RefreshCw, X } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'ghost' | 'gold' | 'dark' | 'thinking';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  onClick, disabled, children, variant = 'primary', size = 'md', className = '', title = '', ...props 
}) => {
  const baseStyle = "flex items-center justify-center gap-2 rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95";
  const sizeStyles = { sm: "px-2 py-1 text-xs", md: "px-3 py-2 text-sm", lg: "px-5 py-3 text-base" };
  const variants = {
    primary: "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",
    secondary: "bg-white text-slate-700 border border-slate-300 hover:bg-gray-50",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
    warning: "bg-amber-500 text-white hover:bg-amber-600 shadow-sm",
    ghost: "text-slate-500 hover:bg-slate-100",
    gold: "bg-yellow-500 text-white hover:bg-yellow-600 shadow-sm ring-1 ring-yellow-200",
    dark: "bg-slate-800 text-white hover:bg-slate-900 shadow-sm",
    thinking: "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled} 
      title={title} 
      className={`${baseStyle} ${sizeStyles[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

interface TagSelectorProps {
  options: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
  max?: number;
  label: string;
}

export const TagSelector: React.FC<TagSelectorProps> = ({ options, selected = [], onChange, max = 3, label }) => {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(x => x !== opt));
    } else {
      if (selected.length < max) onChange([...selected, opt]);
    }
  };
  return (
    <div className="mb-3">
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-bold text-slate-500 uppercase">{label}</label>
        <span className="text-[10px] text-slate-400">{selected.length}/{max}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} onClick={() => toggle(opt)}
            className={`px-2 py-1 rounded-xs text-xs border transition-all rounded-md ${selected.includes(opt) ? 'bg-indigo-100 border-indigo-300 text-indigo-700 font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-4 border-b bg-slate-50 shrink-0">
          <h3 className="font-bold text-lg text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 -mr-2 rounded-full hover:bg-slate-200"><X size={20} className="text-slate-400"/></button>
        </div>
        <div className="p-4 overflow-y-auto custom-scrollbar flex-1">{children}</div>
      </div>
    </div>
  );
};

export const LoadingOverlay: React.FC<{ msg: string; provider?: string }> = ({ msg, provider }) => {
  const getProviderDisplay = () => {
    switch(provider) {
      case 'deepseek': return 'DeepSeek R1/V3';
      case 'qwen': return 'Aliyun Qwen';
      case 'openai': return 'OpenAI GPT-4';
      default: return 'Gemini 2.5';
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-white/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in">
      <RefreshCw size={40} className="text-indigo-600 animate-spin mb-4"/>
      <h2 className="text-xl font-bold text-slate-800 px-4 text-center">{msg}</h2>
      <p className="text-slate-500 mt-2 text-sm">{getProviderDisplay()} is thinking deeply...</p>
    </div>
  );
};
