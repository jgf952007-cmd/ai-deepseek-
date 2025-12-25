

export interface Character {
  id: number;
  name: string;
  role: string;
  plotFunction: string; // Specific function like 'Mentor', 'Antagonist'
  traits: string;
  bio: string;
  imageUrl: string;
}

export interface WorldBible {
  time: string;
  location: string;
  rules: string;
  // New detailed settings
  socialStructure?: string; // Politics, Economy, Culture
  powerSystem?: string;     // Realms/Cultivation levels (Auto-generated for Xianxia)
  mapStructure?: string;    // Geopolitics/Map divisions
}

export interface KeyMilestone {
  id: number;
  type: 'dungeon' | 'sect' | 'location' | 'growth' | 'other';
  name: string;
  description: string;
  expectedChapterRange?: string; // e.g. "Ch 10-20"
}

export interface SideQuest {
  id: number;
  title: string;
  location: string; // Map location where it happens
  origin: string; // Cause/Trigger
  process: string; // Brief summary of events
  rewardOrImpact: string; // Character growth, item, or relationship change
  associatedCharacters: string[]; // Names of characters involved
}

export interface Architecture {
  worldBible?: WorldBible;
  mainPlot?: string;
  plotStructure?: string; // New field for detailed structural framework
  sideQuests?: SideQuest[]; // Sub-plots for character development
  timeline?: string;
  keyMilestones?: KeyMilestone[]; // The "Inbox" for plot points
}

export interface Chapter {
  id: number;
  title: string;
  summary: string;
  writingGuidance?: string; // NEW: Writing technique suggestions (e.g. "Focus on side description")
}

export interface ProjectSettings {
  styles: string[];
  tones: string[];
}

export interface Project {
  id: string;
  title: string;
  lastModified: number;
  idea: string;
  currentStep: number;
  plotProgress: number; // 0 to 100, tracks overall story completion
  architecture: Architecture;
  characterList: Character[];
  chapters: Chapter[];
  content: Record<number, string>; // Chapter ID -> Content
  summaries?: Record<number, string>; // Legacy per-10-chapter summaries
  rollingSummary?: string; // NEW: Continuous plot memory for AI reference
  settings: ProjectSettings;
}

export interface MimicrySettings {
  active: boolean;
  name: string;
  customStylePrompt?: string; // AI-analyzed style instruction from imported documents
}

// --- LLM Settings Types ---
export type LLMProvider = 'gemini' | 'deepseek' | 'qwen' | 'openai';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey: string;
  baseUrl?: string; // Optional custom base URL for proxies
}

export const GENRES = [
  // Classic / Mainstream
  "穿越", "重生", "系统", "无限流", "修仙", "高武", "末世", "赛博朋克", 
  "克苏鲁", "宫斗", "甜宠", "大女主", "无敌流", "迪化流", "规则怪谈", 
  "穿书", "种田", "悬疑刑侦", "惊悚", "星际", "西幻", "洪荒", "娱乐明星",
  // Romance / Emotion
  "虐恋", "追妻火葬场", "破镜重圆", "替身", "白月光", "青梅竹马", 
  "豪门世家", "先婚后爱", "暗恋", "救赎", "病娇", "团宠", "萌宝",
  // Modern / Urban / Specific Settings
  "校园", "职场", "年代", "玄学", "直播", "电竞", "网游", "美食", 
  "鉴宝", "神医", "古武", "都市异能",
  // Special / Subculture
  "快穿", "女配", "反派", "炮灰逆袭", "马甲", "群像", "双强",
  "ABO", "哨向", "兽世", "灵异", "武侠", "机甲", "废土"
];

export const WRITING_STYLES = [
  "小白文(通俗/快节奏)", "老白文(老练/重逻辑)", "华丽辞藻(唯美)", "极简主义(冷硬)", 
  "史书笔法(厚重)", "轻小说(日系/吐槽)", "意识流(心理)", "古风古韵", "翻译腔", "电影镜头感"
];

export const STORY_TONES = [
  "热血", "悲剧", "喜剧", "煽情/虐心", "悬疑/惊悚", "治愈/温馨", 
  "暗黑/压抑", "轻松/沙雕", "史诗/宏大", "诡异/克系", "现实/讽刺", "甜宠/发糖"
];

export const PRESET_WRITERS = [
  "鲁迅", "金庸", "古龙", "张爱玲", "沈从文", "王小波", "钱钟书",
  "海明威", "加西亚·马尔克斯", "卡夫卡", "J.K.罗琳", "阿加莎·克里斯蒂",
  "洛夫克拉夫特(克苏鲁)", "江南", "猫腻", "乌贼(爱潜水的乌贼)"
];