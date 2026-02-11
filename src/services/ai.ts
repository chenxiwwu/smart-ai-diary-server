import { GoogleGenAI } from '@google/genai';

export const generateMyDaySummary = async (contentDescription: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error('API_KEY not configured');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `你是一个擅长捕捉生活细节的日记助手。请根据用户今天的记录，生成一句"今日总结"。

要求：
1. 不超过25个字
2. 不要面面俱到，抓住最能代表今天的一个记忆点或情绪点
3. 语言风格随内容自由发挥：可以幽默吐槽、温暖治愈、文艺感性、或犀利点评
4. 像朋友聊天一样自然，不要官方和套话
5. 只返回总结文字本身，不要加引号、标点符号结尾、或任何解释

用户今日记录：
${contentDescription}`,
  });

  return response.text?.trim().slice(0, 30) || '今天也是平凡又特别的一天';
};

export const generateInsight = async (entryInsight: string, userPrompt: string): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error('API_KEY not configured');
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Based on the user's diary entry and their question, provide thoughtful insight or reflection.
Keep your response concise and meaningful (max 100 Chinese characters).

User's entry insight: ${entryInsight || 'None provided'}
User's question: ${userPrompt}`,
  });

  return response.text?.trim() || '让我想想...';
};
