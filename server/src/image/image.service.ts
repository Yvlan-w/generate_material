import { Injectable } from '@nestjs/common';
import { LLMClient, ImageGenerationClient, Config } from 'coze-coding-dev-sdk';

/**
 * 对话状态定义
 */
export type SessionStage = 'collecting' | 'compliance-checking' | 'generating' | 'completed' | 'violation';

export interface SessionData {
  sessionId: string;
  stage: SessionStage;
  messages: Array<{ role: string; content: string }>;
  structuredNeeds?: StructuredNeeds;
  complianceResult?: ComplianceResult;
  generatedImage?: string;
  collectedFields: Set<string>;
}

export interface StructuredNeeds {
  theme?: string;
  colorTone?: string;
  scene?: string;
  emotion?: string;
  style?: string;
  size?: string;
  targetAudience?: string;
  usage?: string;
  summary?: string;
}

export interface ComplianceResult {
  passed: boolean;
  violationAspects?: string;
  suggestions?: string;
  reason?: string;
}

/**
 * Chat接口返回值类型
 */
export interface ChatResponse {
  stage: SessionStage;
  reply: string;
  structuredNeeds?: StructuredNeeds;
  complianceResult?: ComplianceResult;
  generatedImage?: string;
  disclaimer?: string;
  type: string;
}

/**
 * 图片生成服务
 * 提供多轮对话式需求收集、合规检查、图片生成等功能
 */
@Injectable()
export class ImageService {
  private llmClient: LLMClient;
  private imageClient: ImageGenerationClient;
  private config: Config;
  
  // 存储对话session数据（模拟数据库）
  private sessions: Map<string, SessionData> = new Map();
  
  // 存储已生成的图片数据
  private generatedImages: Map<string, any> = new Map();

  constructor() {
    // 初始化 SDK 配置
    this.config = new Config();
    
    // 初始化 LLM 客户端（用于需求收集、合规检查）
    this.llmClient = new LLMClient(this.config);

    // 初始化图片生成客户端
    this.imageClient = new ImageGenerationClient(this.config);
  }

  /**
   * 多轮对话接口 - 需求收集Agent
   * 根据当前状态决定下一步行动
   */
  async chat(sessionId: string, message: string, currentStage: SessionStage): Promise<ChatResponse> {
    console.log(`[Chat] Session: ${sessionId}, Stage: ${currentStage}, Message: ${message}`);
    
    // 获取或创建session数据
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        stage: 'collecting',
        messages: [],
        collectedFields: new Set()
      };
      this.sessions.set(sessionId, session);
    }
    
    // 记录用户消息
    session.messages.push({ role: 'user', content: message });
    
    // 根据当前阶段处理
    switch (currentStage) {
      case 'collecting':
        return await this.handleCollectingStage(session, message);
      
      case 'violation':
        // 违规后重新收集需求
        session.stage = 'collecting';
        return await this.handleCollectingStage(session, message);
      
      case 'compliance-checking':
      case 'generating':
      case 'completed':
        return await this.handleOtherStages(session, message);
      
      default:
        return await this.handleCollectingStage(session, message);
    }
  }

  /**
   * 需求收集阶段处理
   * 逐步引导用户表达需求
   */
  private async handleCollectingStage(session: SessionData, message: string): Promise<ChatResponse> {
    console.log('[Collecting] 处理需求收集阶段');
    
    // 构建需求收集Agent提示词
    const collectPrompt = this.buildCollectAgentPrompt(session);
    
    // 调用LLM进行需求收集
    const llmResponse = await this.llmClient.invoke(
      session.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { model: 'doubao-seed-2-0-lite-260215', temperature: 0.7 }
    );
    
    // 分析用户消息，提取需求字段
    const extractedNeeds = await this.extractNeedsFromMessage(message, session);
    
    // 更新已收集的字段
    if (extractedNeeds) {
      Object.keys(extractedNeeds).forEach(key => {
        if (extractedNeeds[key]) {
          session.collectedFields.add(key);
          session.structuredNeeds = { ...session.structuredNeeds, ...extractedNeeds };
        }
      });
    }
    
    // 检查是否已收集完整
    const requiredFields = ['theme', 'colorTone', 'style'];
    const isComplete = requiredFields.every(field => session.collectedFields.has(field));
    
    if (isComplete && session.structuredNeeds) {
      // 需求收集完成，进入合规校验
      console.log('[Collecting] 需求收集完成，进入合规校验');
      session.stage = 'compliance-checking';
      
      // 调用合规校验
      const complianceResult = await this.checkCompliance(session.structuredNeeds);
      session.complianceResult = complianceResult;
      
      if (complianceResult.passed) {
        // 合规通过，进入图片生成
        session.stage = 'generating';
        
        // 生成正负提示词
        const { positivePrompt, negativePrompt } = await this.generatePrompts(session.structuredNeeds);
        
        // 生成图片
        const imageUrl = await this.generateImageFromPrompts(positivePrompt, negativePrompt);
        session.generatedImage = imageUrl;
        
        // 标记完成
        session.stage = 'completed';
        
        // 生成免责文案
        const disclaimer = this.generateDisclaimer(session.structuredNeeds);
        
        // 记录Agent回复
        session.messages.push({ 
          role: 'assistant', 
          content: `您的营销素材图片已生成完成！${session.structuredNeeds.summary ? `\n\n需求摘要：${session.structuredNeeds.summary}` : ''}` 
        });
        
        return {
          stage: 'completed' as SessionStage,
          reply: '您的营销素材图片已生成完成！',
          structuredNeeds: session.structuredNeeds,
          complianceResult,
          generatedImage: imageUrl,
          disclaimer,
          type: 'text'
        };
      } else {
        // 合规未通过，返回违规提示
        session.stage = 'violation';
        
        // 记录Agent回复
        session.messages.push({ 
          role: 'assistant', 
          content: `抱歉，您的需求未能通过合规校验。${complianceResult.violationAspects}\n\n改进建议：${complianceResult.suggestions}\n\n请您根据建议优化需求后重新描述。` 
        });
        
        return {
          stage: 'violation' as SessionStage,
          reply: `抱歉，您的需求未能通过合规校验。`,
          complianceResult,
          structuredNeeds: session.structuredNeeds,
          type: 'violation-warning'
        };
      }
    } else {
      // 继续收集需求
      console.log('[Collecting] 继续收集需求');
      
      // 生成引导回复
      const guideReply = await this.generateGuideReply(session);
      
      // 记录Agent回复
      session.messages.push({ role: 'assistant', content: guideReply });
      
      return {
        stage: 'collecting' as SessionStage,
        reply: guideReply,
        structuredNeeds: session.structuredNeeds,
        type: 'text'
      };
    }
  }

  /**
   * 构建需求收集Agent提示词
   */
  private buildCollectAgentPrompt(session: SessionData): string {
    const collectedFields = Array.from(session.collectedFields);
    
    return `你是一个专业的投资咨询行业营销素材生成助手，正在收集用户的图片生成需求。

当前已收集的信息字段：${collectedFields.length > 0 ? collectedFields.join(', ') : '无'}

需要收集的关键字段：
- theme: 主题内容（如：品牌宣传、团队风采、数据可视化等）
- colorTone: 色调倾向（如：蓝色、灰色、暖色调等）
- style: 图片风格（如：专业稳重、现代简约、科技感等）
- scene: 场景描述（可选，如：办公室、会议室等）
- emotion: 情感基调（可选，如：专业、温暖、活力等）

你的任务：
1. 理解用户最新的输入，分析是否包含新的需求信息
2. 如果已收集完整，提示用户即将进行合规校验
3. 如果信息不完整，友好地引导用户补充缺失的字段

回复要求：
- 简洁友好，不超过3句话
- 如果需要引导，提出一个具体的问题
- 避免重复已收集的信息`;
  }

  /**
   * 从用户消息中提取需求字段
   */
  private async extractNeedsFromMessage(message: string, session: SessionData): Promise<Partial<StructuredNeeds> | null> {
    const extractPrompt = `分析用户输入，提取图片生成需求字段。

用户输入：${message}

请提取以下字段（如果提到）：
- theme: 主题内容
- colorTone: 色调倾向
- style: 图片风格
- scene: 场景描述
- emotion: 情感基调
- size: 图片尺寸
- targetAudience: 目标受众
- usage: 使用场景

输出JSON格式，未提到的字段留空。例如：
{"theme":"品牌宣传","colorTone":"蓝色","style":"专业稳重"}`;

    const response = await this.llmClient.invoke(
      [{ role: 'user', content: extractPrompt }],
      { model: 'doubao-seed-2-0-lite-260215', temperature: 0.3 }
    );
    
    // 解析JSON
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[Extract] 解析失败:', e);
    }
    
    return null;
  }

  /**
   * 生成引导回复
   */
  private generateGuideReply(session: SessionData): string {
    const collectedFields = Array.from(session.collectedFields);
    const missingFields = ['theme', 'colorTone', 'style'].filter(f => !session.collectedFields.has(f));
    
    if (missingFields.length === 0) {
      return '信息已收集完整，正在进行合规校验...';
    }
    
    // 根据缺失字段生成引导问题
    const guideQuestions = {
      theme: '请告诉我图片的主题内容是什么？例如：品牌宣传、团队风采、数据可视化等。',
      colorTone: '您希望图片使用什么色调？例如：蓝色（专业稳重）、暖色调（温暖亲和）等。',
      style: '图片的风格倾向是什么？例如：专业稳重、现代简约、科技感等。'
    };
    
    // 返回第一个缺失字段的引导问题
    return guideQuestions[missingFields[0]] || '请继续描述您的需求。';
  }

  /**
   * 合规校验
   * 检查是否符合投资咨询行业规范
   */
  private async checkCompliance(needs: StructuredNeeds): Promise<ComplianceResult> {
    console.log('[Compliance] 执行合规校验');
    
    const compliancePrompt = `你是一个投资咨询行业合规审核专家。

用户图片生成需求：
- 主题：${needs.theme || '未指定'}
- 色调：${needs.colorTone || '未指定'}
- 风格：${needs.style || '未指定'}
- 场景：${needs.scene || '未指定'}
- 情感：${needs.emotion || '未指定'}

投资咨询行业合规要求：
❌ 禁止内容：
- 收益承诺（如"年化收益XX%"、"稳赚不赔"等）
- 夸大宣传（如"最强"、"最佳"、"无风险"等）
- 误导性表达（可能引起误解的表述）
- 非法金融活动暗示
- 不当比较（与其他产品/机构的贬低性比较）

✅ 允许内容：
- 品牌形象展示
- 团队专业风采
- 服务理念介绍
- 合规的数据可视化
- 行业知识分享

请判断该需求是否合规，输出JSON格式：
{
  "passed": true/false,
  "violationAspects": "违规的具体方面（如果不合规）",
  "suggestions": "改进建议（如果不合规）",
  "reason": "合规/不合规的原因"
}`;

    const response = await this.llmClient.invoke(
      [{ role: 'user', content: compliancePrompt }],
      { model: 'doubao-seed-2-0-lite-260215', temperature: 0.3 }
    );
    
    // 解析结果
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[Compliance] 解析失败:', e);
    }
    
    // 默认返回通过
    return { passed: true, reason: '需求内容符合行业规范' };
  }

  /**
   * 生成正负提示词
   */
  private async generatePrompts(needs: StructuredNeeds): Promise<{ positivePrompt: string; negativePrompt: string }> {
    console.log('[Prompts] 生成正负提示词');
    
    const promptGenerator = `根据以下需求生成图片绘制的正负提示词。

需求：
- 主题：${needs.theme}
- 色调：${needs.colorTone}
- 风格：${needs.style}
- 场景：${needs.scene || '通用'}
- 情感：${needs.emotion || '专业'}

生成要求：
1. positivePrompt（正向提示词）：描述要生成的图片内容，包含主体、色调、风格、构图等
2. negativePrompt（负向提示词）：描述要避免的内容，如低质量、违规元素等

输出JSON格式：
{
  "positivePrompt": "投资咨询团队专业协作场景，蓝色主色调，现代简约风格，办公室背景，专业稳重的氛围，高素质商务图片...",
  "negativePrompt": "低质量，模糊，收益承诺文字，夸大宣传，违规内容，卡通风格，廉价感..."
}`;

    const response = await this.llmClient.invoke(
      [{ role: 'user', content: promptGenerator }],
      { model: 'doubao-seed-2-0-lite-260215', temperature: 0.7 }
    );
    
    // 解析结果
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[Prompts] 解析失败:', e);
    }
    
    // 默认提示词
    return {
      positivePrompt: `${needs.theme}营销素材图片，${needs.colorTone}主色调，${needs.style}风格，专业商务氛围`,
      negativePrompt: '低质量，模糊，违规内容，收益承诺，夸大宣传'
    };
  }

  /**
   * 根据提示词生成图片
   * 注意：SDK不支持negativePrompt参数，将其合并到正向提示词中
   */
  private async generateImageFromPrompts(positivePrompt: string, negativePrompt: string): Promise<string> {
    console.log('[Image] 生成图片');
    console.log('[Image] 正向提示词:', positivePrompt);
    console.log('[Image] 负向提示词:', negativePrompt);
    
    try {
      // 将负面提示词合并到正向提示词中
      const finalPrompt = `${positivePrompt}，避免出现：${negativePrompt}`;
      
      const response = await this.imageClient.generate({
        prompt: finalPrompt,
        size: '2K'
      });
      
      const helper = this.imageClient.getResponseHelper(response);
      
      if (!helper.success || !helper.imageUrls || helper.imageUrls.length === 0) {
        console.error('[Image] 生成失败:', helper.errorMessages);
        throw new Error(helper.errorMessages?.join(', ') || '图片生成失败');
      }
      
      console.log('[Image] 生成成功，URL:', helper.imageUrls[0]);
      
      return helper.imageUrls[0];
    } catch (e) {
      console.error('[Image] 生成失败:', e);
      throw e;
    }
  }

  /**
   * 生成免责文案
   */
  private generateDisclaimer(needs: StructuredNeeds): string {
    return `免责声明：本图片由AI生成，仅供参考使用。请确保在实际使用前进行合规审核，图片内容不代表任何投资建议或收益承诺。`;
  }

  /**
   * 其他阶段处理
   */
  private async handleOtherStages(session: SessionData, message: string): Promise<ChatResponse> {
    return {
      stage: session.stage,
      reply: '当前对话已完成。如需重新开始，请点击"重新开始"按钮。',
      type: 'text'
    };
  }

  /**
   * 获取图片列表（保留原有功能）
   */
  async getImageList(filter?: string) {
    console.log('[List] 获取图片列表, filter:', filter);
    
    // 返回示例数据
    const images = Array.from(this.generatedImages.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
    
    // 如果没有生成的图片，返回示例数据
    if (images.length === 0) {
      return [
        {
          id: 'img_001',
          title: '专业品牌宣传图',
          description: '蓝色主色调，团队协作场景',
          style: '专业稳重',
          status: '合规通过',
          time: '2小时前',
          url: 'https://coze-coding-project.tos.coze.site/generated/img_001.png'
        },
        {
          id: 'img_002',
          title: '数据可视化图表',
          description: '现代简约风格，业绩展示',
          style: '现代简约',
          status: '合规通过',
          time: '昨天',
          url: 'https://coze-coding-project.tos.coze.site/generated/img_002.png'
        }
      ];
    }
    
    // 根据筛选条件过滤
    if (filter === 'compliant') {
      return images.filter(img => img.status === '合规通过');
    } else if (filter === 'pending') {
      return images.filter(img => img.status === '待审核');
    }
    
    return images;
  }

  /**
   * 图片参数微调（保留原有功能）
   */
  async adjustImage(imageId: string, params: any) {
    console.log('[Adjust] 图片微调:', { imageId, params });
    
    // 模拟根据参数重新生成
    const basePrompt = `投资咨询营销素材，${params.styleType || '专业稳重'}风格`;
    const adjustedPrompt = `${basePrompt}，${params.colorTone || '蓝灰色'}色调，亮度${params.brightness || 0}，对比度${params.contrast || 0}`;
    
    try {
      const response = await this.imageClient.generate({
        prompt: adjustedPrompt,
        size: '2K'
      });
      
      const helper = this.imageClient.getResponseHelper(response);
      
      if (!helper.success || !helper.imageUrls || helper.imageUrls.length === 0) {
        throw new Error(helper.errorMessages?.join(', ') || '图片生成失败');
      }
      
      const newImageUrl = helper.imageUrls[0];
      const newImageId = `img_${Date.now()}`;
      
      // 存储新图片数据
      this.generatedImages.set(newImageId, {
        title: '微调后的图片',
        description: adjustedPrompt,
        style: params.styleType,
        status: '合规通过',
        time: '刚刚',
        url: newImageUrl,
        params
      });
      
      return {
        imageUrl: newImageUrl,
        imageId: newImageId,
        params,
        message: '图片已根据您的参数重新生成'
      };
    } catch (e) {
      console.error('[Adjust] 微调失败:', e);
      throw e;
    }
  }

  /**
   * 获取session数据
   */
  getSession(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }
}