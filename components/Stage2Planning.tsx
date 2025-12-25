
import React, { useState, useEffect } from 'react';
import { Palette, RefreshCw, Trash2, ArrowDownCircle, ChevronRight, BrainCircuit, PlayCircle, Settings2, Check, X, Edit3, Users, FolderOpen, Sparkles, GitMerge, Inbox, Milestone, PenTool, AlertOctagon } from 'lucide-react';
import { Button, TagSelector, Modal } from './Shared';
import { Project, WRITING_STYLES, STORY_TONES, KeyMilestone } from '../types';
import { callGemini, safeJsonParse } from '../services/gemini';

interface Props {
  project: Project;
  updateProject: (p: Project) => void;
  setLoading: (msg: string | null) => void;
  setActiveStep: (step: number) => void;
}

interface LogicIssue {
  chapterIndex: number;
  title: string;
  reason: string;
  oldSummary: string;
  newSummary: string;
}

const cleanText = (val: any) => {
  if (val === null || val === undefined) return "";
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.content || val.text || val.summary || JSON.stringify(val);
  }
  return String(val);
};

// Helper to parse chapter ranges like "Ch 10-20", "20-30", "第5章"
const parseRange = (str: string): { start: number, end: number } | null => {
    if (!str) return null;
    const nums = str.match(/\d+/g);
    if (!nums || nums.length === 0) return null;
    const start = parseInt(nums[0]);
    // If only one number (e.g. "Ch 50"), treat as start=end=50
    const end = nums.length > 1 ? parseInt(nums[1]) : start; 
    return { start, end };
};

export const Stage2Planning: React.FC<Props> = ({ project, updateProject, setLoading, setActiveStep }) => {
  const [batchSize, setBatchSize] = useState<number>(50); 
  const [plotIncrement, setPlotIncrement] = useState<number>(20);
  const [activeCastIds, setActiveCastIds] = useState<number[]>([]);
  const [showCastModal, setShowCastModal] = useState(false);
  const [logicIssues, setLogicIssues] = useState<LogicIssue[]>([]);
  const [showLogicModal, setShowLogicModal] = useState(false);
  const [editingIssueIndex, setEditingIssueIndex] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [totalChaptersEst, setTotalChaptersEst] = useState<number>(300); // Estimated Total Chapters

  const currentProgress = project.plotProgress || 0;
  const remainingProgress = 100 - currentProgress;
  const actualIncrement = Math.min(plotIncrement, remainingProgress);

  useEffect(() => {
    if (activeCastIds.length === 0 && project.characterList.length > 0) {
        setActiveCastIds(project.characterList.map(c => c.id));
    }
  }, [project.characterList]);

  const toggleCast = (id: number) => {
    setActiveCastIds(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
  };
  const selectAllCast = () => setActiveCastIds(project.characterList.map(c => c.id));
  const clearCast = () => setActiveCastIds([]);

  const runAI = async (msg: string, prompt: string, sys: string, isJson: boolean) => {
    setLoading(msg);
    try {
      return await callGemini(prompt, sys, isJson);
    } catch (e: any) {
      alert(e.message);
      return null;
    } finally {
      setLoading(null);
    }
  };

  const checkMilestoneActive = (chapterIdx: number, milestones: KeyMilestone[] = []) => {
      if (!milestones || milestones.length === 0) return false;
      const currentChNum = chapterIdx + 1;
      
      return milestones.some(m => {
          const range = parseRange(m.expectedChapterRange || "");
          if (range) {
              return currentChNum >= range.start && currentChNum <= range.end;
          }
          return false;
      });
  };

  const handleSmartCastSelection = async () => {
    const structure = project.architecture.plotStructure || project.architecture.mainPlot || "未提供主线";
    const charList = project.characterList.map(c => `- ${c.name} (${c.role}, ${c.plotFunction})`).join("\n");
    const prompt = `基于小说主线构架：\n"""${structure.slice(0, 2000)}..."""\n当前剧情进度：${currentProgress}%。接下来的任务是生成约 ${batchSize} 章剧情，推进到 ${Math.min(100, currentProgress + actualIncrement)}%。\n可用角色列表：\n${charList}\n请分析接下来的剧情发展需求，挑选出【必须登场】的活跃角色。\n返回 JSON: { "selectedNames": ["角色名1", "角色名2"] }`;
    const text = await runAI("AI 正在分析剧情并挑选演员...", prompt, "Casting Director", true);
    if (!text) return;
    const data = safeJsonParse(text);
    if (data?.selectedNames && Array.isArray(data.selectedNames)) {
        const selectedNames = data.selectedNames.map((n: string) => n.trim());
        const newIds = project.characterList.filter(c => selectedNames.some((sn: string) => c.name.includes(sn) || sn.includes(c.name))).map(c => c.id);
        if (newIds.length > 0) { setActiveCastIds(newIds); alert(`AI 已根据剧情挑选了 ${newIds.length} 位角色。`); } 
        else { alert("AI 未能匹配到任何角色，请手动选择。"); }
    }
  };

  const handleGenerateMilestones = async () => {
     const structure = project.architecture.plotStructure || project.architecture.mainPlot;
     if (!structure) return alert("请先在第一步生成主线大纲");
     
     const prompt = `基于以下主线大纲：\n"""${structure}"""\n
     【篇幅规划】
     本书预计总篇幅为 ${totalChaptersEst} 章。
     
     请提取出所有关键剧情节点（Milestones），用于指导章节编排。
     重点关注：1. 副本/大事件 2. 宗门/势力登场 3. 换地图 4. 主角重大成长。
     
     【特别要求】
     请务必将这些节点合理分布在 第 1 章 到 第 ${totalChaptersEst} 章 的范围内，并标明大致的章节范围。
     
     请按时间顺序返回 JSON 数组: { "milestones": [ { "name": "简短名称", "type": "dungeon" | "sect" | "location" | "growth" | "other", "description": "描述", "expectedChapterRange": "建议章节范围(如:第20-30章)" } ] }`;
     
     const text = await runAI("正在提取主线关键节点...", prompt, "Plot Analyst", true);
     if (!text) return;
     const data = safeJsonParse(text);
     if (data?.milestones) {
         const newMilestones: KeyMilestone[] = data.milestones.map((m: any, i: number) => ({ id: Date.now() + i, name: cleanText(m.name), type: m.type || 'other', description: cleanText(m.description), expectedChapterRange: cleanText(m.expectedChapterRange) }));
         updateProject({ ...project, architecture: { ...project.architecture, keyMilestones: newMilestones } });
     }
  };

  const deleteMilestone = (id: number) => {
      const ms = project.architecture.keyMilestones || [];
      updateProject({ ...project, architecture: { ...project.architecture, keyMilestones: ms.filter(m => m.id !== id) } });
  };

  const handleStyleChange = (val: string[]) => updateProject({ ...project, settings: { ...project.settings, styles: val } });
  const handleToneChange = (val: string[]) => updateProject({ ...project, settings: { ...project.settings, tones: val } });

  const generateChapters = async () => {
    if (remainingProgress <= 0 && !confirm("剧情进度已达 100%。是否继续生成番外或续集章节？")) return;
    const activeChars = project.characterList.filter(c => activeCastIds.includes(c.id));
    if (activeChars.length === 0) return alert("请至少选择一位登场角色 (Active Cast)。");

    const protagonistChar = activeChars.find(c => c.role.includes("主角"));
    const protagonist = protagonistChar?.name || activeChars[0].name;
    const others = activeChars.filter(c => c.name !== protagonist).map(c => c.name).join("、");
    const styles = project.settings?.styles?.join("、") || "标准";
    const tones = project.settings?.tones?.join("、") || "正常";
    const sourceMaterial = project.architecture.plotStructure || project.architecture.mainPlot || "未提供主线";
    
    // --- Synchronization Logic Start ---
    const existingCount = project.chapters.length;
    const currentStart = existingCount + 1;
    const currentEnd = existingCount + batchSize;
    const milestones = project.architecture.keyMilestones || [];
    
    // Filter milestones that overlap with the current batch range
    const activeMilestones = milestones.filter(m => {
        const range = parseRange(m.expectedChapterRange || "");
        if (!range) return false;
        // Check overlap: range.start <= currentEnd && range.end >= currentStart
        return range.start <= currentEnd && range.end >= currentStart;
    });

    const milestonesText = activeMilestones.length > 0 
        ? `【本批次必须完成的关键剧情节点 (CRITICAL)】\n检测到本批次 (${currentStart}-${currentEnd}章) 包含以下预设节点，请务必将其安排进剧情：\n` + activeMilestones.map(m => `- [${m.type}] ${m.name}: ${m.description} (计划范围: ${m.expectedChapterRange})`).join("\n") 
        : "【本批次无强制预设节点】请根据主线逻辑自由发挥过渡，为后续高潮做铺垫。";
    
    // Calculate target progress based on ratio if total chapters is set, otherwise fall back to slider
    let targetProgress = currentProgress + actualIncrement;
    if (totalChaptersEst > 0) {
        // Calculate progress percentage based on chapter count
        const calculatedProgress = Math.min(100, Math.round((currentEnd / totalChaptersEst) * 100));
        // Use the calculated progress if it seems reasonable (not going backwards)
        if (calculatedProgress > currentProgress) {
             targetProgress = calculatedProgress;
        }
    }
    // --- Synchronization Logic End ---

    const isEarlyGame = existingCount < 10;
    const worldBuildingInstruction = isEarlyGame 
      ? `【开篇特别要求 - 世界观自然融入】
         由于这是本书的前几章，请务必在推进剧情的同时，通过主角的视觉、对话和遭遇，**自然地**引出世界观设定（如力量体系、货币、地理环境）。
         **严禁**大段的设定说明文。要让读者在故事中不知不觉地理解这个世界。`
      : "";

    const prompt = `基于小说构架/大纲：\n"""${sourceMaterial}"""\n
    【全局进度上下文】
    - 本书预计总长：${totalChaptersEst} 章。
    - 本次生成范围：第 ${currentStart} 章 - 第 ${currentEnd} 章。
    - 全局剧情进度：${currentProgress}% -> ${targetProgress}%。
    
    【本批次登场角色】核心视点：${protagonist}，其他：${others || "无"}
    
    ${milestonesText}
    
    【本次任务】
    生成 ${batchSize} 章的详细细纲。
    
    ${worldBuildingInstruction}
    
    【特别要求 - 复合生成】
    请一次性为每一章生成三个字段：
    1. title: 章节标题
    2. summary: **详细的剧情细纲（Scene-by-Scene Breakdown）**。不要只写“他打败了敌人”，要写“他侧身躲过火球，使用第三章获得的冰霜护符反击，击中敌人弱点...”。越详细越好。
    3. writingGuidance: 针对该章细纲的【伴随式写作指导】。请根据细纲的具体内容（如是战斗、感情、还是日常），给出具体的描写建议（如“本章适合用心理描写反衬紧张感”或“建议采用多视角切换”）。

    【格式要求】
    1. 70%主角视角。
    2. 风格：${styles}，基调：${tones}。
    3. 返回 JSON (必须包含 writingGuidance 字段): 
    { 
      "chapters": [ 
        { 
          "title": "标题", 
          "summary": "详细到镜头感的纯文本细纲", 
          "writingGuidance": "本章建议的写作手法/侧重点..." 
        } 
      ] 
    } 
    确保 chapters 数组长度为 ${batchSize}。`;
    
    const text = await runAI(`正在规划 ${batchSize} 章 (进度 ${currentProgress}%->${targetProgress}%)...`, prompt, "Master Planner", true);
    if (!text) return;
    const data = safeJsonParse(text);
    if (data?.chapters) {
      const cleanChapters = data.chapters.map((c: any, i: number) => ({ id: Date.now() + i, title: cleanText(c.title), summary: cleanText(c.summary), writingGuidance: cleanText(c.writingGuidance) }));
      updateProject({ ...project, chapters: [...project.chapters, ...cleanChapters], plotProgress: targetProgress });
    }
  };

  const handleResyncStructure = async () => {
    if (project.chapters.length < 5) return alert("章节数量太少，无需重构架构。");
    const summaries = project.chapters.map((c, i) => `第${i+1}章: ${c.summary}`).join("\n");
    const oldStructure = project.architecture.plotStructure || project.architecture.mainPlot;
    const prompt = `【架构软重构】原定架构：\n"""${oldStructure}"""\n实际编写章节：\n"""${summaries.slice(0, 50000)}..."""\n【指令】请参考【作者实际编写的章节】，对【原定架构】进行轻微的调整和修正，修补逻辑断层。请输出修正后的“详细主线构架”。`;
    const text = await runAI("正在基于现有章节反向修正架构...", prompt, "Architect Rebuilder", false);
    if (text) { updateProject({ ...project, architecture: { ...project.architecture, plotStructure: text } }); alert("架构已根据当前章节进行了适应性调整！"); }
  };

  const insertChapter = (index: number) => {
    const newCh = { id: Date.now(), title: "新插入章节", summary: "点击重写以自动生成过渡内容...", writingGuidance: "建议补充过渡情节" };
    const newChapters = [...project.chapters];
    newChapters.splice(index + 1, 0, newCh);
    updateProject({ ...project, chapters: newChapters });
  };

  const deleteChapter = (index: number) => {
      const newChapters = [...project.chapters];
      newChapters.splice(index, 1);
      const newProgress = Math.max(0, (project.plotProgress || 0) - 1);
      updateProject({ ...project, chapters: newChapters, plotProgress: newProgress });
  };

  const rewriteChapter = async (index: number) => {
    const prevCh = index > 0 ? project.chapters[index-1].summary : "故事开始";
    const nextCh = index < project.chapters.length - 1 ? project.chapters[index+1].summary : "故事继续";
    const currentCh = project.chapters[index];
    const prompt = `任务：重写第 ${index+1} 章的大纲。上下文：上章[${prevCh}]，下章[${nextCh}]。主线：${project.architecture.plotStructure || project.architecture.mainPlot}。当前标题：${currentCh.title}。要求：生成承上启下的精彩大纲，并**同时**提供针对本章的写作指导。返回 JSON: { "title": "建议标题", "summary": "纯文本细纲", "writingGuidance": "写作建议..." }`;
    const text = await runAI(`正在重构第 ${index+1} 章...`, prompt, "Plot Fixer", true);
    if (!text) return;
    const data = safeJsonParse(text);
    if (data) {
      const newChapters = [...project.chapters];
      newChapters[index] = { ...newChapters[index], title: cleanText(data.title), summary: cleanText(data.summary), writingGuidance: cleanText(data.writingGuidance) };
      updateProject({ ...project, chapters: newChapters });
    }
  };

  const handleLogicCorrection = async () => {
    if (project.chapters.length === 0) return alert("暂无章节可检查");
    const structure = project.architecture.plotStructure || project.architecture.mainPlot;
    const chapterList = project.chapters.map((c, i) => `[Ch${i+1}] ${c.title}: ${c.summary}`).join("\n");
    const prompt = `【逻辑纠正任务】主线：\n"""${structure}"""\n章节列表：\n"""${chapterList}"""\n请扫描前后矛盾、战力崩坏或偏离主线的地方。\n返回 JSON: { "issues": [ { "chapterIndex": 0, "title": "", "reason": "", "newSummary": "" } ] }`;
    const text = await runAI("正在深度扫描全书逻辑...", prompt, "Logic Doctor", true);
    if (!text) return;
    const data = safeJsonParse(text);
    if (data?.issues && Array.isArray(data.issues) && data.issues.length > 0) {
        const formattedIssues = data.issues.map((issue: any) => ({ chapterIndex: issue.chapterIndex, title: cleanText(issue.title), reason: cleanText(issue.reason), newSummary: cleanText(issue.newSummary), oldSummary: project.chapters[issue.chapterIndex]?.summary || "原文本丢失" })).filter((i: any) => project.chapters[i.chapterIndex]);
        setLogicIssues(formattedIssues);
        setShowLogicModal(true);
    } else { alert("完美！逻辑检测器未发现问题。"); }
  };

  const applyAllFixes = () => {
    const newChapters = [...project.chapters];
    logicIssues.forEach(issue => { if (newChapters[issue.chapterIndex]) newChapters[issue.chapterIndex] = { ...newChapters[issue.chapterIndex], summary: issue.newSummary }; });
    updateProject({ ...project, chapters: newChapters });
    setLogicIssues([]);
    setShowLogicModal(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 relative px-2 md:px-0">
      
      {/* Settings & Controls */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg"><Palette size={20} className="text-indigo-500"/> 风格与基调定制</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TagSelector label="行文风格" options={WRITING_STYLES} selected={project.settings?.styles || []} onChange={handleStyleChange} max={3} />
            <TagSelector label="情感基调" options={STORY_TONES} selected={project.settings?.tones || []} onChange={handleToneChange} max={3} />
          </div>
      </div>

      <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 flex flex-col gap-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
              <div>
                  <h3 className="font-bold text-indigo-900 text-lg flex items-center gap-2"><Settings2 size={20}/> 章节生成控制台</h3>
                  <p className="text-sm text-indigo-600 mt-1">控制生成数量与剧情推进速度。</p>
              </div>
              <div className="flex gap-2">
                  <Button variant="secondary" size="md" onClick={handleResyncStructure} title="根据修改后的章节反向修正主线架构"><GitMerge size={18}/></Button>
                  <Button variant="warning" size="md" onClick={handleLogicCorrection} title="扫描所有章节，修复逻辑漏洞"><BrainCircuit size={18}/></Button>
              </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-lg border border-indigo-100 shadow-sm">
              <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-700 block">单次生成数量 (Batch Size)</label>
                  <div className="flex gap-2">
                      {[20, 50, 100].map(size => ( <button key={size} onClick={() => setBatchSize(size)} className={`flex-1 py-3 rounded-lg border text-sm font-bold transition-all ${batchSize === size ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>{size} 章</button> ))}
                  </div>
              </div>
              <div className="space-y-4">
                  <div className="flex justify-between items-end">
                      <label className="text-sm font-bold text-slate-700">剧情推进进度</label>
                      <span className="text-sm font-bold text-indigo-600">目标: {Math.min(100, currentProgress + actualIncrement)}%</span>
                  </div>
                  <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                      <div className="h-full bg-emerald-500" style={{ width: `${currentProgress}%` }} />
                      <div className="h-full bg-indigo-500 relative" style={{ width: `${actualIncrement}%` }}><div className="absolute inset-0 bg-white/20" style={{backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem'}}/></div>
                  </div>
                  <input type="range" min="1" max={Math.max(1, remainingProgress)} step="1" value={actualIncrement} disabled={remainingProgress <= 0} onChange={(e) => setPlotIncrement(parseInt(e.target.value))} className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
              </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {/* Cast Management */}
             <div className="bg-white p-6 rounded-lg border border-indigo-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-100 p-3 rounded-full text-indigo-600"><Users size={24}/></div>
                    <div>
                        <h4 className="font-bold text-slate-800">登场角色</h4>
                        <p className="text-xs text-slate-500">活跃: <span className="font-bold text-indigo-600">{activeCastIds.length}</span> 人</p>
                    </div>
                </div>
                <Button onClick={() => setShowCastModal(true)} variant="secondary" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-2 py-1"><FolderOpen size={16}/></Button>
             </div>

             {/* Milestones Inbox (Integrated) */}
             <div className="bg-white p-6 rounded-lg border border-indigo-100 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <Inbox size={20} className="text-amber-500"/>
                        <h4 className="font-bold text-slate-800">剧情节点收纳筐</h4>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-slate-100 rounded px-2 gap-1" title="预计总章数">
                            <span className="text-[10px] text-slate-400">总章</span>
                            <input 
                                className="w-10 bg-transparent text-xs font-bold outline-none text-center" 
                                value={totalChaptersEst} 
                                onChange={e => setTotalChaptersEst(parseInt(e.target.value) || 300)}
                            />
                        </div>
                        <Button onClick={handleGenerateMilestones} variant="ghost" className="text-xs text-indigo-600 p-1 hover:bg-indigo-50"><Sparkles size={14} className="inline mr-1"/>提取</Button>
                    </div>
                </div>
                <div className="flex-1 min-h-[80px] max-h-[120px] overflow-y-auto custom-scrollbar bg-slate-50 rounded border border-slate-100 p-2 space-y-2">
                     {(!project.architecture.keyMilestones || project.architecture.keyMilestones.length === 0) ? (
                         <div className="text-center text-xs text-slate-400 py-4">暂无待办节点</div>
                     ) : (
                         project.architecture.keyMilestones.map(m => (
                            <div key={m.id} className="bg-white p-2 rounded border text-xs flex justify-between items-center shadow-sm group">
                                <span className="truncate flex-1 font-bold text-slate-700" title={m.description}>
                                   [{m.type === 'dungeon' ? '副本' : m.type === 'sect' ? '宗门' : m.type === 'location' ? '换地图' : '成长'}] {m.name}
                                   <span className="text-slate-400 font-normal ml-2 text-[10px]">({m.expectedChapterRange})</span>
                                </span>
                                <button onClick={() => deleteMilestone(m.id)} className="text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100"><X size={12}/></button>
                            </div>
                         ))
                     )}
                </div>
             </div>
          </div>

          <div className="flex justify-center">
              <Button variant="thinking" size="lg" onClick={generateChapters} className="w-full md:w-2/3 py-4 shadow-lg text-lg font-bold tracking-wide" disabled={remainingProgress <= 0 && !confirm}><PlayCircle size={22}/> 生成接下来的 {batchSize} 章</Button>
          </div>
      </div>

      {/* Chapters List */}
      <div className="space-y-4">
          <div className="flex items-center justify-between pl-2">
              <h3 className="font-bold text-slate-700 text-lg">已生成章节 ({project.chapters.length})</h3>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-bold">总进度: {currentProgress}%</span>
          </div>
          {project.chapters?.map((ch, idx) => {
             const isMilestone = checkMilestoneActive(idx, project.architecture.keyMilestones);
             return (
              <div key={ch.id} className={`bg-white p-6 rounded-xl border flex flex-col gap-4 relative group transition-all hover:shadow-md ${isMilestone ? 'border-red-300 bg-red-50/30 ring-1 ring-red-100' : ''}`}>
                  {isMilestone && (
                      <div className="absolute top-0 left-0 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-br-lg rounded-tl-lg flex items-center gap-1 z-10 shadow-sm">
                          <AlertOctagon size={10}/> 关键剧情节点
                      </div>
                  )}
                  
                  <div className="flex gap-4 items-start mt-2">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 mt-1 text-lg ${isMilestone ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>{idx+1}</div>
                      <div className="flex-1 space-y-3 min-w-0">
                        <input className="font-bold w-full outline-none bg-transparent text-xl border-b border-transparent focus:border-indigo-200 transition-colors text-slate-800" value={ch.title} onChange={e=>{const n=[...project.chapters];n[idx].title=e.target.value;updateProject({...project, chapters:n})}}/>
                        <textarea className="w-full text-base text-slate-600 bg-slate-50 p-4 rounded-lg outline-none resize-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all leading-relaxed" rows={4} value={ch.summary} onChange={e=>{const n=[...project.chapters];n[idx].summary=e.target.value;updateProject({...project, chapters:n})}}/>
                        
                        {/* Writing Guidance Section */}
                        <div className="bg-blue-50/50 rounded-lg p-3 border border-blue-100 flex gap-3 items-start">
                            <PenTool size={16} className="text-blue-500 shrink-0 mt-0.5"/>
                            <div className="flex-1">
                                <span className="text-xs font-bold text-blue-600 block mb-1">写作指导 (Technique)</span>
                                <textarea 
                                    className="w-full text-sm text-slate-600 bg-transparent outline-none resize-none leading-relaxed h-auto" 
                                    rows={2} 
                                    placeholder="AI 将在此处提供针对本章的写作手法建议（如侧面烘托、心理描写等）..."
                                    value={ch.writingGuidance || ""} 
                                    onChange={e=>{const n=[...project.chapters];n[idx].writingGuidance=e.target.value;updateProject({...project, chapters:n})}}
                                />
                            </div>
                        </div>

                      </div>
                      <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={()=>rewriteChapter(idx)} className="p-2 text-indigo-500 bg-indigo-50 rounded-lg hover:bg-indigo-100" title="AI 重写"><RefreshCw size={18}/></button>
                          <button onClick={() => deleteChapter(idx)} className="p-2 text-red-400 hover:bg-red-50 rounded-lg" title="删除"><Trash2 size={18}/></button>
                      </div>
                  </div>
                  <div className="flex justify-center h-0">
                     <button onClick={() => insertChapter(idx)} className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm transform translate-y-3 z-10 hover:border-indigo-300 cursor-pointer hover:shadow-md hover:-translate-y-0.5"><ArrowDownCircle size={14}/> 在此处插入新章</button>
                  </div>
              </div>
             );
          })}
          {project.chapters.length === 0 && <div className="text-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50"><p>暂无章节，请在上方控制台配置并生成。</p></div>}
      </div>

      {project.chapters?.length > 0 && (
          <div className="flex justify-center pb-8 pt-4">
            <Button size="lg" variant="success" className="w-full md:w-auto shadow-lg px-12 py-4 text-lg" onClick={()=>{ updateProject({...project, currentStep:3}); setActiveStep(3); }}>进入正文写作 <ChevronRight size={20}/></Button>
          </div>
      )}
      
      {/* Modals - (Preserved existing modals) */}
      <Modal isOpen={showCastModal} onClose={() => setShowCastModal(false)} title="登场角色选择">
        <div className="flex flex-col h-[60vh]">
            <div className="flex justify-between items-center mb-4 pb-4 border-b">
                <span className="text-sm text-slate-500">请勾选将在 <span className="font-bold text-indigo-600">接下来的 {batchSize} 章</span> 中登场的角色。</span>
                <div className="flex gap-2"><Button size="sm" variant="thinking" onClick={handleSmartCastSelection}>AI 智能选择</Button><Button size="sm" variant="ghost" onClick={selectAllCast}>全选</Button><Button size="sm" variant="ghost" onClick={clearCast}>清空</Button></div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                {project.characterList.map(char => (
                    <div key={char.id} onClick={() => toggleCast(char.id)} className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer transition-all ${activeCastIds.includes(char.id) ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${activeCastIds.includes(char.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}`}>{activeCastIds.includes(char.id) && <Check size={14} className="text-white"/>}</div>
                        <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="font-bold text-sm truncate">{char.name}</span><span className="text-[10px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-500">{char.role}</span></div></div>
                    </div>
                ))}
            </div>
            <div className="pt-4 border-t flex justify-end"><Button onClick={() => setShowCastModal(false)}>确认 ({activeCastIds.length})</Button></div>
        </div>
      </Modal>

      <Modal isOpen={showLogicModal} onClose={() => setShowLogicModal(false)} title="逻辑纠正器">
        <div className="flex flex-col h-[70vh]">
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 flex justify-between items-center">
                <div><p className="font-bold text-amber-900">检测到 {logicIssues.length} 处问题</p></div>
                <Button variant="success" onClick={applyAllFixes}><Check size={18}/> 一键修复</Button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                {logicIssues.map((issue, idx) => (
                    <div key={idx} className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-2"><h4 className="font-bold text-slate-800">第 {issue.chapterIndex + 1} 章: {issue.title}</h4></div>
                        <div className="mb-3 text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded inline-block">问题: {issue.reason}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm"><div className="bg-slate-50 p-3 rounded opacity-70"><div className="text-xs font-bold mb-1">原文</div>{issue.oldSummary}</div><div className="bg-emerald-50 p-3 rounded"><div className="text-xs font-bold mb-1 text-emerald-600">建议修改</div>{issue.newSummary}</div></div>
                    </div>
                ))}
            </div>
        </div>
      </Modal>
    </div>
  );
};
