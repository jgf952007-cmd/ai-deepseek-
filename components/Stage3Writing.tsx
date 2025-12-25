
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Menu, X, CheckCircle, Feather, AlignLeft, BrainCircuit, History, Sparkles, Zap, BookOpen, Upload, FileText, Search, Loader2, UserCog, Wand2, Type } from 'lucide-react';
import { Button, Modal } from './Shared';
import { Project, PRESET_WRITERS, MimicrySettings } from '../types';
import { callGemini, GEMINI_MODELS } from '../services/gemini';

interface Props {
  project: Project;
  updateProject: (p: Project) => void;
  setLoading: (msg: string | null) => void;
  activeIdx: number;
  setActiveIdx: (idx: number) => void;
}

type GenerationMode = 'fast' | 'deep';

export const Stage3Writing: React.FC<Props> = ({ project, updateProject, setLoading, activeIdx, setActiveIdx }) => {
  const [showDrawer, setShowDrawer] = useState(false);
  const [mimicry, setMimicry] = useState<MimicrySettings>({ active: false, name: "鲁迅" });
  const [customWriter, setCustomWriter] = useState("");
  const [showMimicModal, setShowMimicModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [genMode, setGenMode] = useState<GenerationMode>('deep');
  
  // Style Learning State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnalyzingStyle, setIsAnalyzingStyle] = useState(false);
  const [analyzedResult, setAnalyzedResult] = useState<string>("");

  const activeCh = project.chapters?.[activeIdx];
  const content = project.content?.[activeCh?.id] || "";

  // 10-chapter logic for rolling summary
  const finishedChapters = Object.keys(project.content || {}).length;
  const isMilestone = (activeIdx + 1) % 10 === 0 && activeIdx > 0;

  // Word count logic
  const wordCount = useMemo(() => {
    if (!content) return 0;
    const cjkRegex = /[\u4e00-\u9fa5]/;
    if (cjkRegex.test(content)) {
        return content.replace(/\s/g, '').length;
    } else {
        return content.trim().split(/\s+/).filter(w => w.length > 0).length;
    }
  }, [content]);

  const runAI = async (msg: string, prompt: string, sys: string, isJson: boolean, useProModel: boolean = true) => {
    setLoading(msg);
    try {
      const model = useProModel ? GEMINI_MODELS.PRO : GEMINI_MODELS.FLASH;
      const finalSys = sys + "。请务必始终使用中文（简体）进行回复和创作。";
      return await callGemini(prompt, finalSys, isJson, model);
    } catch (e: any) {
      alert(e.message);
      return null;
    } finally {
        setLoading(null);
    }
  };

  const handleUpdateRollingSummary = async () => {
     const startIdx = Math.max(0, activeIdx - 9);
     const chaptersToSum = project.chapters.slice(startIdx, activeIdx + 1);
     const textBlock = chaptersToSum.map(c => `[Ch${project.chapters.indexOf(c)+1} ${c.title}]:\n${(project.content?.[c.id] || "").slice(0, 1000)}...`).join("\n\n");
     const currentSummary = project.rollingSummary || "故事开始...";

     const prompt = `【剧情记忆更新任务】
     当前【全局剧情记忆】："""${currentSummary}"""
     【新增剧情】："""${textBlock}"""
     请将新增剧情要点融合并追加到全局记忆中。要求：简洁陈述句，必须中文。`;

     const newSummary = await runAI("正在构建前情回顾...", prompt, "Memory Keeper", false, true);
     if (newSummary) {
         updateProject({ ...project, rollingSummary: newSummary });
         setShowSummaryModal(false);
     }
  };

  const handleStyleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const text = ev.target?.result as string;
        if (text) await analyzeStyle(text.slice(0, 15000));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const analyzeStyle = async (sampleText: string) => {
      setIsAnalyzingStyle(true);
      const prompt = `【文风基因拆解】样本："""${sampleText}""" \n 请提取该文本的遣词造句、节奏感、描写偏好等核心写作特征，生成一份指导AI仿写的指令。要求中文。`;
      try {
        const result = await callGemini(prompt, "风格分析师", false, GEMINI_MODELS.PRO);
        if (result) {
            setAnalyzedResult(result);
            setMimicry({ active: true, name: "样本分析仿写", customStylePrompt: result });
            alert("文风分析完成！");
        }
      } catch (e: any) {
        alert("分析失败：" + e.message);
      } finally {
        setIsAnalyzingStyle(false);
      }
  };

  const handleWrite = async (type: 'auto' | 'continue' = 'auto') => {
    if (!activeCh) return;
    
    // 强制读取当前的模式状态，确保切换生效
    const isDeepMode = genMode === 'deep';
    
    let prevContext = "（第一章）";
    if (activeIdx > 0) {
        const prevChId = project.chapters[activeIdx-1].id;
        const prevContent = project.content?.[prevChId] || "";
        if (prevContent.length > 0) prevContext = `...${prevContent.slice(-2000)}`; 
    }

    const rollingMemory = project.rollingSummary ? `【剧情回顾】："""${project.rollingSummary}"""` : "";
    const styles = project.settings?.styles?.join(" + ") || "常规";
    const tones = project.settings?.tones?.join(" + ") || "正常";
    
    let mimicInstruction = "";
    if (mimicry.active) {
        if (mimicry.customStylePrompt) {
            mimicInstruction = `【最高优先级：风格仿写】${mimicry.customStylePrompt}`;
        } else if (mimicry.name) {
            mimicInstruction = `【风格模仿】请完全模仿知名作家“${mimicry.name}”的笔触、叙事节奏和修辞风格。`;
        }
    } else {
        mimicInstruction = `【写作风格】遵循【${styles}】，体现【${tones}】。`;
    }

    const guidance = activeCh.writingGuidance ? `【写作建议】：${activeCh.writingGuidance}` : "";

    const basePrompt = `
    【撰写章节】${activeCh.title}
    ${rollingMemory}
    【细纲】：${activeCh.summary}
    ${guidance}
    【上文衔接】："""${prevContext}"""
    【要求】1. 字数2000字左右 2. 文风：${mimicInstruction} 3. 严禁总结性话语 4. 必须中文。
    ${type==='continue'?`【续写指令】紧接当前文本：${content.slice(-500)}，继续推进剧情。`:''}
    请开始：`;

    // 第一遍生成
    const phase1Label = isDeepMode ? "正在撰写初稿 (Phase 1/3)..." : "正在快速生成正文...";
    let currentText = await runAI(phase1Label, basePrompt, "Ghostwriter", false, isDeepMode);
    
    if (!currentText) return;

    // 快速模式直接结束
    if (!isDeepMode) {
        updateProject({ 
            ...project, 
            content: { 
                ...project.content, 
                [activeCh.id]: type === 'continue' ? content + "\n\n" + currentText : currentText 
            } 
        });
        return;
    }

    // 深度模式：第二遍润色
    const critiquePrompt = `【待优化稿】："""${currentText}"""
    【任务：去AI化深度润色】减少排比，修正生硬的转折，增加环境描写。必须中文。`;
    currentText = await runAI("正在深度润色 (Phase 2/3)...", critiquePrompt, "Pro Editor", false, true);
    if (!currentText) return;

    // 深度模式：第三遍终审
    const polishPrompt = `【润色稿】："""${currentText}"""
    【任务：逻辑校验与定稿】检查设定冲突，优化遣词，输出最终定稿。必须中文。`;
    currentText = await runAI("正在最终定稿 (Phase 3/3)...", polishPrompt, "Final Polisher", false, true);

    if (currentText) {
        updateProject({ 
            ...project, 
            content: { 
                ...project.content, 
                [activeCh.id]: type === 'continue' ? content + "\n\n" + currentText : currentText 
            } 
        });
        if (isMilestone) {
            if (confirm("已完成10章，是否同步剧情记忆？")) handleUpdateRollingSummary();
        }
    }
  };

  const handleApplyCustomWriter = () => {
    if(!customWriter.trim()) return;
    setMimicry({ active: true, name: customWriter.trim(), customStylePrompt: undefined });
    setCustomWriter("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:flex-row gap-4 max-w-7xl mx-auto w-full relative">
      
      {/* 拟态引擎模态框 */}
      <Modal isOpen={showMimicModal} onClose={() => setShowMimicModal(false)} title="拟态引擎：定义你的写作灵魂">
        <div className="space-y-6">
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-indigo-900 flex items-center gap-2"><Feather size={18}/> 1. 大师笔法复刻</h4>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="mimic-active-box" checked={mimicry.active} onChange={e => setMimicry({...mimicry, active: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded cursor-pointer"/>
                    <label htmlFor="mimic-active-box" className="font-bold text-sm text-indigo-900 cursor-pointer">启用拟态</label>
                  </div>
              </div>
              <div className={`flex flex-wrap gap-2 transition-opacity ${mimicry.active ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                 {PRESET_WRITERS.map(w => (
                    <button key={w} onClick={() => setMimicry({active: true, name: w, customStylePrompt: undefined})} 
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${(!mimicry.customStylePrompt && mimicry.name===w) ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white hover:bg-slate-50 border-slate-200'}`}>
                      {w}
                    </button>
                 ))}
              </div>
          </div>

          <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
              <h4 className="font-bold text-amber-900 flex items-center gap-2 mb-3"><Type size={18}/> 2. 自定义作家名字</h4>
              <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="输入任意作家名，如：莫言、余华、村上春树..." 
                    className="flex-1 border p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-200"
                    value={customWriter}
                    onChange={e => setCustomWriter(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleApplyCustomWriter()}
                  />
                  <Button onClick={handleApplyCustomWriter} size="sm">确定</Button>
              </div>
              <p className="text-[10px] text-amber-600 mt-2">AI 将根据其公开的作品特征自动模拟其行文风格。</p>
          </div>
          
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <h4 className="font-bold text-emerald-900 flex items-center gap-2 mb-3"><Upload size={18}/> 3. 文档样本学习</h4>
              <div onClick={() => fileInputRef.current?.click()} className="bg-white border-2 border-dashed border-emerald-300 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-emerald-50 transition-all group">
                {isAnalyzingStyle ? <Loader2 className="animate-spin text-emerald-500 mb-2" size={32}/> : <FileText size={32} className="text-emerald-400 group-hover:scale-110 mb-2"/>}
                <span className="font-bold text-emerald-800">上传样本文件 (.txt / .md)</span>
                <input type="file" ref={fileInputRef} className="hidden" accept=".txt,.md" onChange={handleStyleUpload}/>
              </div>
          </div>
          <div className="flex justify-end pt-2 border-t">
              <div className="mr-auto text-xs text-slate-400 flex items-center gap-2">
                  {mimicry.active && <span>当前生效：<strong className="text-indigo-600">{mimicry.name}</strong></span>}
              </div>
              <Button onClick={() => setShowMimicModal(false)}>完成配置</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showSummaryModal} onClose={() => setShowSummaryModal(false)} title="全局剧情记忆库">
         <div className="space-y-4">
            <textarea className="w-full h-64 p-4 border rounded-xl bg-slate-50 text-sm outline-none font-serif leading-relaxed" value={project.rollingSummary || ""} onChange={e => updateProject({...project, rollingSummary: e.target.value})} placeholder="暂无记忆..."/>
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowSummaryModal(false)}>取消</Button>
                <Button onClick={handleUpdateRollingSummary} disabled={finishedChapters < 1}><BrainCircuit size={16}/> 同步剧情</Button>
            </div>
         </div>
      </Modal>

      {/* 目录栏 */}
      <div className="hidden md:flex w-64 bg-white rounded-xl border border-slate-200 flex-col shrink-0 h-full overflow-hidden shadow-sm">
        <div className="p-4 border-b font-bold bg-slate-50 flex justify-between items-center text-slate-700">
            <span className="flex items-center gap-2 text-sm"><AlignLeft size={16}/> 章节列表</span>
            <button onClick={() => setShowSummaryModal(true)} className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg" title="剧情记忆"><History size={18}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {project.chapters.map((ch, i) => (
            <div key={ch.id} onClick={() => setActiveIdx(i)} 
              className={`p-3 rounded-lg text-sm cursor-pointer truncate flex justify-between items-center transition-all ${activeIdx===i ? 'bg-indigo-600 text-white font-bold shadow-md' : 'hover:bg-slate-50 text-slate-600'}`}>
              <span className="truncate">{i+1}. {ch.title}</span>
              {project.content?.[ch.id] && <CheckCircle size={14} className={activeIdx===i ? "text-white/80" : "text-emerald-500"}/>}
            </div>
          ))}
        </div>
      </div>

      {/* 主编辑器 */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col shadow-lg overflow-hidden h-full">
        <div className="flex p-3 border-b justify-between items-center bg-slate-50/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
             <h2 className="font-bold text-slate-800 truncate max-w-[200px]">{activeCh.title}</h2>
             <span className="text-[10px] text-slate-400 bg-white border px-2 py-1 rounded-full shadow-sm">{wordCount} 字</span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-200/50 p-1 rounded-xl items-center mr-2 border border-slate-200">
                <button 
                  onClick={() => setGenMode('fast')} 
                  className={`px-4 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1 ${genMode === 'fast' ? 'bg-white shadow-md text-emerald-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <Zap size={12}/> 快速
                </button>
                <button 
                  onClick={() => setGenMode('deep')} 
                  className={`px-4 py-1.5 text-xs rounded-lg transition-all flex items-center gap-1 ${genMode === 'deep' ? 'bg-white shadow-md text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    <BrainCircuit size={12}/> 深度
                </button>
            </div>

            <Button size="sm" variant="secondary" onClick={() => setShowMimicModal(true)} className="hidden md:flex">
                <UserCog size={16}/> 拟态
            </Button>
            
            <Button size="sm" variant={genMode === 'deep' ? "gold" : "primary"} onClick={() => handleWrite('auto')} className="font-bold shadow-md">
                <Sparkles size={16}/> {genMode === 'deep' ? '深度生成' : '快速生成'}
            </Button>
            
            <Button size="sm" variant="secondary" onClick={() => handleWrite('continue')} className="hidden md:flex">续写</Button>
          </div>
        </div>

        <textarea 
          className="flex-1 p-6 md:p-12 resize-none outline-none font-serif text-xl leading-loose text-slate-800 bg-transparent custom-scrollbar selection:bg-indigo-100"
          value={content}
          onChange={e => updateProject({ ...project, content: { ...project.content, [activeCh.id]: e.target.value } })}
          placeholder="在此创作正文..."
        />
      </div>

      <div className="md:hidden fixed bottom-6 right-6 flex flex-col gap-2 z-50">
          <button onClick={() => setShowMimicModal(true)} className="p-4 bg-white border shadow-xl rounded-full text-indigo-600"><UserCog size={24}/></button>
          <button onClick={() => handleWrite('auto')} className="p-4 bg-indigo-600 shadow-xl rounded-full text-white"><Wand2 size={24}/></button>
      </div>
    </div>
  );
};
