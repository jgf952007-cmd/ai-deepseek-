
import React, { useState, useRef } from 'react';
import { Sparkles, Shuffle, Globe, Edit3, Users, UserCog, Plus, Image as ImageIcon, Wand2, Dice5, Trash2, ChevronRight, Layers, FileText, Target, Flame, Upload, Search, BookOpen, ArrowRight, RefreshCw, GitBranch, Thermometer, ShieldAlert, Map, Zap, Landmark, Compass, Gift, ShieldCheck, AlertTriangle, CheckCircle2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button, Modal, TagSelector } from './Shared';
import { Project, GENRES, SideQuest, WorldBible } from '../types';
import { callGemini, callImageGen, safeJsonParse, GEMINI_MODELS } from '../services/gemini';

interface Props {
  project: Project;
  updateProject: (p: Project) => void;
  setLoading: (msg: string | null) => void;
  setActiveStep: (step: number) => void;
}

const cleanText = (val: any) => {
  if (val === null || val === undefined) return "";
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.content || val.text || val.summary || JSON.stringify(val);
  }
  return String(val);
};

const BIBLE_LABELS: Record<string, string> = {
  time: "时间背景",
  location: "地理环境",
  rules: "核心法则",
  socialStructure: "社会体系",
  powerSystem: "力量体系",
  mapStructure: "地图结构"
};

const ALL_BIBLE_KEYS: (keyof WorldBible)[] = ['time', 'location', 'rules', 'socialStructure', 'powerSystem', 'mapStructure'];

export const Stage1Architecture: React.FC<Props> = ({ project, updateProject, setLoading, setActiveStep }) => {
  const [showBlender, setShowBlender] = useState(false);
  const [blenderTags, setBlenderTags] = useState<string[]>([]);
  const [blenderInput, setBlenderInput] = useState("");
  const [editWorldModal, setEditWorldModal] = useState(false);
  const [deduceCount, setDeduceCount] = useState<number>(3); 

  // Deconstruction States
  const [showDeconstruct, setShowDeconstruct] = useState(false);
  const [deconstructMode, setDeconstructMode] = useState<'search' | 'file'>('search');
  const [bookSearchName, setBookSearchName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [analysisResult, setAnalysisResult] = useState("");
  const [adaptationTags, setAdaptationTags] = useState<string[]>([]); 
  const [adaptationInput, setAdaptationInput] = useState(""); 
  const [adaptedResult, setAdaptedResult] = useState(""); 
  const [adherenceLevel, setAdherenceLevel] = useState(80); 
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Consistency Check State
  const [consistencyReport, setConsistencyReport] = useState<any>(null);
  const [showConsistencyModal, setShowConsistencyModal] = useState(false);

  const hasContent = !!(project.architecture?.mainPlot || project.characterList?.length > 0);

  const runAI = async (msg: string, prompt: string, sys: string, isJson: boolean, useProModel: boolean = true, temp: number = 0.85) => {
    setLoading(msg);
    try {
      const model = useProModel ? GEMINI_MODELS.PRO : GEMINI_MODELS.FLASH;
      // Force Chinese output in system instruction if not already explicitly stated
      const finalSys = sys + "。请务必始终使用中文（简体）进行回复和生成内容。";
      return await callGemini(prompt, finalSys, isJson, model, temp);
    } catch (e: any) {
      alert(e.message);
      return null;
    } finally {
      setLoading(null);
    }
  };

  const generateArchitecture = async () => {
    if (!project.idea) return alert("请先输入核心灵感");
    const isCultivation = project.idea.includes("修仙") || project.idea.includes("玄幻") || project.idea.includes("高武") || project.idea.includes("仙侠");
    
    const prompt = `基于创意：${project.idea}。\n请构建完整的小说架构。\n
    【核心构架原则：严格的地图与战力晋升逻辑】
    1. **强制滞留机制**：从小地图到大地图的晋升过程。
    2. **环境限制**：区域实力的分层（新手村、进阶地、核心界）。
    3. **成长与探索**：时间线清晰体现。
    
    【强制要求】必须使用中文生成。

    返回 JSON 格式: { "title": "书名", "worldBible": { "time": "时间背景", "location": "地理环境", "rules": "核心法则", "socialStructure": "社会/政治/经济体系设定", "powerSystem": "境界/力量体系设定", "mapStructure": "地图板块划分" }, "mainPlot": "主线梗概 (请明确指出 【副本：XXX】、<<宗门：XXX>>、[地图：XXX])", "characterList": [ { "name": "主角名", "role": "主角", "plotFunction": "剧情功能", "traits": "", "bio": "" } ], "timeline": "大致的时间跨度描述" }`;

    const text = await runAI("构建深度世界观与架构 (Gemini 3.0)...", prompt, "Architect", true, true);
    if (!text) return;
    const data = safeJsonParse(text);
    if (data) {
      updateProject({
        ...project,
        title: cleanText(data.title || "未命名"),
        architecture: { 
          ...project.architecture,
          worldBible: { 
            time: cleanText(data.worldBible?.time), 
            location: cleanText(data.worldBible?.location), 
            rules: cleanText(data.worldBible?.rules),
            socialStructure: cleanText(data.worldBible?.socialStructure),
            powerSystem: cleanText(data.worldBible?.powerSystem),
            mapStructure: cleanText(data.worldBible?.mapStructure)
          }, 
          mainPlot: cleanText(data.mainPlot), 
          timeline: cleanText(data.timeline) 
        },
        characterList: (data.characterList || []).map((c: any, i: number) => ({ 
          ...c, 
          id: Date.now()+i, 
          imageUrl: "",
          name: cleanText(c.name),
          role: cleanText(c.role),
          plotFunction: cleanText(c.plotFunction),
          traits: cleanText(c.traits),
          bio: cleanText(c.bio)
        }))
      });
    }
  };

  const generateWorldField = async (field: keyof WorldBible, label: string) => {
    if (!project.idea) return alert("请先填写核心灵感");
    
    const context = `
    核心灵感: ${project.idea}
    当前世界观概况:
    ${ALL_BIBLE_KEYS.map(k => `- ${BIBLE_LABELS[k]}: ${(project.architecture.worldBible as any)?.[k] || "未定"}`).join('\n')}
    `;

    const prompt = `基于以下小说核心灵感：
    """${project.idea}"""
    
    请专门为【${label}】生成一段详细、有创意且逻辑自洽的设定。
    
    已有上下文参考：
    ${context}
    
    要求：
    1. 设定要具体，不要泛泛而谈。
    2. 符合网文读者的阅读习惯（新奇、爽点、代入感）。
    3. 字数控制在 200-500 字之间。
    4. 必须使用中文生成。
    5. 直接输出设定内容，不要有多余的废话。`;

    const text = await runAI(`正在生成${label}...`, prompt, "World Builder", false, true);
    if (text) {
        updateProject({
            ...project,
            architecture: {
                ...project.architecture,
                worldBible: {
                    ...project.architecture.worldBible,
                    [field]: text
                } as any
            }
        });
    }
  };

  const generateDetailedStructure = async () => {
    if (!project.architecture.mainPlot) return alert("请先生成或输入主线剧情大纲");
    const prompt = `基于以下主线梗概：\n"""${project.architecture.mainPlot}"""\n请扩展生成一份【详细主线构架】。要求：严格地图套圈模式，细化到具体副本、宗门、场景切换和成长突破。请使用中文生成内容。`;
    const text = await runAI("正在深化剧情结构...", prompt, "Structure Master", false, true);
    if (text) { updateProject({ ...project, architecture: { ...project.architecture, plotStructure: text } }); }
  };

  const generateSideQuests = async () => {
     if (!project.architecture.mainPlot) return alert("请先生成主线剧情");
     const charList = project.characterList.map(c => `${c.name} (${c.role})`).join(", ");
     const prompt = `基于主线剧情：\n"""${project.architecture.mainPlot}"""\n现有角色：${charList}\n设计 3-5 个精彩的支线任务。
     【重要要求】必须使用中文生成。
     返回 JSON 数组: [ { "title": "支线标题", "location": "发生的地图或具体地点", "origin": "支线起因", "process": "具体过程", "rewardOrImpact": "奖励与影响", "timelineStage": "具体时间段" } ]`;
     const text = await runAI("正在批量设计支线任务...", prompt, "Quest Designer", true, true);
     if (!text) return;
     const data = safeJsonParse(text);
     if (Array.isArray(data)) {
        const newQuests: SideQuest[] = data.map((q: any, i: number) => ({
            id: Date.now() + i,
            title: cleanText(q.title) + (q.timelineStage ? ` [${q.timelineStage}]` : ""),
            location: cleanText(q.location),
            origin: cleanText(q.origin),
            process: cleanText(q.process),
            rewardOrImpact: cleanText(q.rewardOrImpact),
            associatedCharacters: []
        }));
        updateProject({ ...project, architecture: { ...project.architecture, sideQuests: [...(project.architecture.sideQuests || []), ...newQuests] } });
     }
  };

  const rewriteSideQuest = async (id: number) => {
    const qs = project.architecture.sideQuests || [];
    const quest = qs.find(q => q.id === id);
    if (!quest) return;
    
    const charList = project.characterList.map(c => c.name).join(", ");
    const prompt = `
    【支线任务细节设计】
    
    小说主线大纲：
    """${project.architecture.mainPlot || "未设定"}"""
    
    现有角色：${charList}
    
    待设计的支线初步信息：
    - 标题/时间段：${quest.title}
    - 发生地点：${quest.location || "未设定"}
    - 现有起因：${quest.origin || "未设定"}
    - 现有过程：${quest.process || "未设定"}
    
    指令：
    1. 完善该支线任务的【发生地点】、【起因】、【具体过程】和【对主角/角色的奖励或深远影响】。
    2. 确保该支线符合主线的基调，且逻辑自洽。
    3. 描写要生动，体现出冲突和爽点。
    4. 必须使用中文生成。
    
    返回 JSON: { "title": "正式标题", "location": "具体地点", "origin": "详细起因", "process": "详细过程", "rewardOrImpact": "奖励与深远影响" }
    `;
    
    const text = await runAI(`正在设计/完善支线: ${quest.title}...`, prompt, "Quest Refiner", true, true);
    if (!text) return;
    
    const data = safeJsonParse(text);
    if (data) {
        const newQs = qs.map(q => q.id === id ? { ...q, title: cleanText(data.title), location: cleanText(data.location), origin: cleanText(data.origin), process: cleanText(data.process), rewardOrImpact: cleanText(data.rewardOrImpact) } : q);
        updateProject({ ...project, architecture: { ...project.architecture, sideQuests: newQs } });
    }
  };

  const generateSingleCharacter = async (idx: number) => {
    const char = project.characterList[idx];
    const prompt = `为角色【${char.name}】完善人设。基于主线：${project.architecture.mainPlot || "未定"}。请使用中文返回完善后的详细设定，包含角色定位、剧情功能、性格特征和简要小传。返回 JSON: { "name": "姓名", "role": "角色定位", "plotFunction": "剧情功能", "traits": "性格特征", "bio": "简要小传" }`;
    const text = await runAI(`正在设计角色: ${char.name}...`, prompt, "Character Designer", true, true);
    if (!text) return;
    const data = safeJsonParse(text);
    if (data) {
        const newList = [...project.characterList];
        newList[idx] = { ...newList[idx], name: cleanText(data.name), role: cleanText(data.role), plotFunction: cleanText(data.plotFunction), traits: cleanText(data.traits), bio: cleanText(data.bio) };
        updateProject({ ...project, characterList: newList });
    }
  };

  const moveQuest = (idx: number, dir: 'up' | 'down') => {
      const qs = [...(project.architecture.sideQuests || [])];
      if (dir === 'up' && idx > 0) {
          [qs[idx], qs[idx-1]] = [qs[idx-1], qs[idx]];
      } else if (dir === 'down' && idx < qs.length - 1) {
          [qs[idx], qs[idx+1]] = [qs[idx+1], qs[idx]];
      }
      updateProject({ ...project, architecture: { ...project.architecture, sideQuests: qs } });
  };

  const updateSideQuest = (id: number, field: keyof SideQuest, value: any) => {
      const qs = [...(project.architecture.sideQuests || [])];
      const idx = qs.findIndex(q => q.id === id);
      if (idx !== -1) { qs[idx] = { ...qs[idx], [field]: value }; updateProject({ ...project, architecture: { ...project.architecture, sideQuests: qs } }); }
  };

  const handleGlobalConsistencyCheck = async () => {
    if (!project.architecture.mainPlot || !project.architecture.plotStructure) {
        return alert("请先完成【主线大纲】和【详细构架】的生成，AI 才能进行全局逻辑校验。");
    }

    const prompt = `
    【全书底层逻辑一致性校验 - 终极审计】
    请深度扫描以下设定档案，查找【相互矛盾】、【逻辑断层】或【设定冲突】。
    
    档案内容：
    1. 世界观: ${JSON.stringify(project.architecture.worldBible)}
    2. 角色表: ${JSON.stringify(project.characterList)}
    3. 主线大纲: ${project.architecture.mainPlot}
    4. 详细构架: ${project.architecture.plotStructure}
    5. 支线任务: ${JSON.stringify(project.architecture.sideQuests)}

    检查维度：
    - 人物行为是否违背其性格设定？
    - 剧情是否违背了世界观法则或力量体系？
    - 主线与详细细纲、支线是否存在冲突？
    - 战力等级是否在不同章节中保持一致？
    
    【强制要求】必须使用中文输出校验结果。

    返回 JSON: { "issues": [{ "severity": "high"|"medium"|"low", "location": "模块名", "description": "冲突详情", "suggestion": "修正建议" }], "overallScore": 0-100, "summary": "整体评价" }
    `;

    const text = await runAI("全盘逻辑扫描中...", prompt, "Logic Auditor", true, true);
    if (!text) return;
    const data = safeJsonParse(text);
    if (data) {
        setConsistencyReport(data);
        setShowConsistencyModal(true);
    }
  };

  const handleBlender = async (mode: 'mix' | 'strict') => {
    if (blenderTags.length === 0 && !blenderInput.trim()) return alert("请至少选择一个标签或输入自定义灵感");
    const tagsInfo = blenderTags.length > 0 ? `标签/风格：【${blenderTags.join(' + ')}】` : "";
    const customInfo = blenderInput ? `用户自定义脑洞/要求：【${blenderInput}】` : "";
    let prompt = `作为资深网文策划，${mode === 'strict' ? '【严格基于】' : '启动【灵感搅拌机】模式'}：\n${tagsInfo}\n${customInfo}\n输出：书名、简介、核心爽点、简要世界观。请必须使用中文。`;
    const text = await runAI(mode === 'strict' ? "正在定向构思..." : "正在疯狂搅拌...", prompt, "Creative Director", false, true);
    if (text) { updateProject({ ...project, idea: text }); setShowBlender(false); }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 px-2 md:px-0">
      {/* Top Banner / Hero Input */}
      <div className="bg-white p-6 rounded-xl border shadow-sm flex flex-col transition-all">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h3 className="font-bold flex items-center gap-2 text-slate-800 text-lg">
            <Sparkles className="text-indigo-500" size={24}/> 核心灵感 (Core Inspiration)
          </h3>
          <div className="flex gap-2">
            <Button variant="gold" size="md" onClick={() => setShowBlender(true)}><Shuffle size={16}/> 灵感搅拌机</Button>
            {hasContent && ( <Button onClick={generateArchitecture} disabled={!project.idea} size="md">重新生成</Button> )}
          </div>
        </div>
        <textarea className="w-full p-4 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-y text-lg leading-relaxed min-h-[150px] transition-all font-serif" placeholder="在此输入您的小说创意..." value={project.idea || ""} onChange={e => updateProject({...project, idea: e.target.value})}/>
        {!hasContent && ( <div className="flex justify-center mt-6 shrink-0"><Button onClick={generateArchitecture} disabled={!project.idea} size="lg" className="px-16 py-4 text-xl shadow-xl shadow-indigo-200 font-bold tracking-wide"><Wand2 size={24}/> 开始构建小说架构</Button></div> )}
      </div>

      {hasContent && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          {/* Dashboard Row 1: World & Characters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border shadow-sm h-[600px] flex flex-col relative overflow-hidden">
                <div className="flex justify-between mb-3 border-b pb-2">
                    <h4 className="font-bold text-slate-700 flex gap-2 text-base items-center"><Globe size={18}/> 世界观设定</h4>
                    <Button size="sm" variant="ghost" onClick={() => setEditWorldModal(true)}><Edit3 size={16}/></Button>
                </div>
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-lg text-sm space-y-4 custom-scrollbar">
                    {ALL_BIBLE_KEYS.map((k) => {
                        const val = (project.architecture.worldBible as any)?.[k];
                        return (
                          <div key={k} className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm relative group">
                              <span className="text-[10px] font-bold text-slate-400 block mb-1 uppercase tracking-wider">{BIBLE_LABELS[k]}</span>
                              <p className={`text-slate-700 leading-relaxed whitespace-pre-wrap ${!val ? 'italic text-slate-300' : ''}`}>
                                  {val || `点击 AI 按钮生成${BIBLE_LABELS[k]}`}
                              </p>
                              <button 
                                onClick={() => generateWorldField(k, BIBLE_LABELS[k])} 
                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-indigo-400 hover:text-indigo-600 transition-all bg-white/50 rounded"
                                title={`AI 补全${BIBLE_LABELS[k]}`}
                              >
                                  <Wand2 size={12}/>
                              </button>
                          </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white p-5 rounded-xl border shadow-sm h-[600px] flex flex-col">
                <div className="flex justify-between mb-3 border-b pb-2">
                    <h4 className="font-bold text-slate-700 flex gap-2 text-base items-center"><Users size={18}/> 核心角色</h4>
                    <Button size="sm" variant="secondary" onClick={() => updateProject({...project, characterList:[...project.characterList, {id:Date.now(), name:"新角色", role:"配角", plotFunction: "", traits:"", bio:"", imageUrl: ""}]})}><Plus size={14}/></Button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
                    {project.characterList.map((char, idx) => (
                        <div key={char.id} className="bg-white p-3 rounded-lg border border-slate-200 hover:border-indigo-300 shadow-sm flex gap-3 relative group transition-all">
                            <div className="w-16 h-20 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden cursor-pointer" onClick={() => {}}>
                                {char.imageUrl ? <img src={char.imageUrl} className="w-full h-full object-cover" alt={char.name}/> : <ImageIcon size={20} className="text-slate-300"/>}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                                <div className="flex gap-2 items-center">
                                    <input className="font-bold bg-transparent flex-1 text-sm border-b border-transparent hover:border-indigo-300 focus:border-indigo-500 outline-none" value={char.name} onChange={e=>{const n=[...project.characterList];n[idx].name=e.target.value;updateProject({...project, characterList:n})}}/>
                                    <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{char.role}</span>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2">{char.traits || char.bio || "暂无设定"}</p>
                            </div>
                            <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg p-1 shadow-sm">
                                <button onClick={() => generateSingleCharacter(idx)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded" title="AI 完善人设"><Wand2 size={14}/></button>
                                <button onClick={()=>{const n=[...project.characterList]; n.splice(idx,1); updateProject({...project, characterList:n})}} className="p-1.5 text-red-400 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                            </div>
                        </div>
                    ))}
                    {project.characterList.length === 0 && <div className="text-center py-20 text-slate-400">尚未添加任何角色</div>}
                </div>
            </div>
          </div>

          {/* Plot Sections */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Layers size={20}/> 主线剧情与详细构架</h4>
                    <div className="flex gap-2">
                        <Button size="sm" variant="warning" onClick={handleGlobalConsistencyCheck}><ShieldCheck size={16}/> 一键逻辑校验</Button>
                        <Button size="sm" variant="thinking" onClick={generateDetailedStructure}><Wand2 size={16}/> 深化构架</Button>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-lg border">
                            <span className="text-xs font-bold text-slate-400 block mb-2">主线梗概 (Overview)</span>
                            <textarea className="w-full h-64 bg-transparent outline-none text-sm leading-relaxed resize-none" value={project.architecture.mainPlot || ""} onChange={e => updateProject({...project, architecture: {...project.architecture, mainPlot: e.target.value}})}/>
                        </div>
                    </div>
                    <div className="lg:col-span-3">
                        <div className="bg-indigo-50/30 p-4 rounded-lg border border-indigo-100 h-full">
                            <span className="text-xs font-bold text-indigo-400 block mb-2">详细构架 (Structure & Map Interaction)</span>
                            <textarea className="w-full h-[32rem] bg-transparent outline-none text-sm leading-relaxed font-serif" value={project.architecture.plotStructure || ""} onChange={e => updateProject({...project, architecture: {...project.architecture, plotStructure: e.target.value}})} placeholder="在此深化每个地图的具体事件、伏笔和层级互动..."/>
                        </div>
                    </div>
                </div>
            </div>

            {/* Side Quests - Modular & Sortable */}
            <div className="bg-white p-6 rounded-xl border shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <Compass size={22} className="text-amber-500"/>
                        <div>
                            <h4 className="font-bold text-lg text-slate-800">支线任务模块 (Side Quests Timeline)</h4>
                            <p className="text-xs text-slate-500">支持模块化排序，按时间线从上至下排列</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="gold" onClick={generateSideQuests} title="自动构思3-5个新支线"><Gift size={16}/> 批量设计</Button>
                        <Button size="sm" variant="secondary" onClick={() => updateProject({...project, architecture:{...project.architecture, sideQuests:[...(project.architecture.sideQuests || []), {id:Date.now(), title:"新支线", location:"", origin:"", process:"", rewardOrImpact:"", associatedCharacters:[]}]}})}><Plus size={16}/> 添加</Button>
                    </div>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 p-1">
                    {(project.architecture.sideQuests || []).map((q, idx) => (
                        <div key={q.id} className="bg-slate-50 border border-slate-200 rounded-xl p-5 flex gap-4 hover:shadow-md transition-shadow group relative">
                            {/* Sort Controls */}
                            <div className="flex flex-col gap-1 justify-center shrink-0">
                                <button onClick={() => moveQuest(idx, 'up')} className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-400 hover:text-indigo-600 disabled:opacity-20" disabled={idx === 0}><ArrowUp size={16}/></button>
                                <button onClick={() => moveQuest(idx, 'down')} className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-400 hover:text-indigo-600 disabled:opacity-20" disabled={idx === (project.architecture.sideQuests?.length || 0) - 1}><ArrowDown size={16}/></button>
                            </div>
                            
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold text-white bg-slate-400 px-2 py-0.5 rounded-full">模块 {idx + 1}</span>
                                    <input className="font-bold text-slate-800 bg-transparent border-b border-transparent focus:border-indigo-300 outline-none flex-1" value={q.title} onChange={e => updateSideQuest(q.id, 'title', e.target.value)} placeholder="任务名称/发生的时间段"/>
                                    <button 
                                      onClick={() => rewriteSideQuest(q.id)} 
                                      className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
                                      title="AI 智能构思/补全该支线剧情"
                                    >
                                        <Wand2 size={12}/> AI 智能生成
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-indigo-500 block mb-1">地点 (Location)</label>
                                        <textarea className="w-full text-xs bg-white border border-slate-100 p-2 rounded h-20 outline-none focus:ring-1 focus:ring-indigo-200 resize-none" value={q.location || ""} onChange={e => updateSideQuest(q.id, 'location', e.target.value)} placeholder="发生的地图或具体地点..."/>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 block mb-1">起因 (Trigger)</label>
                                        <textarea className="w-full text-xs bg-white border border-slate-100 p-2 rounded h-20 outline-none focus:ring-1 focus:ring-indigo-200 resize-none" value={q.origin} onChange={e => updateSideQuest(q.id, 'origin', e.target.value)} placeholder="导致该支线发生的契机..."/>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 block mb-1">过程 (Process)</label>
                                        <textarea className="w-full text-xs bg-white border border-slate-100 p-2 rounded h-20 outline-none focus:ring-1 focus:ring-indigo-200 resize-none" value={q.process} onChange={e => updateSideQuest(q.id, 'process', e.target.value)} placeholder="具体的任务内容、冲突和关键点..."/>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-emerald-500 block mb-1">奖励与影响</label>
                                        <textarea className="w-full text-xs bg-white border border-slate-100 p-2 rounded h-20 outline-none focus:ring-1 focus:ring-emerald-200 resize-none" value={q.rewardOrImpact} onChange={e => updateSideQuest(q.id, 'rewardOrImpact', e.target.value)} placeholder="完成后获得的好处或对后续剧情的影响..."/>
                                    </div>
                                </div>
                            </div>

                            <button onClick={() => {const n=[...(project.architecture.sideQuests || [])]; n.splice(idx,1); updateProject({...project, architecture:{...project.architecture, sideQuests:n}})}} className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16}/></button>
                        </div>
                    ))}
                    {(!project.architecture.sideQuests || project.architecture.sideQuests.length === 0) && (
                        <div className="text-center py-12 bg-slate-50 border border-dashed rounded-xl text-slate-400 text-sm">暂无支线任务。点击“批量设计”或手动“添加”。</div>
                    )}
                </div>
            </div>
          </div>

          {/* Logic Consistency Modal */}
          <Modal isOpen={showConsistencyModal} onClose={() => setShowConsistencyModal(false)} title="全书逻辑校验报告">
            {consistencyReport ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-3">
                            <div className={`text-2xl font-bold ${consistencyReport.overallScore >= 80 ? 'text-emerald-600' : consistencyReport.overallScore >= 60 ? 'text-amber-500' : 'text-red-500'}`}>
                                {consistencyReport.overallScore}分
                            </div>
                            <div className="text-sm text-slate-500">逻辑严密度</div>
                        </div>
                        <div className="text-sm text-slate-600 font-medium max-w-[60%] text-right">{consistencyReport.summary}</div>
                    </div>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
                        {consistencyReport.issues.map((issue: any, idx: number) => (
                            <div key={idx} className={`p-4 rounded-lg border flex gap-3 ${issue.severity === 'high' ? 'bg-red-50 border-red-200' : issue.severity === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'}`}>
                                <div className="mt-1">
                                    {issue.severity === 'high' ? <ShieldAlert className="text-red-500" size={20}/> : issue.severity === 'medium' ? <AlertTriangle className="text-amber-500" size={20}/> : <ShieldCheck className="text-blue-500" size={20}/>}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="font-bold text-sm text-slate-800">{issue.location}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${issue.severity === 'high' ? 'bg-red-100 text-red-700' : issue.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{issue.severity}</span>
                                    </div>
                                    <p className="text-sm text-slate-700 mb-2">{issue.description}</p>
                                    <div className="bg-white/60 p-2 rounded text-xs text-slate-600 border border-black/5">
                                        <span className="font-bold mr-1">建议:</span> {issue.suggestion}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : <div className="text-center py-20 text-slate-400">正在审计...</div>}
          </Modal>

          <div className="flex justify-center pt-8 pb-8">
            <Button size="lg" variant="success" className="w-full md:w-auto px-16 py-4 text-xl shadow-lg font-bold" onClick={() => { updateProject({...project, currentStep:2}); setActiveStep(2); }}>下一步：编排章节 <ChevronRight size={24}/></Button>
          </div>
        </div>
      )}
      
      {/* Edit World View Modal */}
      <Modal isOpen={editWorldModal} onClose={() => setEditWorldModal(false)} title="编辑世界观设定">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar p-1">
            {ALL_BIBLE_KEYS.map(key => (
                <div key={key}>
                    <label className="text-xs font-bold text-slate-500 mb-1 flex justify-between items-center">
                        {BIBLE_LABELS[key]}
                        <button onClick={() => generateWorldField(key as any, BIBLE_LABELS[key])} className="text-indigo-400 hover:text-indigo-600 p-1" title={`AI 生成${BIBLE_LABELS[key]}`}><Wand2 size={12}/></button>
                    </label>
                    <textarea 
                        className="w-full border p-3 rounded-lg text-sm min-h-[100px] outline-none focus:ring-2 focus:ring-indigo-500"
                        value={(project.architecture.worldBible as any)?.[key] || ""}
                        onChange={e => updateProject({...project, architecture: {...project.architecture, worldBible: {...project.architecture.worldBible, [key]: e.target.value}}})}
                    />
                </div>
            ))}
            <div className="flex justify-end pt-4"><Button onClick={() => setEditWorldModal(false)}>保存并关闭</Button></div>
        </div>
      </Modal>
    </div>
  );
};
