
import { GoogleGenAI } from "@google/genai";
import { LLMConfig, LLMProvider } from "../types";

// Abstract Model IDs used internally by the app
export const GEMINI_MODELS = {
  FLASH: "MODEL_FLASH", // Maps to: Gemini Flash, GPT-4o-mini, DeepSeek V3, Qwen-Plus
  PRO: "MODEL_PRO",     // Maps to: Gemini Pro, GPT-4o, DeepSeek R1, Qwen-Max
  IMAGE: "gemini-2.5-flash-image" // Currently only supports Gemini for Image
};

const PROVIDER_CONFIGS = {
  gemini: {
    name: "Google Gemini",
    baseUrl: "", // Uses SDK
    models: {
      flash: "gemini-3-flash-preview",
      pro: "gemini-3-pro-preview"
    }
  },
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    models: {
      flash: "deepseek-chat",
      pro: "deepseek-reasoner"
    }
  },
  qwen: {
    name: "Aliyun Qwen (DashScope)",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: {
      flash: "qwen-plus",
      pro: "qwen-max"
    }
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    models: {
      flash: "gpt-4o-mini",
      pro: "gpt-4o"
    }
  }
};

// Helper to get settings from LocalStorage
const getSettings = (): LLMConfig => {
  if (typeof window === 'undefined') return { provider: 'gemini', apiKey: '' };
  
  try {
    const stored = localStorage.getItem("llm_settings");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && PROVIDER_CONFIGS[parsed.provider as LLMProvider]) {
        return parsed;
      }
    }
    
    // Migration for legacy key
    const legacyKey = localStorage.getItem("gemini_api_key");
    if (legacyKey) {
      return { provider: 'gemini', apiKey: legacyKey };
    }
  } catch (e) {
    console.warn("Failed to parse settings", e);
  }
  return { provider: 'gemini', apiKey: '' };
};

const safeJsonParse = (text: string) => {
  if (!text) return null;
  try { return JSON.parse(text); } catch (e) {
    try {
      // Clean markdown
      let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(clean);
    } catch (e2) {
      // Find JSON object
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
         try { return JSON.parse(text.substring(start, end + 1)); } catch (e3) {
            // Find JSON array
            const startArr = text.indexOf('[');
            const endArr = text.lastIndexOf(']');
            if (startArr !== -1 && endArr !== -1) {
                return JSON.parse(text.substring(startArr, endArr + 1));
            }
         }
      }
    }
  }
  return null;
};

// OpenAI Compatible Call (DeepSeek, Qwen, OpenAI)
const callOpenAICompatible = async (
  settings: LLMConfig, 
  prompt: string, 
  systemInstruction: string, 
  modelId: string, 
  isJson: boolean, 
  temperature: number
): Promise<string> => {
  const providerDef = PROVIDER_CONFIGS[settings.provider as keyof typeof PROVIDER_CONFIGS] || PROVIDER_CONFIGS.openai;
  let rawBaseUrl = settings.baseUrl || providerDef.baseUrl;
  
  if (!rawBaseUrl) {
    throw new Error(`未找到厂商 ${settings.provider} 的基础地址。`);
  }
  
  // Sanitize URL
  const baseUrl = rawBaseUrl.trim().endsWith('/') ? rawBaseUrl.trim().slice(0, -1) : rawBaseUrl.trim();
  
  let actualModel = modelId;
  if (modelId === GEMINI_MODELS.FLASH) actualModel = providerDef.models.flash;
  if (modelId === GEMINI_MODELS.PRO) actualModel = providerDef.models.pro;

  const body: any = {
    model: actualModel,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content: prompt }
    ],
    temperature: temperature,
    stream: false
  };

  if (isJson && settings.provider !== 'deepseek') {
    body.response_format = { type: "json_object" };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey.trim()}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`API 响应错误 (${resp.status}): ${err || '无详细内容'}`);
    }

    const data = await resp.json();
    let content = data.choices?.[0]?.message?.content || "";
    
    // DeepSeek R1 <think> tag stripping
    if (settings.provider === 'deepseek' && content.includes('</think>')) {
      content = content.split('</think>')[1].trim();
    }

    return content;
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error("请求超时，请检查网络连接或尝试更换 Base URL。");
    }
    if (e.message === 'Failed to fetch') {
      throw new Error("请求失败 (Failed to fetch)。这通常是由于浏览器跨域 (CORS) 限制导致的。如果您使用的是官方 API 地址，浏览器可能会阻止请求。建议在设置中使用支持跨域的代理地址 (Base URL)。");
    }
    throw e;
  }
};

// Google GenAI Call
const callGoogleGenAI = async (
  apiKey: string, 
  prompt: string, 
  systemInstruction: string, 
  modelId: string, 
  isJson: boolean, 
  temperature: number
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });
    
    let actualModel = modelId;
    if (modelId === GEMINI_MODELS.FLASH) actualModel = PROVIDER_CONFIGS.gemini.models.flash;
    if (modelId === GEMINI_MODELS.PRO) actualModel = PROVIDER_CONFIGS.gemini.models.pro;

    const config: any = { 
      temperature,
      systemInstruction: systemInstruction,
    };
    if (isJson) config.responseMimeType = "application/json";

    const response = await ai.models.generateContent({
      model: actualModel,
      contents: prompt,
      config: config,
    });

    const text = response.text;
    if (!text) throw new Error("API 返回了空内容。");
    return text;
  } catch (e: any) {
    console.error("Gemini SDK Error:", e);
    if (e.message?.includes('Failed to fetch')) {
        throw new Error("Gemini 请求失败。请检查您的网络是否可以访问 Google 服务（通常需要特殊网络环境）。");
    }
    throw new Error(`Gemini 错误: ${e.message}`);
  }
};

// Main Export Function
export const callGemini = async (
  prompt: string, 
  systemInstruction: string, 
  isJson: boolean = false, 
  modelId: string = GEMINI_MODELS.FLASH, 
  temperature: number = 0.85
): Promise<string> => {
  
  const settings = getSettings();
  if (!settings.apiKey || !settings.apiKey.trim()) {
    throw new Error("API Key 未配置。请点击右上角设置图标进行配置。");
  }

  if (settings.provider === 'gemini') {
    return callGoogleGenAI(settings.apiKey, prompt, systemInstruction, modelId, isJson, temperature);
  } else {
    return callOpenAICompatible(settings, prompt, systemInstruction, modelId, isJson, temperature);
  }
};

// Image Generation
export const callImageGen = async (prompt: string): Promise<string> => {
  const settings = getSettings();
  
  if (settings.provider !== 'gemini') {
     console.warn("Image generation currently only supports Google Gemini provider.");
     return `https://picsum.photos/seed/${encodeURIComponent(prompt).slice(0, 10)}/512/512`;
  }

  if (!settings.apiKey) return `https://picsum.photos/seed/${encodeURIComponent(prompt).slice(0, 10)}/512/512`;

  try {
    const ai = new GoogleGenAI({ apiKey: settings.apiKey.trim() });
    const response = await ai.models.generateContent({
      model: GEMINI_MODELS.IMAGE,
      contents: prompt,
      config: { imageConfig: { aspectRatio: "1:1" } }
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("未返回图像数据。");
  } catch (e: any) {
    console.error("Image Gen Error:", e);
    return `https://picsum.photos/seed/${encodeURIComponent(prompt).slice(0, 10)}/512/512`;
  }
};

export { safeJsonParse };
