
import React, { useState, useEffect, useRef } from 'react';
import { 
  Book, Plus, Download, Upload, Trash2, ArrowLeft, Settings, Save, Share2, FileJson, FileText, Info, Server, Key, RotateCcw
} from 'lucide-react';
import { Button, LoadingOverlay, Modal } from './components/Shared';
import { Stage1Architecture } from './components/Stage1Architecture';
import { Stage2Planning } from './components/Stage2Planning';
import { Stage3Writing } from './components/Stage3Writing';
import { Project, LLMConfig, LLMProvider } from './types';

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try { 
      const saved = localStorage.getItem("novel_v46_projects");
      return saved ? JSON.parse(saved) : []; 
    } catch { return []; }
  });
  
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // Settings State
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({ provider: 'gemini', apiKey: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectsRef = useRef(projects);
  const currentProject = projects.find(p => p.id === currentId);

  useEffect(() => { projectsRef.current = projects; }, [projects]);

  // Load Settings on Mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("llm_settings");
      if (stored) {
        setLlmConfig(JSON.parse(stored));
      } else {
        // Migration from legacy v46 key
        const legacy = localStorage.getItem("gemini_api_key");
        if (legacy) setLlmConfig({ provider: 'gemini', apiKey: legacy });
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const saveToStorage = () => {
      localStorage.setItem("novel_v46_projects", JSON.stringify(projectsRef.current));
      setLastSaved(new Date());
    };
    const intervalId = setInterval(saveToStorage, 2 * 60 * 1000);
    const handleBeforeUnload = () => saveToStorage();
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') saveToStorage();
    });
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const updateProject = (newProj: Project) => {
    setProjects(prev => prev.map(p => p.id === newProj.id ? { ...newProj, lastModified: Date.now() } : p));
  };

  const persistProjectsImmediately = (newProjects: Project[]) => {
      setProjects(newProjects);
      projectsRef.current = newProjects;
      localStorage.setItem("novel_v46_projects", JSON.stringify(newProjects));
      setLastSaved(new Date());
  };

  const createProject = () => {
    const newProj: Project = { 
        id: Date.now().toString(), 
        title: "新书", 
        lastModified: Date.now(), 
        idea: "", 
        currentStep: 1, 
        plotProgress: 0,
        architecture: {}, 
        characterList: [], 
        chapters: [], 
        content: {}, 
        settings: { styles: [], tones: [] } 
    };
    persistProjectsImmediately([...projects, newProj]);
    setCurrentId(newProj.id);
    setActiveStep(1);
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    e.preventDefault();
    
    if(window.confirm('确定要删除这本书吗？(此操作无法撤销)')) {
        setProjects(prev => {
            const newProjects = prev.filter(x => x.id !== id);
            // Sync storage inside the callback to ensure consistency with state update
            projectsRef.current = newProjects;
            localStorage.setItem("novel_v46_projects", JSON.stringify(newProjects));
            setLastSaved(new Date());
            return newProjects;
        });
    }
  };

  const importProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; 
    if(!f) return; 
    const r = new FileReader(); 
    r.onload = ev => {
        try {
            const p = JSON.parse(ev.target?.result as string);
            p.id = Date.now().toString(); 
            if (p.plotProgress === undefined) p.plotProgress = 0;
            if (p.characterList) {
                p.characterList = p.characterList.map((c: any) => ({
                    ...c,
                    plotFunction: c.plotFunction || ""
                }));
            }
            persistProjectsImmediately([...projects, p]);
            alert("导入成功！");
        } catch(err) {
            alert("文件格式错误，请导入有效的 JSON 项目文件。");
        }
    }; 
    r.readAsText(f); 
    e.target.value = '';
  };

  const downloadFile = (type: 'json' | 'txt' | 'word') => {
    if (!currentProject) return;
    let content = "", mime = "", filename = `${currentProject.title}.${type}`;
    if (type === 'json') { 
        content = JSON.stringify(currentProject, null, 2); mime = 'application/json'; 
    } else if (type === 'txt') {
        content = `《${currentProject.title}》\n简介：${currentProject.architecture.mainPlot}\n` + 
                  currentProject.chapters.map((ch,i)=>`\n第${i+1}章 ${ch.title}\n${currentProject.content?.[ch.id]||""}`).join("\n");
        mime = 'text/plain;charset=utf-8';
    } else {
        content = `<html><head><meta charset='utf-8'></head><body><h1>${currentProject.title}</h1>` + 
                  currentProject.chapters.map(ch=>`<h2>${ch.title}</h2><p>${(currentProject.content?.[ch.id]||"").replace(/\n/g,"<br/>")}</p>`).join("") + 
                  "</body></html>";
        mime = 'application/msword;charset=utf-8'; filename=`${currentProject.title}.doc`;
    }
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setShowShareModal(false);
  };

  const saveSettings = () => {
      localStorage.setItem("llm_settings", JSON.stringify(llmConfig));
      // Also update legacy key if using gemini for backward compat
      if (llmConfig.provider === 'gemini') {
          localStorage.setItem("gemini_api_key", llmConfig.apiKey);
      } else {
          // If switching away from Gemini, we should ensure the old key doesn't interfere
          localStorage.removeItem("gemini_api_key");
      }
      setShowSettingsModal(false);
      alert("设置已保存并生效。");
  };

  const resetSettings = () => {
    if (window.confirm("确定要重置所有 AI 设置吗？这会立即清除当前的 API Key 和 Provider 配置，并将状态恢复为初始 Gemini 模式。")) {
      localStorage.removeItem("llm_settings");
      localStorage.removeItem("gemini_api_key");
      const defaultConfig: LLMConfig = { provider: 'gemini', apiKey: '', baseUrl: '' };
      setLlmConfig(defaultConfig);
      alert("AI 设置已成功重置为默认。");
    }
  };

  const renderDashboard = () => (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans flex flex-col">
      <div className="max-w-6xl mx-auto w-full flex-1">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Book className="text-indigo-600"/> <span className="hidden md:inline">Novel Pipeline Studio</span> <span className="text-sm bg-indigo-100 text-indigo-700 px-2 rounded">v47</span></h1>
          <Button variant="ghost" size="sm" onClick={() => setShowSettingsModal(true)} title="设置 AI 模型与 Key"><Settings size={18}/></Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div onClick={createProject} className="bg-white border-2 border-dashed border-indigo-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-indigo-50 cursor-pointer h-40 transition-colors group">
            <Plus size={32} className="text-indigo-400 group-hover:text-indigo-600 transition-colors"/><span className="font-bold text-slate-600 text-sm">新建小说项目</span>
          </div>
          <div onClick={() => fileInputRef.current?.click()} className="bg-white border-2 border-dashed border-emerald-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 cursor-pointer h-40 transition-colors group">
            <Upload size={32} className="text-emerald-400 group-hover:text-emerald-600 transition-colors"/><span className="font-bold text-slate-600 text-sm">导入工程文件 (.json)</span>
            <p className="text-[10px] text-slate-400 text-center">读取他人分享或备份的项目</p>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={importProject}/>
          </div>
          {projects.map(p => (
            <div key={p.id} onClick={() => { setCurrentId(p.id); setActiveStep(p.currentStep || 1); }} className="bg-white border rounded-xl p-4 shadow-sm relative h-40 flex flex-col hover:shadow-md transition-shadow cursor-pointer group">
              <h3 className="font-bold text-slate-800 line-clamp-1">{p.title}</h3>
              <p className="text-xs text-slate-500 line-clamp-3 mt-1 flex-1">{p.idea || "暂无简介"}</p>
              <div className="flex justify-between items-center mt-2 border-t pt-2">
                  <span className="text-[10px] text-slate-400">{new Date(p.lastModified).toLocaleDateString()}</span>
                  <button 
                    onClick={(e) => deleteProject(p.id, e)} 
                    className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded transition-all z-20 relative cursor-pointer" 
                    title="删除项目"
                  >
                    <Trash2 size={16}/>
                  </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <footer className="mt-12 py-6 text-center text-slate-400 text-sm border-t border-slate-200 border-dashed">
          <p className="flex items-center justify-center gap-1">软件来自小红书创作者：<span className="font-bold text-indigo-500 hover:text-indigo-600 transition-colors cursor-default">认真的酸奶冻</span></p>
          <p className="text-xs mt-1 font-mono text-slate-300 select-all">小红书号：5387071898</p>
      </footer>
    </div>
  );

  const renderEditor = () => (
    <div className="min-h-screen bg-[#F8F9FC] text-slate-900 font-sans flex flex-col">
      {loading && <LoadingOverlay msg={loading} provider={llmConfig.provider} />}
      
      <header className="h-14 bg-white border-b flex items-center px-4 sticky top-0 z-40 shadow-sm justify-between">
        <div className="flex items-center gap-2">
            <button onClick={() => setCurrentId(null)} className="p-1 rounded hover:bg-slate-100" title="返回首页"><ArrowLeft size={20}/></button>
            <h1 className="font-bold text-base truncate max-w-[120px] md:max-w-xs">{currentProject!.title}</h1>
            {lastSaved && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1 ml-2 animate-in fade-in hidden md:flex">
                <Save size={10}/> 已保存 {lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-0.5 mr-2">
              {[1,2,3].map(s => (
                  <button key={s} onClick={()=>{if(currentProject!.currentStep>=s) setActiveStep(s)}} 
                    className={`px-3 py-1 text-xs rounded-md transition-all ${activeStep===s ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}>
                    {s===1?'架构':s===2?'编排':'写作'}
                  </button>
              ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowSettingsModal(true)} title="设置 AI 模型与 Key" className="mr-1"><Settings size={18}/></Button>
          <Button size="sm" variant="secondary" onClick={() => setShowShareModal(true)} className="hidden md:flex"><Share2 size={16}/> 分享/导出</Button>
          <button onClick={() => setShowShareModal(true)} className="md:hidden p-2 hover:bg-slate-100 rounded"><Share2 size={18}/></button>
        </div>
      </header>

      <main className="flex-1 p-2 md:p-6 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col">
        {activeStep === 1 && <Stage1Architecture project={currentProject!} updateProject={updateProject} setLoading={setLoading} setActiveStep={setActiveStep} />}
        {activeStep === 2 && <Stage2Planning project={currentProject!} updateProject={updateProject} setLoading={setLoading} setActiveStep={setActiveStep} />}
        {activeStep === 3 && <Stage3Writing project={currentProject!} updateProject={updateProject} setLoading={setLoading} activeIdx={activeIdx} setActiveIdx={setActiveIdx} />}
      </main>

      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="分享与导出">
        <div className="space-y-6">
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex gap-4">
                <div className="bg-white p-3 rounded-full h-12 w-12 flex items-center justify-center text-indigo-600 shadow-sm shrink-0"><FileJson size={24}/></div>
                <div>
                    <h3 className="font-bold text-indigo-900">工程文件包 (Project JSON)</h3>
                    <p className="text-sm text-indigo-700 mb-3">包含完整的人物、大纲、设置和章节内容。<br/><span className="opacity-75 text-xs">适用场景：分享给朋友导入、备份数据、迁移设备。</span></p>
                    <Button onClick={() => downloadFile('json')} variant="primary" size="sm"><Download size={16}/> 导出工程文件 (.json)</Button>
                </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex gap-4">
                <div className="bg-white p-3 rounded-full h-12 w-12 flex items-center justify-center text-slate-600 shadow-sm shrink-0"><FileText size={24}/></div>
                <div>
                    <h3 className="font-bold text-slate-800">阅读稿件 (Word/Txt)</h3>
                    <p className="text-sm text-slate-600 mb-3">仅包含正文和基本信息，适合阅读或投稿。</p>
                    <div className="flex gap-2">
                        <Button onClick={() => downloadFile('word')} variant="secondary" size="sm"><Download size={16}/> 导出 Word</Button>
                        <Button onClick={() => downloadFile('txt')} variant="secondary" size="sm"><Download size={16}/> 导出 TXT</Button>
                    </div>
                </div>
            </div>
            <div className="flex justify-end pt-2"><Button variant="ghost" onClick={() => setShowShareModal(false)}>关闭</Button></div>
        </div>
      </Modal>
    </div>
  );

  return (
    <>
      {(!currentId || !currentProject) ? renderDashboard() : renderEditor()}

      {/* Single Source of Truth for Settings Modal */}
      <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="全局设置 (AI Models)">
          <div className="p-4 space-y-6">
             {/* Provider Selection */}
             <div className="space-y-2">
                 <div className="flex justify-between items-center mb-1">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Server size={16}/> 选择大模型厂商</label>
                    <button 
                      onClick={resetSettings} 
                      className="text-[10px] text-rose-500 hover:text-rose-700 flex items-center gap-1 font-bold border border-rose-100 px-2 py-1 rounded-md hover:bg-rose-50 transition-all shadow-sm active:scale-95"
                      title="清除所有配置并重置为 Gemini 默认状态"
                    >
                        <RotateCcw size={10}/> 一键重置 API 设置
                    </button>
                 </div>
                 <div className="grid grid-cols-2 gap-2">
                     {(['gemini', 'deepseek', 'qwen', 'openai'] as LLMProvider[]).map(p => (
                         <button 
                            key={p} 
                            onClick={() => setLlmConfig({...llmConfig, provider: p})}
                            className={`px-3 py-2.5 rounded-lg border text-sm font-bold capitalize transition-all ${llmConfig.provider === p ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                         >
                             {p === 'gemini' ? 'Google Gemini' : p === 'deepseek' ? 'DeepSeek (深度求索)' : p === 'qwen' ? 'Aliyun Qwen (通义)' : 'OpenAI / Custom'}
                         </button>
                     ))}
                 </div>
             </div>

             {/* API Key Input */}
             <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-2"><Key size={16}/> API Key</label>
                <div className="relative group">
                    <input 
                      type="password" 
                      className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all pr-10"
                      placeholder={`粘贴 ${llmConfig.provider.toUpperCase()} API Key...`}
                      value={llmConfig.apiKey}
                      onChange={(e) => setLlmConfig({...llmConfig, apiKey: e.target.value})}
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300">
                        <Key size={14}/>
                    </div>
                </div>
                <p className="text-xs text-slate-400 pl-1">
                    {llmConfig.provider === 'gemini' && "Google AI Studio 获取 (以 AIza 开头)"}
                    {llmConfig.provider === 'deepseek' && "DeepSeek 开放平台获取 (以 sk- 开头)"}
                    {llmConfig.provider === 'qwen' && "阿里云百炼控制台获取 (以 sk- 开头)"}
                    {llmConfig.provider === 'openai' && "OpenAI 或兼容服务商的 Key"}
                </p>
             </div>

             {/* Base URL (Optional) */}
             <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex justify-between">
                    <span className="flex items-center gap-2">Base URL (API 代理地址) <span className="text-[10px] bg-slate-100 text-slate-400 px-1 rounded font-normal uppercase">Proxy</span></span>
                </label>
                <input 
                  type="text" 
                  className="w-full border border-slate-200 p-2.5 rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400 outline-none transition-all placeholder:text-slate-300"
                  placeholder={
                      llmConfig.provider === 'gemini' ? "默认使用 SDK (留空)" :
                      llmConfig.provider === 'deepseek' ? "默认: https://api.deepseek.com" :
                      llmConfig.provider === 'qwen' ? "默认: https://dashscope.aliyuncs.com/compatible-mode/v1" :
                      "例如: https://api.openai-proxy.com/v1"
                  }
                  value={llmConfig.baseUrl || ""}
                  onChange={(e) => setLlmConfig({...llmConfig, baseUrl: e.target.value})}
                />
                <p className="text-[10px] text-slate-400 pl-1 leading-relaxed">
                    仅当您需要使用代理或中转服务时修改此项。使用 Google Gemini 时，除非您使用的是 OpenAI 兼容接口代理，否则请保持留空。
                </p>
             </div>

             <div className="flex justify-between items-center pt-4 border-t mt-2">
                <div className="flex flex-col">
                    <span className="text-xs text-slate-400 font-bold">App Version: v47.1</span>
                    <span className="text-[10px] text-slate-300 mt-0.5">Stability Enhanced Edition</span>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setShowSettingsModal(false)}>取消</Button>
                    <Button onClick={saveSettings} className="px-6">保存并生效</Button>
                </div>
             </div>
          </div>
      </Modal>
    </>
  );
}
