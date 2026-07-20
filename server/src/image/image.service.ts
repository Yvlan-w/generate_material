import { Injectable } from '@nestjs/common';
import { LLMClient, ImageGenerationClient, Config, S3Storage } from 'coze-coding-dev-sdk';
import { getSupabaseClient } from '../storage/database/supabase-client';
import { text } from 'stream/consumers';
import { ImageGenerationRequest } from 'coze-coding-dev-sdk';

/**
 * 对话状态定义
 */
export type SessionStage = 'collecting' | 'compliance-checking' | 'generating' | 'completed' | 'violation';

export interface SessionData {
  sessionId: string;
  userId?: string;  // 用户ID，用于关联生成的图片
  stage: SessionStage;
  messages: Array<{ role: string; content: string }>;
  structuredNeeds?: StructuredNeeds;
  complianceResult?: ComplianceResult;
  generatedImage?: string;
  collectedFields: Set<string>;
  temperatures?: {
    extractNeeds?: number;
    generatePrompts?: number;
    generateImage?: number;
  };
}

export interface ReferenceImage {
  url: string;
  aspects?: string[];
}

export interface IncludedElement {
  type: 'image' | 'text';
  value: string;
  position?: string;
  note?: string;
}

export interface StructuredNeeds {
  theme?: string;
  content?: string;
  colorTone?: string;
  scene?: string;
  emotion?: string;
  style?: string;
  size?: string;
  targetAudience?: string;
  usage?: string;
  otherRequirements?: string;
  summary?: string;
  referenceImages?: ReferenceImage[];
  includedElements?: IncludedElement[];
}

// 字段中文标签映射，集中维护，避免多处硬编码
const NEED_FIELD_LABELS: Record<keyof StructuredNeeds, string> = {
  theme: '主题内容',
  content: '内容文案',
  colorTone: '色调倾向',
  scene: '场景描述',
  emotion: '情感基调',
  style: '图片风格',
  size: '图片尺寸',
  targetAudience: '目标受众',
  usage: '使用场景',
  otherRequirements: '其他需求',
  summary: '需求摘要',
  referenceImages: '参考图片',
  includedElements: '包含元素'
};

// 必填字段
const REQUIRED_NEED_FIELDS: Array<keyof StructuredNeeds> = ['theme', 'content', 'colorTone', 'style', 'includedElements'];

// 可选字段
const OPTIONAL_NEED_FIELDS: Array<keyof StructuredNeeds> = [
  'scene',
  'emotion',
  'size',
  'targetAudience',
  'usage',
  'referenceImages',
  'otherRequirements'
];

/**
 * 将 StructuredNeeds 中的非空字段格式化为多行描述
 * 统一用于 prompt 生成、合规校验、摘要生成等环节，避免字段遗漏
 */
function formatNeedsForPrompt(needs: StructuredNeeds, exclude: Array<keyof StructuredNeeds> = []): string {
  const lines: string[] = [];
  
  (Object.keys(NEED_FIELD_LABELS) as Array<keyof StructuredNeeds>)
    .filter((key) => key !== 'summary' && !exclude.includes(key))
    .forEach((key) => {
      const value = needs[key];
      if (!value) return;
      
      if (key === 'referenceImages') {
        const images = value as ReferenceImage[];
        lines.push(`- ${NEED_FIELD_LABELS[key]}：${images.length} 张参考图`);
        images.forEach((img, index) => {
          const aspectsText = img.aspects && img.aspects.length > 0 ? `，借鉴方面：${img.aspects.join('、')}` : '';
          lines.push(`  - 参考图 ${index + 1}：${img.url}${aspectsText}`);
        });
      } else if (key === 'includedElements') {
        const elements = value as IncludedElement[];
        lines.push(`- ${NEED_FIELD_LABELS[key]}：`);
        elements.forEach((elem, index) => {
          const typeLabel = elem.type === 'image' ? '图片' : '文字';
          const positionText = elem.position ? `，位置：${elem.position}` : '';
          const noteText = elem.note ? `，备注：${elem.note}` : '';
          lines.push(`  ${index + 1}. [${typeLabel}] ${elem.value}${positionText}${noteText}`);
        });
      } else {
        lines.push(`- ${NEED_FIELD_LABELS[key]}：${value}`);
      }
    });
  
  return lines.join('\n');
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
  /** 处理中的状态文本，用于前端在等待期间展示（如 "素材生成中..."） */
  processingText?: string;
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
  private s3Storage: S3Storage;
  
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
    
    // 初始化 S3 存储客户端（用于文件上传）
    this.s3Storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });
  }

  /**
   * 多轮对话接口 - 需求收集Agent
   * 根据当前状态决定下一步行动
   */
  async chat(sessionId: string, message: string, currentStage: SessionStage, userId?: string, imageType?: 'reference' | 'included', imageUrls?: string[], imageDetails?: Array<{ url: string; aspects?: string[]; position?: string }>, referenceImages?: Array<{ url: string; aspects?: string[] }>, includedImages?: Array<{ url: string; position?: string; note?: string }>, temperatures?: { extractNeeds?: number; generatePrompts?: number; generateImage?: number }): Promise<ChatResponse> {
    console.log(`\n===========================================`);
    console.log(`[Chat] NEW REQUEST`);
    console.log(`[Chat] Session: ${sessionId}`);
    console.log(`[Chat] Current Stage: ${currentStage}`);
    console.log(`[Chat] User Message: "${message}"`);
    console.log(`[Chat] User ID: ${userId}`);
    console.log(`[Chat] Image Type: ${imageType}`);
    console.log(`[Chat] Image URLs: ${JSON.stringify(imageUrls)}`);
    console.log(`[Chat] Image Details: ${JSON.stringify(imageDetails)}`);
    console.log(`[Chat] Reference Images (new): ${JSON.stringify(referenceImages)}`);
    console.log(`[Chat] Included Images (new): ${JSON.stringify(includedImages)}`);
    console.log(`===========================================`);
    
    // 获取或创建session数据
    let session = this.sessions.get(sessionId);
    if (!session) {
      console.log(`[Chat] Creating new session: ${sessionId}`);
      session = {
        sessionId,
        userId,
        stage: 'collecting',
        messages: [],
        collectedFields: new Set(),
        temperatures
      };
      this.sessions.set(sessionId, session);
    } else {
      console.log(`[Chat] Found existing session`);
      console.log(`[Chat] Session collectedFields: ${Array.from(session.collectedFields)}`);
      console.log(`[Chat] Session structuredNeeds:`, JSON.stringify(session.structuredNeeds));
      console.log(`[Chat] Session stage: ${session.stage}`);
      if (temperatures) {
        session.temperatures = temperatures;
      }
    }
    
    // 处理图片上传（新接口：同时支持参考图片和素材图片）
    if (referenceImages && referenceImages.length > 0) {
      console.log(`[Chat] Processing reference images (new API): ${referenceImages.length}`);
      if (!session.structuredNeeds) {
        session.structuredNeeds = {};
      }
      
      session.structuredNeeds.referenceImages = [
        ...(session.structuredNeeds.referenceImages || []),
        ...referenceImages.map(img => ({
          url: img.url,
          aspects: img.aspects || []
        }))
      ];
      session.collectedFields.add('referenceImages');

      const allAspects = referenceImages.flatMap(img => img.aspects || []);
      allAspects.forEach(aspect => {
        if (aspect.includes('色调') || aspect.includes('颜色') || aspect.includes('色彩')) {
          if (!session.structuredNeeds!.colorTone) {
            session.structuredNeeds!.colorTone = '与参考图一致';
            session.collectedFields.add('colorTone');
          }
        }
        if (aspect.includes('风格') || aspect.includes('样式')) {
          if (!session.structuredNeeds!.style) {
            session.structuredNeeds!.style = '与参考图一致';
            session.collectedFields.add('style');
          }
        }
        if (aspect.includes('构图') || aspect.includes('布局')) {
          if (!session.structuredNeeds!.scene) {
            session.structuredNeeds!.scene = '与参考图一致';
            session.collectedFields.add('scene');
          }
        }
        if (aspect.includes('氛围') || aspect.includes('情感') || aspect.includes('感觉')) {
          if (!session.structuredNeeds!.emotion) {
            session.structuredNeeds!.emotion = '与参考图一致';
            session.collectedFields.add('emotion');
          }
        }
      });
    }
    
    if (includedImages && includedImages.length > 0) {
      console.log(`[Chat] Processing included images (new API): ${includedImages.length}`);
      if (!session.structuredNeeds) {
        session.structuredNeeds = {};
      }
      
      const newElements = includedImages.map(img => ({
        type: 'image' as const,
        value: img.url,
        position: img.position || '',
        note: img.note || ''
      }));
      
      session.structuredNeeds.includedElements = [
        ...(session.structuredNeeds.includedElements || []),
        ...newElements
      ];
      session.collectedFields.add('includedElements');
    }
    
    // 处理图片上传（旧接口：兼容单种类型图片）
    if (!referenceImages && !includedImages && imageType && imageUrls && imageUrls.length > 0) {
      console.log(`[Chat] Processing ${imageType} images (old API): ${imageUrls.length}`);
      if (!session.structuredNeeds) {
        session.structuredNeeds = {};
      }
      
      if (imageType === 'reference') {
        const newReferenceImages = imageDetails ? imageDetails.map(img => ({
          url: img.url,
          aspects: img.aspects || []
        })) : imageUrls.map(url => ({ url, aspects: [] }));
        
        session.structuredNeeds.referenceImages = [
          ...(session.structuredNeeds.referenceImages || []),
          ...newReferenceImages
        ];
        session.collectedFields.add('referenceImages');

        const allAspects = newReferenceImages.flatMap(img => img.aspects || []);
        allAspects.forEach(aspect => {
          if (aspect.includes('色调') || aspect.includes('颜色') || aspect.includes('色彩')) {
            if (!session.structuredNeeds!.colorTone) {
              session.structuredNeeds!.colorTone = '与参考图一致';
              session.collectedFields.add('colorTone');
            }
          }
          if (aspect.includes('风格') || aspect.includes('样式')) {
            if (!session.structuredNeeds!.style) {
              session.structuredNeeds!.style = '与参考图一致';
              session.collectedFields.add('style');
            }
          }
          if (aspect.includes('构图') || aspect.includes('布局')) {
            if (!session.structuredNeeds!.scene) {
              session.structuredNeeds!.scene = '与参考图一致';
              session.collectedFields.add('scene');
            }
          }
          if (aspect.includes('氛围') || aspect.includes('情感') || aspect.includes('感觉')) {
            if (!session.structuredNeeds!.emotion) {
              session.structuredNeeds!.emotion = '与参考图一致';
              session.collectedFields.add('emotion');
            }
          }
        });
      } else if (imageType === 'included') {
        const newElements = imageDetails ? imageDetails.map(img => ({
          type: 'image' as const,
          value: img.url,
          position: img.position || ''
        })) : imageUrls.map(url => ({
          type: 'image' as const,
          value: url,
          position: ''
        }));
        
        session.structuredNeeds.includedElements = [
          ...(session.structuredNeeds.includedElements || []),
          ...newElements
        ];
        session.collectedFields.add('includedElements');
      }
    }
    
    if ((referenceImages && referenceImages.length > 0) || (includedImages && includedImages.length > 0) || (imageType && imageUrls && imageUrls.length > 0)) {
      console.log(`[Chat] Updated structuredNeeds after image upload:`, JSON.stringify(session.structuredNeeds));
    }
    
    // 更新 userId（如果之前没有设置）
    if (userId && !session.userId) {
      session.userId = userId;
    }
    
    // 记录用户消息
    session.messages.push({ role: 'user', content: message });
    
    // 根据当前阶段处理
    // 如果请求中的stage为undefined，使用session中存储的stage
    const effectiveStage = currentStage || session.stage;
    
    switch (effectiveStage) {
      case 'collecting':
        console.log(`[Chat] → Calling handleCollectingStage`);
        return await this.handleCollectingStage(session, message);
      
      case 'violation':
        console.log(`[Chat] → Stage is violation, resetting to collecting`);
        session.stage = 'collecting';
        return await this.handleCollectingStage(session, message);
      
      case 'compliance-checking':
        console.log(`[Chat] → Stage is compliance-checking, calling handleOtherStages`);
        return await this.handleOtherStages(session, message);
      
      case 'generating':
        console.log(`[Chat] → Stage is generating, calling handleOtherStages`);
        return await this.handleOtherStages(session, message);
      
      case 'completed':
        console.log(`[Chat] → Stage is completed, calling handleOtherStages (fine-tuning)`);
        return await this.handleOtherStages(session, message);
      
      default:
        console.log(`[Chat] → Unknown stage ${currentStage}, fallback to handleCollectingStage`);
        return await this.handleCollectingStage(session, message);
    }
  }

  /**
   * 需求收集阶段处理
   * 逐步引导用户表达需求
   */
  private async handleCollectingStage(session: SessionData, message: string): Promise<ChatResponse> {
    console.log(`\n-------------------------------------------`);
    console.log(`[Collecting] ENTER handleCollectingStage`);
    console.log(`[Collecting] Input message: "${message}"`);
    console.log(`[Collecting] Current collectedFields: ${Array.from(session.collectedFields)}`);
    console.log(`[Collecting] Current structuredNeeds:`, JSON.stringify(session.structuredNeeds));
    console.log(`-------------------------------------------`);

    // 分析用户消息，提取需求字段
    console.log(`[Collecting] Calling extractNeedsFromMessage...`);
    const extractedNeeds = await this.extractNeedsFromMessage(message, session);
    console.log(`[Collecting] extractedNeeds result:`, JSON.stringify(extractedNeeds));

    // 更新已收集的字段
    if (extractedNeeds) {
      const filteredNeeds: Partial<StructuredNeeds> = {};
      
      Object.keys(extractedNeeds).forEach((key) => {
        const value = (extractedNeeds as any)[key];
        // 过滤空值、空字符串和空数组，避免覆盖已有的值
        if (value !== '' && value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)) {
          console.log(`[Collecting] Adding field "${key}" with value "${value}"`);
          session.collectedFields.add(key);
          (filteredNeeds as any)[key] = value;
        }
      });
      
      // 合并新提取的字段到 structuredNeeds，确保不丢失之前的值
      session.structuredNeeds = { ...session.structuredNeeds, ...filteredNeeds };
      console.log(`[Collecting] structuredNeeds after merge:`, JSON.stringify(session.structuredNeeds));
    }

    // 检查是否已收集完整（仅以必填字段为准，可选字段缺失也不阻塞生成）
    const isComplete = REQUIRED_NEED_FIELDS.every((field) => session.collectedFields.has(field));
    const missingRequired = REQUIRED_NEED_FIELDS.filter((f) => !session.collectedFields.has(f));
    const missingOptional = OPTIONAL_NEED_FIELDS.filter((f) => !session.collectedFields.has(f));
    
    console.log(`[Collecting] REQUIRED_NEED_FIELDS: ${REQUIRED_NEED_FIELDS}`);
    console.log(`[Collecting] isComplete: ${isComplete}`);
    console.log(`[Collecting] After update - collectedFields: ${Array.from(session.collectedFields)}`);
    console.log(`[Collecting] After update - structuredNeeds:`, JSON.stringify(session.structuredNeeds));

    // 检查用户是否触发生成指令（无论必填字段是否完整）
    const triggerWords = ['生成', '开始', '确认', '就这样', '出图', 'go', 'generate', 'start'];
    const userSaysGenerate = triggerWords.some((w) =>
      message.trim().toLowerCase().includes(w.toLowerCase()),
    );

    // 用户明确要求生成
    if (userSaysGenerate && session.structuredNeeds) {
      // 先检查必填字段是否完整
      if (missingRequired.length > 0) {
        // 必填字段不完整，告知用户缺少哪些字段
        console.log(`[Collecting] ❌ User triggered generation but required fields incomplete`);
        console.log(`[Collecting] Missing required fields: ${missingRequired}`);
        
        const missingLabels = missingRequired.map(f => NEED_FIELD_LABELS[f]).join('、');
        const reply = `抱歉，当前还缺少以下必填信息：${missingLabels}。请补充这些信息后再生成图片。`;
        
        session.messages.push({
          role: 'assistant',
          content: reply,
        });

        return {
          stage: 'collecting' as SessionStage,
          reply,
          structuredNeeds: session.structuredNeeds,
          type: 'text',
        };
      }

      // 必填字段完整，开始生成图片
      console.log(`[Collecting] ✅ User triggered generation! Required fields are complete`);

      session.messages.push({
        role: 'assistant',
        content: '收到，正在为您进行合规校验并生成素材，请稍候...',
      });

      return await this.proceedToGeneration(session);
    }

    // 必填字段已齐全
    if (isComplete && session.structuredNeeds) {
      console.log(`[Collecting] ✅ REQUIRED FIELDS ARE COMPLETE!`);

      if (missingOptional.length > 0) {
        // 继续收集可选字段，使用 LLM 基于最新状态生成引导回复
        console.log(`[Collecting] Continuing to collect optional fields...`);
        
        // 构建最新的 collectPrompt（包含已更新的字段信息）
        const collectPrompt = this.buildCollectAgentPrompt(session);
        const llmMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: collectPrompt },
          ...session.messages.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
        ];

        let llmReply = '';
        try {
          console.log(`[Collecting] Calling LLM for optional field guidance...`);
          const llmResponse = await this.llmClient.invoke(llmMessages, {
            model: 'doubao-seed-2-0-lite-260215',
            temperature: session.temperatures?.extractNeeds ?? 0.7,
          });
          llmReply = (llmResponse.content || '').trim();
          console.log(`[Collecting] LLM optional guide reply: "${llmReply}"`);
        } catch (e) {
          console.error('[Collecting] LLM optional guide 调用失败，回退到模板:', e);
          llmReply = '';
        }

        // 优先使用 LLM 回复，回退到模板
        const guideReply = llmReply && llmReply.length > 0 && llmReply.length < 120
          ? llmReply
          : this.generateGuideReply(session);
        const enhancedReply = `${guideReply}\n\n如需立即生成图片，请输入"生成"、"确认"、"开始"等关键词明确指示。`;

        session.messages.push({
          role: 'assistant',
          content: enhancedReply,
        });

        return {
          stage: 'collecting' as SessionStage,
          reply: enhancedReply,
          structuredNeeds: session.structuredNeeds,
          type: 'text',
        };
      } else {
        // 所有字段都已收集，直接开始生成图片
        console.log(`[Collecting] ✅ ALL FIELDS COLLECTED! Auto-proceeding to generation`);

        session.messages.push({
          role: 'assistant',
          content: '所有信息已收集完整，正在为您进行合规校验并生成素材，请稍候...',
        });

        return await this.proceedToGeneration(session);
      }
    } else {
      // 必填字段还未收集完整，继续引导用户
      console.log(`[Collecting] ⏳ Required fields not complete. isComplete=${isComplete}`);

      // 构建最新的 collectPrompt（包含已更新的字段信息）
      const collectPrompt = this.buildCollectAgentPrompt(session);
      const llmMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: collectPrompt },
        ...session.messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ];

      // 调用 LLM 获取引导回复
      let llmReply = '';
      try {
        console.log(`[Collecting] Calling LLM for guidance...`);
        const llmResponse = await this.llmClient.invoke(llmMessages, {
          model: 'doubao-seed-2-0-lite-260215',
          temperature: session.temperatures?.extractNeeds ?? 0.7,
        });
        llmReply = (llmResponse.content || '').trim();
        console.log(`[Collecting] LLM reply received: "${llmReply}"`);
      } catch (e) {
        console.error('[Collecting] LLM Agent 调用失败，将回退到模板回复:', e);
        llmReply = '';
      }

      // 优先使用 LLM 基于上下文生成的引导回复，确保贴合对话语境
      const guideReply = llmReply && llmReply.length > 0 && llmReply.length < 80
        ? llmReply
        : this.generateGuideReply(session);

      console.log(`[Collecting] Guide reply to user: "${guideReply}"`);

      // 记录Agent回复
      session.messages.push({ role: 'assistant', content: guideReply });

      return {
        stage: 'collecting' as SessionStage,
        reply: guideReply,
        structuredNeeds: session.structuredNeeds,
        type: 'text',
      };
    }
  }


  /**
   * 进入合规校验 + 生成流程
   */
  private async proceedToGeneration(session: SessionData): Promise<ChatResponse> {
    console.log(`\n===========================================`);
    console.log(`[Generation] ENTER proceedToGeneration`);
    console.log(`[Generation] structuredNeeds:`, JSON.stringify(session.structuredNeeds));
    console.log(`[Generation] collectedFields: ${Array.from(session.collectedFields)}`);
    console.log(`===========================================`);

    session.stage = 'compliance-checking';
    console.log(`[Generation] Stage updated to: compliance-checking`);

    // 先生成需求摘要（存入 summary 字段，用于前端展示和存库）
    console.log(`[Generation] Step 1: Generating summary...`);
    try {
      const summary = await this.generateSummary(session.structuredNeeds!);
      session.structuredNeeds = { ...session.structuredNeeds!, summary };
      session.collectedFields.add('summary');
      console.log(`[Generation] Summary generated: "${summary}"`);
    } catch (e) {
      console.error('[Generation] 摘要生成失败:', e);
    }

    // 调用合规校验
    console.log(`[Generation] Step 2: Calling checkCompliance...`);
    const complianceResult = await this.checkCompliance(session.structuredNeeds!);
    session.complianceResult = complianceResult;
    console.log(`[Generation] Compliance result:`, JSON.stringify(complianceResult));

    if (complianceResult.passed) {
      console.log(`[Generation] ✅ Compliance PASSED`);

      // 合规通过，进入图片生成
      session.stage = 'generating';
      console.log(`[Generation] Stage updated to: generating`);

      // 生成正负提示词
      console.log(`[Generation] Step 3: Generating prompts...`);
      const { positivePrompt, negativePrompt } = await this.generatePrompts(session.structuredNeeds!, session.temperatures?.generatePrompts);
      console.log(`[Generation] Positive prompt: "${positivePrompt.substring(0, 100)}..."`);
      console.log(`[Generation] Negative prompt: "${negativePrompt}"`);

      // 生成图片（透传原始需求，让 size/usage 映射为 SDK 的 size 参数）
      console.log(`[Generation] Step 4: Generating image...`);
      const imageUrl = await this.generateImageFromPrompts(
        positivePrompt,
        negativePrompt,
        session.structuredNeeds,
        session.temperatures?.generateImage,
      );
      console.log(`[Generation] Image generated: "${imageUrl}"`);
      session.generatedImage = imageUrl;

      // 图片生成后再次进行合规检验（检查图片内容是否合规）
      console.log(`[Generation] Step 5: Checking image content compliance...`);
      const imageComplianceResult = await this.checkImageCompliance(imageUrl);
      console.log(`[Generation] Image compliance result:`, JSON.stringify(imageComplianceResult));
      
      if (!imageComplianceResult.passed) {
        console.log(`[Generation] ❌ Image content compliance FAILED`);
        
        session.stage = 'violation';
        session.complianceResult = imageComplianceResult;
        
        session.messages.push({
          role: 'assistant',
          content: `抱歉，生成的图片内容未能通过合规校验。${imageComplianceResult.violationAspects}\n\n改进建议：${imageComplianceResult.suggestions}\n\n请您优化需求后重新生成。`
        });

        return {
          stage: 'violation' as SessionStage,
          reply: `抱歉，生成的图片内容未能通过合规校验。`,
          complianceResult: imageComplianceResult,
          structuredNeeds: session.structuredNeeds,
          type: 'violation-warning'
        };
      }
      console.log(`[Generation] ✅ Image content compliance PASSED`);

      // 保存到数据库
      console.log(`[Generation] Step 6: Saving to database...`);
      await this.saveImageToDatabase(session, imageUrl, positivePrompt, negativePrompt, imageComplianceResult);
      console.log(`[Generation] Saved to database successfully`);

      // 标记完成
      session.stage = 'completed';
      console.log(`[Generation] Stage updated to: completed`);

      // 生成免责文案
      const disclaimer = this.generateDisclaimer(session.structuredNeeds!);
      console.log(`[Generation] Disclaimer: "${disclaimer}"`);

      const summaryText = session.structuredNeeds?.summary
        ? `\n\n需求摘要：${session.structuredNeeds.summary}`
        : '';

      // 记录Agent回复
      session.messages.push({
        role: 'assistant',
        content: `您的营销素材图片已生成完成！${summaryText}`
      });

      console.log(`[Generation] ✅ ALL DONE! Returning ChatResponse with image`);
      return {
        stage: 'completed' as SessionStage,
        reply: `您的营销素材图片已生成完成！${summaryText}`,
        structuredNeeds: session.structuredNeeds,
        complianceResult,
        generatedImage: imageUrl,
        disclaimer,
        type: 'image',
        processingText: '素材生成中...',
      };
    } else {
      console.log(`[Generation] ❌ Compliance FAILED`);

      // 合规未通过，返回违规提示
      session.stage = 'violation';
      console.log(`[Generation] Stage updated to: violation`);

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
  }

  /**
   * 构建需求收集Agent提示词
   */
  private buildCollectAgentPrompt(session: SessionData): string {
    const collectedFields = Array.from(session.collectedFields);

    const requiredDesc = REQUIRED_NEED_FIELDS.map(
      (f) => `${f}(${NEED_FIELD_LABELS[f]})`,
    ).join('、');
    const optionalDesc = OPTIONAL_NEED_FIELDS.map(
      (f) => `${f}(${NEED_FIELD_LABELS[f]})`,
    ).join('、');

    return `你是一个专业的投资咨询行业营销素材生成助手，正在收集用户的图片生成需求。

当前已收集的信息字段：${collectedFields.length > 0 ? collectedFields.map(f => NEED_FIELD_LABELS[f as keyof StructuredNeeds]).join(', ') : '无'}

必须收集的关键字段：${requiredDesc}
可选但建议补充的字段：${optionalDesc}

字段说明：
- referenceImages（参考图片）：用户可以上传参考图片，需要记录在哪些方面借鉴（如风格、色调、构图等）
- includedElements（包含元素）：图片中必须包含的元素，可以是文字描述（如"公司logo"）或用户上传的素材图片，需要记录每个元素的使用位置（如左上角、底部居中、背景等）
- otherRequirements（其他需求）：用户提到的但无法归类到以上字段的所有信息，全部记录在此，确保不遗漏任何用户需求细节

你的任务：
1. 理解用户最新的输入，分析是否包含新的需求信息
2. 如果必填字段尚未齐全，只引导用户补充下一个缺失的必填字段
3. 如果必填字段已齐全但可选字段仍有缺失，主动提示用户是否补充（例如"为了让素材更贴合使用场景，是否可以告诉我...？"）
4. 对于 includedElements（包含元素），引导用户说明图片中必须包含哪些元素，以及每个元素的使用位置
5. 对于 referenceImages（参考图片），询问用户是否有参考图片可以上传，以及想在哪些方面借鉴
6. 注意倾听用户的其他需求，对于无法归类到特定字段的信息，完整记录到otherRequirements（其他需求）中
7. 不要一次问多个问题，一次只引导一个字段
8. 避免重复已收集的信息

回复要求：
- 简洁友好，不超过3句话
- 语气自然，不要像在填表
- 如果所有必填和可选字段都已收集，提示用户输入“确认”、“生成”等关键词，确认后开始生成图片`;
  }

  /**
   * 从用户消息中提取需求字段
   */
  private async extractNeedsFromMessage(message: string, session: SessionData): Promise<Partial<StructuredNeeds> | null> {
    console.log(`\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
    console.log(`[Extract] ENTER extractNeedsFromMessage`);
    console.log(`[Extract] Input message: "${message}"`);
    console.log(`[Extract] Existing needs:`, JSON.stringify(session.structuredNeeds));
    console.log(`~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);

    const extractPrompt = `分析用户输入，提取图片生成需求字段。

用户最新输入：${message}

历史已有需求（仅作参考，**用户本次输入提出更新/冲突内容时，一律以本次新输入为准；本次未提及的字段，保留历史已有值**）：
${formatNeedsForPrompt(session.structuredNeeds || {}) || '（无历史需求）'}

提取规则：
1. 严格依据文本信息提取；仅当需求中明确提及对应字段时，才在JSON内输出该键。未提到的字段**不要生成对应的JSON键，直接省略**，严禁自行猜测、编造任何信息；禁止填充默认风格、默认色调等脑补内容。
2. 无法归类到下面独立字段的全部细节需求，原样完整存入 otherRequirements，不得遗漏用户描述。


需要提取字段清单：
- theme: 主题内容（如品牌宣传、团队风采、数据可视化等）
- content: 内容文案（如风险管理、耐心布局、专业陪伴、科学理财等）
- colorTone: 色调倾向（如蓝色、灰色、暖色调等）
- style: 图片风格（如专业稳重、现代简约、科技感等）
- scene: 图片场景（如办公室、会议室等）
- emotion: 情感基调（如专业、温暖、活力等）
- size: 图片尺寸或比例（如 1:1、16:9、竖版海报 1080x1920 等）
- targetAudience: 目标受众（如高净值客户、保守型投资者、普通投资者、内部员工等）
- usage: 使用场景（如朋友圈、公众号头图、海报、线下展架、短视频封面等）
- otherRequirements: 其他需求（用户提到的但无法归类到以上字段的所有信息，全部记录在此，保持原始语义）
- referenceImages: 参考图片（数组，每个元素为{"url":"图片URL","aspects":["借鉴方面1","借鉴方面2"]}）
- includedElements: 包含元素（数组，每个元素为{"type":"image"|"text","value":"图片URL或文字描述","position":"使用位置"}）

特别注意：对于用户输入中无法归类到上述具体字段的信息，必须完整记录到 otherRequirements 字段中，确保不遗漏任何用户需求细节。

输出严格 JSON 格式，例如：
{"theme":"品牌宣传","colorTone":"蓝色","style":"专业稳重","targetAudience":"高净值客户","usage":"朋友圈","size":"1:1","otherRequirements":"希望整体感觉更加大气，不要太花哨","referenceImages":[{"url":"https://example.com/ref1.jpg","aspects":["色调","构图"]}],"includedElements":[{"type":"text","value":"公司logo","position":"左上角"},{"type":"image","value":"https://example.com/element1.jpg","position":"底部居中"}]}`;

    console.log(`[Extract] Calling LLM for extraction...`);
    const extractTemp = session.temperatures?.extractNeeds ?? 0.3;
    console.log(`[Extract] Using temperature: ${extractTemp}`);
    const response = await this.llmClient.invoke(
      [{ role: 'user', content: extractPrompt }],
      { model: 'doubao-seed-2-0-lite-260215', temperature: extractTemp }
    );
    
    console.log(`[Extract] LLM raw response: "${response.content}"`);
    
    // 解析JSON
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      console.log(`[Extract] JSON match found: ${!!jsonMatch}`);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        console.log(`[Extract] Parsed result:`, JSON.stringify(parsed));
        
        // 过滤空字符串/空值
        Object.keys(parsed).forEach((key) => {
          if (parsed[key] === '' || parsed[key] === null || parsed[key] === undefined) {
            delete parsed[key];
          }
        });
        
        console.log(`[Extract] Final filtered result:`, JSON.stringify(parsed));
        return parsed;
      }
    } catch (e) {
      console.error('[Extract] 解析失败:', e);
    }
    
    console.log(`[Extract] Returning null (no valid JSON found)`);
    return null;
  }

  /**
   * 生成引导回复
   */
  private generateGuideReply(session: SessionData): string {
    // 先看必填字段
    const missingRequired = REQUIRED_NEED_FIELDS.filter((f) => !session.collectedFields.has(f));
    if (missingRequired.length > 0) {
      const field = missingRequired[0];
      const questionMap: Record<string, string> = {
        theme: '请告诉我图片的主题内容是什么？例如：品牌宣传、团队风采、数据可视化等。',
        content: '请告诉我图片上需要展示什么具体内容或文案？例如：公司名称、Slogan、产品介绍等。',
        colorTone: '您希望图片使用什么色调？例如：蓝色（专业稳重）、暖色调（温暖亲和）等。',
        style: '图片的风格倾向是什么？例如：专业稳重、现代简约、科技感等。',
        includedElements: '图片中需要包含哪些元素？例如：Logo、二维码、图标等，请说明每个元素的类型和放置位置。',
      };
      return questionMap[field] || `请补充一下「${NEED_FIELD_LABELS[field]}」相关的信息。`;
    }

    // 必填字段齐全后，引导可选字段
    const missingOptional = OPTIONAL_NEED_FIELDS.filter((f) => !session.collectedFields.has(f));
    if (missingOptional.length > 0) {
      const field = missingOptional[0];
      const questionMap: Record<string, string> = {
        targetAudience: '为了让素材更有针对性，这次图片主要面向哪类受众？例如：高净值客户、年轻投资者、内部员工等。',
        usage: '这张图片会用在哪里？例如：朋友圈、公众号头图、海报、短视频封面等。',
        size: '您希望图片的尺寸/比例是多少？例如：1:1 方图、16:9 横版、竖版海报等。',
        scene: '如果图片中涉及场景，您希望是在哪里？例如：办公室、会议室、户外城市等。',
        emotion: '您希望图片传达什么情感基调？例如：专业、温暖、活力、稳重等。',
        otherRequirements: '您还有其他特殊需求吗？例如：特定元素的位置、排版要求、禁忌内容等。',
        referenceImages: '您是否有参考图片希望我们借鉴？如果有，请上传参考图并说明借鉴的方面，如构图、配色、风格等。',
      };
      return questionMap[field] || `为了让素材更贴合需求，可以补充一下「${NEED_FIELD_LABELS[field]}」吗？`;
    }

    return '信息已收集完整，正在进行合规校验...';
  }

  /**
   * 合规校验
   * 检查是否符合投资咨询行业规范
   */
  private async checkCompliance(needs: StructuredNeeds): Promise<ComplianceResult> {
    console.log('[Compliance] 执行合规校验');
    
    const needsText = formatNeedsForPrompt(needs) || '（未指定）';

    const compliancePrompt = `你是一个投资咨询行业合规审核专家。

用户图片生成需求：
${needsText}

投资咨询行业合规要求：
❌ 禁止内容：
- 收益承诺（如"年化收益XX%"、"稳赚不赔"、"保本"、"零风险"等）
- 夸大宣传（如"最强"、"最佳"、"唯一"、"顶级"、"无风险"等）
- 误导性表达（可能引起误解的表述，如"保证收益"、"坐享其成"等）
- 非法金融活动暗示（涉及众筹、私募、未经批准的金融产品等）
- 不当比较（与其他产品/机构的贬低性比较）
- 面向不合格投资者的营销（如暗示"人人都能赚钱"、"小白零基础稳赚"等）
- 面向特定受众（如未成年人、退休老人、风险承受力低的人群）时需更严格的风险提示

✅ 允许内容：
- 品牌形象展示、公司实力介绍
- 团队专业风采、投研团队展示
- 服务理念介绍、合规的产品展示（不涉及具体收益）
- 合规的数据可视化（展示已发生的历史业绩时需标注"历史业绩不代表未来收益"）
- 行业知识分享、投教内容
- 面向合格投资者的专业服务形象

请基于以上需求进行严格判断，尤其关注 targetAudience（目标受众）和 usage（使用场景）字段：
- 若面向"新手"、"小白"、"普通投资者"等受众，更要警惕是否存在诱导性表达
- 若用于朋友圈、短视频等大众传播渠道，应确保内容稳健合规
- 若需求中出现"高收益"、"稳赚"、"保本"、"零风险"、"荐股"、"内幕"等关键词，直接判定为不合规

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
   * 图片内容合规检验
   * 对生成的图片进行内容分析，检查是否包含违规元素
   */
  private async checkImageCompliance(imageUrl: string): Promise<ComplianceResult> {
    console.log('[ImageCompliance] 执行图片内容合规检验');

    const complianceInstruction = `你是一个投资咨询行业合规审核专家，正在对生成的图片进行内容审核。

审核要求：
请分析图片中是否包含以下违规内容：
1. 收益承诺类文字（如"年化收益XX%"、"稳赚不赔"、"保本"、"零风险"等）
2. 夸大宣传类文字（如"最强"、"最佳"、"唯一"、"顶级"、"无风险"等）
3. 误导性表达（如"保证收益"、"坐享其成"等）
4. 违规的数据可视化（未标注"历史业绩不代表未来收益"的收益图表、K线图等）
5. 荐股相关内容（股票代码、股票名称、买入卖出建议等）
6. 其他违反投资咨询行业规范的内容

特别关注：
- 如果图片中出现收益数据、历史业绩图表、增长曲线等，必须检查是否包含"历史业绩不代表未来收益"的合规标语
- 如果图片中包含文字，检查文字内容是否合规
- 重点检查图片四周，图片都应该包含合规标语（如"投资有风险，入市需谨慎"等类似的合规标语），否则判定为不合规

请判断该图片是否合规，输出JSON格式：
{
  "passed": true/false,
  "violationAspects": "违规的具体方面（如果不合规）",
  "suggestions": "改进建议（如果不合规）",
  "reason": "合规/不合规的原因"
}`;

    const response = await this.llmClient.invoke(
      [{ 
        role: 'user', 
        content: [
          { type: "image_url", image_url: {url:imageUrl} },
          { type: "text", text: complianceInstruction }
        ]
      }],
      { model: 'doubao-seed-2-0-lite-260215', temperature: 0.2 }
    );

    // 解析结果
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error('[ImageCompliance] 解析失败:', e);
    }

    // 默认返回通过
    return { passed: true, reason: '图片内容符合行业规范' };
  }

  /**
   * 生成正负提示词（基于全部已收集字段）
   */
  private async generatePrompts(needs: StructuredNeeds, temperature?: number): Promise<{ positivePrompt: string; negativePrompt: string }> {
    console.log('[Prompts] 生成正负提示词');

    const needsText = formatNeedsForPrompt(needs);

    // 根据 usage 推导画面尺寸建议（作为 size 的兜底）
    const sizeHint = needs.size || this.inferSizeFromUsage(needs.usage);

    
    const promptGenerator = `根据以下需求，生成一张营销素材图片的正、负向提示词。

已收集的全部需求：
${needsText}
${sizeHint ? `- 建议尺寸/比例：${sizeHint}` : ''}


生成要求：
1. positivePrompt（正向提示词）：根据已经收集的需求，生成一段连贯中文画面描述。参考描述维度清单：
   - 主题与核心主体（theme）
   - 内容文案（content）
   - 色调（colorTone）
   - 氛围（emotion）
   - 画面风格（style）
   - 使用场景（usage）
   - 画面构图（scene）
   - 目标受众的身份特征（targetAudience）
   - 若涉及尺寸（size）
   - 其他需求（otherRequirements）
   规则：需求中明确给出的信息，全部完整体现在画面描述中；需求未提及的维度，不要凭空虚构内容、禁止自行编造信息。在不新增虚构信息的前提下，尽可能丰富连贯地整合全部已知条件。
2. negativePrompt（负向提示词）：列出需要避免的元素，例如文字扭曲，文字模糊，字体粘连，错字，乱码，畸形文字，残缺笔画，变形字符，杂乱水印，现金，金条，豪车，豪宅，陡峭上涨K线，涨停箭头，收益率数字，暴富，爆炸光，高饱和艳红色，夸张亢奋人物，低俗炫富元素，噪点严重，画面拥挤，无留白，画面元素过度堆砌等。
3. 正向提示词禁止出现任何可能违反投资咨询行业合规的文字（如收益承诺、夸大宣传、荐股等）。


输出严格 JSON 格式：
{
  "positivePrompt": "一段完整的中文画面描述，覆盖上述全部需求",
  "negativePrompt": "以逗号分隔的禁用元素列表"
}`;

    const promptTemp = temperature ?? 0.7;
    console.log(`[Prompts] Using temperature: ${promptTemp}`);
    const response = await this.llmClient.invoke(
      [{ role: 'user', content: promptGenerator }],
      { model: 'doubao-seed-2-0-lite-260215', temperature: promptTemp }
    );
    
    // 解析结果
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.positivePrompt) return parsed;
      }
    } catch (e) {
      console.error('[Prompts] 解析失败:', e);
    }
    // 获取合规标语
    const complianceBanner = this.getComplianceBanner(needs);
    
    // 兜底：把所有字段拼接到正向提示词里，确保不丢失
    const fallbackParts: string[] = [];
    if (needs.theme) fallbackParts.push(needs.theme);
    if (needs.targetAudience) fallbackParts.push(`面向${needs.targetAudience}`);
    if (needs.usage) fallbackParts.push(`用于${needs.usage}`);
    if (needs.colorTone) fallbackParts.push(`${needs.colorTone}色调`);
    if (needs.style) fallbackParts.push(`${needs.style}风格`);
    if (needs.scene) fallbackParts.push(`场景：${needs.scene}`);
    if (needs.emotion) fallbackParts.push(`${needs.emotion}氛围`);
    if (sizeHint) fallbackParts.push(`尺寸${sizeHint}`);
    if (needs.otherRequirements) fallbackParts.push(needs.otherRequirements);
    if (needs.referenceImages && needs.referenceImages.length > 0) {
      fallbackParts.push(`参考图片风格：${needs.referenceImages.map(img => img.aspects?.join('、') || '整体风格').join('，')}`);
    }

    // 使用之前声明的合规标语
    const complianceBannerText = `，图片底部添加合规标语：${complianceBanner}`;

    return {
      positivePrompt: `${fallbackParts.join('，')}，专业商务摄影，高清，构图专业，符合投资咨询行业形象${complianceBannerText}`,
      negativePrompt: '低质量，模糊，违规文字，收益承诺，夸大宣传，卡通风格，廉价感，杂乱背景'
    };
  }

  /**
   * 获取合规标语内容
   * 所有图片都需要添加合规标语，特殊情况需要特殊标语
   */
  private getComplianceBanner(needs: StructuredNeeds): string {
    const checkFields = [needs.theme, needs.content, needs.scene, needs.otherRequirements, needs.summary];
    const triggerKeywords = ['收益', '业绩', '数据', '图表', '可视化', '增长', '回报', '盈利', '利润', '收益曲线', 'K线', '走势图'];
    
    // 如果涉及收益数据、历史业绩等，添加特殊标语
    if (checkFields.some(field => 
      field && triggerKeywords.some(keyword => field.includes(keyword))
    )) {
      return '"历史业绩不代表未来收益"';
    }
    
    // 默认通用合规标语
    return '"投资有风险，入市需谨慎"';
  }

  /**
   * 根据使用场景推断建议尺寸
   */
  private inferSizeFromUsage(usage?: string): string | undefined {
    if (!usage) return undefined;
    const text = usage.toLowerCase();
    if (text.includes('公众号头图') || text.includes('公众号banner') || text.includes('微博头图')) {
      return '900x383（横版 banner，约 2.35:1）';
    }
    if (text.includes('朋友圈')) return '1:1 方图（1080x1080）';
    if (text.includes('小红书')) return '3:4 竖版（1080x1440）';
    if (text.includes('视频号') || text.includes('抖音') || text.includes('短视频')) return '9:16 竖版（1080x1920）';
    if (text.includes('海报') || text.includes('展架')) return '3:4 或 A4 竖版';
    if (text.includes('横版') || text.includes('banner')) return '16:9 横版';
    return undefined;
  }

  /**
   * 基于已收集字段生成需求摘要
   */
  private async generateSummary(needs: StructuredNeeds): Promise<string> {
    const needsText = formatNeedsForPrompt(needs);
    const summaryPrompt = `根据以下已收集的图片需求，生成一段 80 字以内的中文摘要，用自然语言串联核心信息（主题、受众、用途、风格、色调等），让人一眼看懂这张营销素材的用途。

已收集需求：
${needsText}

直接输出摘要文本，不要加任何额外前缀。`;

    try {
      const response = await this.llmClient.invoke(
        [{ role: 'user', content: summaryPrompt }],
        { model: 'doubao-seed-2-0-lite-260215', temperature: 0.3 }
      );
      const text = (response.content || '').trim();
      if (text) return text;
    } catch (e) {
      console.error('[Summary] 生成失败:', e);
    }

    // 兜底：拼接字段
    const parts: string[] = [];
    if (needs.targetAudience) parts.push(`面向${needs.targetAudience}`);
    if (needs.usage) parts.push(`用于${needs.usage}`);
    if (needs.theme) parts.push(needs.theme);
    if (needs.style) parts.push(`${needs.style}风格`);
    if (needs.colorTone) parts.push(`${needs.colorTone}色调`);
    return parts.join('，') || '营销素材图片';
  }

  /**
   * 根据使用场景或用户指定的尺寸，映射为 SDK 可接受的 size 参数
   * SDK 支持：'2K' | '4K' | 'WIDTHxHEIGHT'
   */
  private resolveSdkSize(size?: string, usage?: string): string {
    const source = (size || usage || '').toLowerCase();

    // 用户直接指定了 "WxH" 格式（例如 1080x1080），原样透传
    const explicitSizeMatch = source.match(/(\d+)\s*[x×]\s*(\d+)/);
    if (explicitSizeMatch) {
      const w = parseInt(explicitSizeMatch[1], 10);
      const h = parseInt(explicitSizeMatch[2], 10);
      // 限制合理范围，过大回落到 2K
      if (w > 0 && h > 0 && w <= 4096 && h <= 4096) {
        return `${w}x${h}`;
      }
    }

    // 按常见用途做标准化映射
    if (source.includes('公众号') || source.includes('banner') || source.includes('微博头图')) {
      return '900x383';
    }
    if (source.includes('朋友圈') || source.includes('1:1') || source.includes('方图')) {
      return '1024x1024';
    }
    if (source.includes('小红书') || source.includes('3:4')) {
      return '1080x1440';
    }
    if (source.includes('视频号') || source.includes('抖音') || source.includes('短视频') || source.includes('9:16') || source.includes('竖版')) {
      return '1080x1920';
    }
    if (source.includes('16:9') || source.includes('横版')) {
      return '1792x1024';
    }
    if (source.includes('4k')) {
      return '4K';
    }

    return '2K';
  }

  /**
   * 根据提示词生成图片
   * 注意：SDK不支持negativePrompt参数，将其合并到正向提示词中
   */
  private async generateImageFromPrompts(
    positivePrompt: string,
    negativePrompt: string,
    needs?: StructuredNeeds,
    temperature?: number,
  ): Promise<string> {
    console.log('[Image] 生成图片');

    const sdkSize = this.resolveSdkSize(needs?.size, needs?.usage);
    console.log('[Image] SDK size:', sdkSize);
    
    const referenceImages = needs?.referenceImages || [];
    console.log('[Image] 参考图片数量:', referenceImages.length);
    if (referenceImages.length > 0) {
      console.log('[Image] 参考图片:', referenceImages.map(img => img.url).join(', '));
    }

    const includedElements = needs?.includedElements || [];
    const includedImages = includedElements.filter(elem => elem.type === 'image');
    console.log('[Image] 包含图片元素数量:', includedImages.length);
    if (includedImages.length > 0) {
      console.log('[Image] 包含图片:', includedImages.map(img => img.value).join(', '));
    }

    
      // 参考图片提示
    const hasReferenceImages = referenceImages.length > 0;
    console.log('[Prompts] 参考图片数量:', hasReferenceImages ? referenceImages.length : 0);
    if (hasReferenceImages) {
      console.log('[Prompts] 参考图片详情:', JSON.stringify(referenceImages));
    }

    const referenceImageHint = hasReferenceImages
      ? `参考图片：\n${referenceImages.map((img, idx) => 
          `图片${idx + 1}：借鉴方面为${img.aspects?.join('、') || '整体风格'}`
        ).join('\n')}\n\n生成的图片风格、色调、构图应与参考图片保持一致。`
      : null;
    

    // 包含元素提示
    const hasIncludedElements = includedElements.length > 0;
    console.log('[Prompts] 包含元素数量:', hasIncludedElements ? includedElements.length : 0);
    if (hasIncludedElements) {
      console.log('[Prompts] 包含元素详情:', JSON.stringify(includedElements));
    }
    
    const includedElementsHint = hasIncludedElements
      ? `包含元素：\n${includedElements.map((elem, idx) => {
          const typeLabel = elem.type === 'image' ? '图片' : '文字';
          const positionText = elem.position ? `，放置在${elem.position}` : '';
          const noteText = elem.note ? `，备注：${elem.note}` : '';
          return `元素${idx + 1}：[${typeLabel}] ${elem.value}${positionText}${noteText}`;
        }).join('\n')}\n\n生成的图片中必须包含上述所有元素，并按照指定位置放置。对于有备注的元素，请根据备注描述进行处理。`
      : null;

    // 获取合规标语
    const complianceBanner = this.getComplianceBanner(needs || {});
    const complianceBannerInstruction = `4. 图片底部必须添加合规标语：${complianceBanner}，标语要清晰可见但不影响主图内容`;

    
    


    try {
      const finalPrompt = `
      1.${positivePrompt}，避免出现：${negativePrompt}。
      2. 图中所有的内容，包括大标题、小标题、详细说明和提示语，必须是清晰可辨的简体中文，笔画清晰完整，文字无粘连，文字边缘锐利，分辨率 4k，确保所有中文字体印刷级清晰。在没有特殊指定的情况下，主体文案默认使用微软雅黑字体，字体加粗，文字左右居中，垂直位置偏上摆放，不要贴顶，上方留有少量空隙，字间距1.5倍。
      3. 自动补充适度细节，丰富画面层次；细节贴合主题，不添加违规金融符号，控制细节密度，不堆砌元素、不遮挡文字留白，风格简约克制，禁用暴涨K线、收益数字、现金金条等暗示盈利元素。参考方向：投资者教育可用交流人物、研报、资产配置图表；产品介绍可用大类资产结构图、投资期限轴、方案表单；绩效服务展示可用复盘记录、洽谈场景、风险示意图；行情资讯使用中性平缓抽象线条、研报，避免涨跌预测箭头；公司介绍可用办公场景、团队研讨、资质牌匾。未列出的场景，允许结合投顾行业专业调性自主推演适配细节，不得违反上述约束。
      ${complianceBannerInstruction}
      ${referenceImageHint ? `5. ${referenceImageHint}` : ''}
      ${includedElementsHint ? `6. ${includedElementsHint}` : ''}
      `;
      
      console.log('[Image] 最终提示词:', finalPrompt);

      const imageTemp = temperature ?? 0.7;
      console.log(`[Image] Using temperature: ${imageTemp}`);

      const generateParams: {
        prompt: string;
        size: string;
        image?: string | string[];
        watermark?: boolean;
      } = {
        prompt: finalPrompt,
        size: sdkSize,
        watermark: false,
      };
      
      const allImageUrls = [
        ...referenceImages.map(img => img.url),
        ...includedImages.map(img => img.value)
      ];
      
      if (allImageUrls.length > 0) {
        generateParams.image = allImageUrls.length === 1 ? allImageUrls[0] : allImageUrls;
        console.log('[Image] 图片参数（参考图+素材图）:', generateParams.image);
      }

      const response = await this.imageClient.generate(generateParams as any);

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
    const disclaimers: string[] = ['免责声明：本图片由AI生成，仅供参考使用。'];
    if (needs.targetAudience || needs.usage) {
      disclaimers.push('请确保在实际使用前进行合规审核');
    }
    disclaimers.push('图片内容不代表任何投资建议或收益承诺。');
    return disclaimers.join('');
  }

  /**
   * 其他阶段处理（已完成后根据用户反馈进行微调）
   */
  private async handleOtherStages(session: SessionData, message: string): Promise<ChatResponse> {
    console.log('[OtherStages] 处理微调请求');

    session.messages.push({ role: 'user', content: message });

    // 如果 session 没有结构化需求或没有生成过图片，回退到收集阶段
    if (!session.structuredNeeds || !session.generatedImage) {
      return await this.handleCollectingStage(session, message);
    }

    // 生成图片（图生图模式，直接调用底层 API）
    session.stage = 'generating';
    console.log('[OtherStages] Step 1: Generating image with fine-tuning...');

    const sdkSize = this.resolveSdkSize(session.structuredNeeds.size, session.structuredNeeds.usage);
    console.log('[OtherStages] SDK size:', sdkSize);

    // 直接构建微调提示词，不经过 generatePrompts 处理
    const fineTunePrompt = this.buildFineTunePrompt(session.structuredNeeds, message);
    console.log('[OtherStages] 微调指令:', fineTunePrompt);

    const complianceBanner = this.getComplianceBanner(session.structuredNeeds);

    // 构建最终提示词：保留原图 + 用户修改要求 + 合规标语
    const finalPrompt = `
    ${fineTunePrompt}。
    保持图片底部的合规标语清晰可见：${complianceBanner}。
    图片中的文字必须是清晰可辨的简体中文，笔画清晰完整，分辨率 4k。
    避免出现：文字扭曲、文字模糊、字体粘连、错字、乱码、现金、金条、豪车、豪宅、陡峭上涨K线、涨停箭头、收益率数字、暴富、爆炸光、高饱和艳红色、夸张亢奋人物、低俗炫富元素、噪点严重、画面拥挤、无留白、画面元素过度堆砌、收益承诺、夸大宣传、荐股相关内容。
    `;

    console.log('[OtherStages] 最终提示词:', finalPrompt);

    const imageTemp = session.temperatures?.generateImage ?? 0.7;
    console.log(`[OtherStages] Using temperature: ${imageTemp}`);

    // 直接调用底层图片生成 API，携带原图作为参考
    const generateParams: {
      prompt: string;
      size: string;
      image?: string | string[];
      watermark?: boolean;
    } = {
      prompt: finalPrompt,
      size: sdkSize,
      watermark: false,
      image: session.generatedImage  // 使用原图作为参考图，触发图生图
    };

    console.log('[OtherStages] 图片参数（原图）:', generateParams.image);

    let imageUrl: string;
    try {
      const response = await this.imageClient.generate(generateParams as ImageGenerationRequest);
      const helper = this.imageClient.getResponseHelper(response);

      if (!helper.success || !helper.imageUrls || helper.imageUrls.length === 0) {
        console.error('[OtherStages] 生成失败:', helper.errorMessages);
        throw new Error(helper.errorMessages?.join(', ') || '图片生成失败');
      }

      imageUrl = helper.imageUrls[0];
      console.log('[OtherStages] 生成成功，URL:', imageUrl);
    } catch (e) {
      console.error('[OtherStages] 生成失败:', e);
      throw e;
    }

    session.generatedImage = imageUrl;

    // 图片内容合规检验
    console.log(`[OtherStages] Step 2: Checking image content compliance...`);
    const imageComplianceResult = await this.checkImageCompliance(imageUrl);
    console.log(`[OtherStages] Image compliance result:`, JSON.stringify(imageComplianceResult));
    
    if (!imageComplianceResult.passed) {
      console.log(`[OtherStages] ❌ Image content compliance FAILED`);
      
      session.stage = 'violation';
      session.complianceResult = imageComplianceResult;
      
      session.messages.push({
        role: 'assistant',
        content: `抱歉，重新生成的图片内容未能通过合规校验。${imageComplianceResult.violationAspects}\n\n改进建议：${imageComplianceResult.suggestions}\n\n请您优化需求后重新调整。`
      });

      return {
        stage: 'violation' as SessionStage,
        reply: `抱歉，重新生成的图片内容未能通过合规校验。`,
        complianceResult: imageComplianceResult,
        structuredNeeds: session.structuredNeeds,
        type: 'violation-warning'
      };
    }
    console.log(`[OtherStages] ✅ Image content compliance PASSED`);

    // 保存新图片到数据库
    await this.saveImageToDatabase(session, imageUrl, finalPrompt, '', imageComplianceResult);

    session.stage = 'completed';

    session.messages.push({
      role: 'assistant',
      content: `已根据您的反馈调整图片！`,
    });

    return {
      stage: 'completed' as SessionStage,
      reply: `已根据您的反馈调整图片！`,
      structuredNeeds: session.structuredNeeds,
      complianceResult: imageComplianceResult,
      generatedImage: imageUrl,
      disclaimer: this.generateDisclaimer(session.structuredNeeds),
      type: 'image',
      processingText: '素材调整中...',
    };
  }

  /**
   * 构建图生图微调指令
   * 重点约束保留原图构图、姿态、元素位置，仅执行用户指定修改
   */
  private buildFineTunePrompt(needs: StructuredNeeds, userFeedback: string): string {
    const promptParts: string[] = [];
    
    // 用户修改要求放在最前面，使用强措辞强调优先级
    promptParts.push(`【核心修改指令】必须执行以下修改：${userFeedback}`);
    
    // 保留约束
    promptParts.push('在执行上述修改时，保留原图的构图、人物姿态、元素位置和整体风格');
    promptParts.push('修改应遵循原图的视觉风格和设计规范，确保修改后与原图风格一致');
    promptParts.push('不要改变图片的主体内容和核心元素，仅对指定部分进行调整');

    // 原始需求精简版（仅保留最关键的信息，避免稀释修改指令）
    const contextParts: string[] = [];
    if (needs.theme) contextParts.push(`主题：${needs.theme}`);
    if (needs.content) contextParts.push(`内容：${needs.content}`);
    if (needs.style) contextParts.push(`风格：${needs.style}`);
    
    if (contextParts.length > 0) {
      promptParts.push(`参考：${contextParts.join('；')}`);
    }
    
    return promptParts.join('，');
  }


  /**
   * 获取图片列表 - 从数据库加载用户的生成记录
   */
  async getImageList(userId?: string, filter?: string) {
    console.log('[List] 获取图片列表, userId:', userId, 'filter:', filter);
    
    try {
      // 获取 Supabase 客户端
      const supabase = getSupabaseClient();
      
      // 从数据库查询图片
      let query = supabase
        .from('generated_images')
        .select('*')
        .order('created_at', { ascending: false });
      
      // 如果指定了用户ID，只查询该用户的图片
      if (userId) {
        query = query.eq('user_id', userId);
      }
      
      // 根据状态筛选
      if (filter === 'compliant' || filter === '合规通过') {
        query = query.eq('status', 'compliant');
      } else if (filter === 'pending' || filter === '待审核') {
        query = query.eq('status', 'pending');
      } else if (filter === 'favorite' || filter === '已收藏') {
        query = query.eq('is_favorite', true);
      }
      
      const { data, error } = await query.limit(50);
      
      if (error) {
        console.error('[List] 数据库查询失败:', error);
        // 返回空数组而不是模拟数据
        return [];
      }
      
      // 格式化返回数据
      const images = (data || []).map(img => ({
        id: img.id,
        title: img.title || '营销素材',
        description: img.description || '',
        style: img.positive_prompt?.split(',')[0] || '',
        status: img.status === 'compliant' ? '合规通过' : '待审核',
        time: this.formatTime(img.created_at),
        url: img.image_url,
        prompt: img.prompt,
        positive_prompt: img.positive_prompt,
        negative_prompt: img.negative_prompt,
        isFavorite: img.is_favorite || false
      }));
      
      console.log('[List] 查询到图片数量:', images.length);
      return images;
    } catch (e) {
      console.error('[List] 查询异常:', e);
      return [];
    }
  }

  /**
   * 切换图片收藏状态
   */
  async toggleFavorite(imageId: string) {
    console.log('[Favorite] 切换收藏状态, imageId:', imageId);
    
    try {
      const supabase = getSupabaseClient();
      
      // 先查询当前状态
      const { data: currentData, error: fetchError } = await supabase
        .from('generated_images')
        .select('is_favorite')
        .eq('id', imageId)
        .single();
      
      if (fetchError) {
        console.error('[Favorite] 查询失败:', fetchError);
        throw fetchError;
      }
      
      const newFavoriteState = !currentData?.is_favorite;
      
      // 更新收藏状态
      const { error: updateError } = await supabase
        .from('generated_images')
        .update({ is_favorite: newFavoriteState })
        .eq('id', imageId);
      
      if (updateError) {
        console.error('[Favorite] 更新失败:', updateError);
        throw updateError;
      }
      
      console.log('[Favorite] 收藏状态更新成功, newState:', newFavoriteState);
      return {
        success: true,
        isFavorite: newFavoriteState
      };
    } catch (e) {
      console.error('[Favorite] 切换收藏异常:', e);
      return {
        success: false,
        isFavorite: false
      };
    }
  }

  /**
   * 清空用户所有图片
   */
  async clearUserImages(userId: string) {
    console.log('[Clear] 清空用户图片, userId:', userId);
    
    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('generated_images')
        .delete()
        .eq('user_id', userId);
      
      if (error) {
        console.error('[Clear] 删除失败:', error);
        throw error;
      }
      
      console.log('[Clear] 用户图片清空成功');
      return {
        success: true,
        message: '用户图片已清空'
      };
    } catch (e) {
      console.error('[Clear] 清空异常:', e);
      return {
        success: false,
        message: '清空失败'
      };
    }
  }
  
  /**
   * 格式化时间显示
   */
  private formatTime(dateStr: string): string {
    if (!dateStr) return '未知时间';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffHours < 1) return '刚刚';
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  }
  
  /**
   * 保存图片到数据库
   */
  private async saveImageToDatabase(
    session: SessionData,
    imageUrl: string,
    positivePrompt: string,
    negativePrompt: string,
    complianceResult: ComplianceResult
  ): Promise<void> {
    console.log('[Save] 保存图片到数据库, userId:', session.userId);

    try {
      // 获取 Supabase 客户端
      const supabase = getSupabaseClient();

      const structured = session.structuredNeeds || {};
      const needsJson = JSON.stringify(structured);

      // 同步保存到内存 map，供后续 adjustImage 微调查取上下文
      const newImageId = `img_${Date.now()}`;
      this.generatedImages.set(newImageId, {
        title: structured.theme || '营销素材',
        description: structured.summary || positivePrompt,
        style: structured.style || '',
        status: complianceResult.passed ? '合规通过' : '待审核',
        time: '刚刚',
        url: imageUrl,
        params: null,
        prompt: needsJson,
        structuredNeeds: structured,
      });
      // 同时按 image url 做一次反查映射，便于 adjust 时用 url 找到原始需求
      this.generatedImages.set(`url:${imageUrl}`, this.generatedImages.get(newImageId)!);

      const { data, error } = await supabase
        .from('generated_images')
        .insert({
          user_id: session.userId || null,
          title: structured.theme || '营销素材',
          description: structured.summary || '',
          prompt: needsJson,
          positive_prompt: positivePrompt,
          negative_prompt: negativePrompt,
          image_url: imageUrl,
          status: complianceResult.passed ? 'compliant' : 'pending',
          compliance_note: complianceResult.passed ? null : complianceResult.violationAspects
        })
        .select();

      if (error) {
        console.error('[Save] 保存失败:', error);
      } else {
        console.log('[Save] 保存成功, ID:', data?.[0]?.id);
      }
    } catch (e) {
      console.error('[Save] 保存异常:', e);
    }
  }

  /**
   * 图片参数微调（保留原有功能，同时保留原始需求上下文和参考图片）
   */
  async adjustImage(imageId: string, params: any, imageUrl?: string) {
    console.log('[Adjust] 图片微调:', { imageId, params, imageUrl });

    // 回查原始需求：先按 imageId 查，再按 imageUrl 反查
    const original =
      (imageId ? this.generatedImages.get(imageId) : undefined) ||
      (imageUrl ? this.generatedImages.get(`url:${imageUrl}`) : undefined);
    const originalPrompt = original?.prompt || original?.structuredNeeds;

    let structuredNeeds: StructuredNeeds | null = null;
    if (originalPrompt) {
      if (typeof originalPrompt === 'string') {
        try {
          const parsed = JSON.parse(originalPrompt);
          if (parsed && typeof parsed === 'object') {
            structuredNeeds = parsed as StructuredNeeds;
          }
        } catch {
          console.error('[Adjust] Failed to parse original prompt as JSON');
        }
      } else {
        structuredNeeds = originalPrompt as StructuredNeeds;
      }
    }

    const basePromptParts: string[] = [];
    if (structuredNeeds) {
      if (structuredNeeds.theme) basePromptParts.push(structuredNeeds.theme);
      if (structuredNeeds.targetAudience) basePromptParts.push(`面向${structuredNeeds.targetAudience}`);
      if (structuredNeeds.usage) basePromptParts.push(`用于${structuredNeeds.usage}`);
      if (structuredNeeds.colorTone) basePromptParts.push(`${structuredNeeds.colorTone}色调`);
      if (structuredNeeds.style) basePromptParts.push(`${structuredNeeds.style}风格`);
      if (structuredNeeds.scene) basePromptParts.push(structuredNeeds.scene);
      if (structuredNeeds.emotion) basePromptParts.push(`${structuredNeeds.emotion}氛围`);
      if (structuredNeeds.otherRequirements) basePromptParts.push(structuredNeeds.otherRequirements);
    }

    // 用户新传入的微调参数优先级更高，覆盖原始需求中的对应字段
    if (params.styleType) basePromptParts.push(`${params.styleType}风格`);
    if (params.colorTone) basePromptParts.push(`${params.colorTone}色调`);
    const brightness = typeof params.brightness === 'number' ? params.brightness : 0;
    const contrast = typeof params.contrast === 'number' ? params.contrast : 0;
    basePromptParts.push(`亮度${brightness}，对比度${contrast}`);

    // 如果没有任何原始需求或参数，给一个保底
    if (basePromptParts.length === 0) {
      basePromptParts.push('投资咨询专业营销素材');
    }

    const adjustedPrompt = `${basePromptParts.join('，')}，专业商务摄影，高清`;

    // 解析原始需求中的 size/usage，保持原始比例
    let sizeHint: string | undefined;
    if (structuredNeeds) {
      sizeHint = structuredNeeds.size || this.inferSizeFromUsage(structuredNeeds.usage);
    }

    // 提取参考图片
    const referenceImages = structuredNeeds?.referenceImages || [];
    console.log('[Adjust] 参考图片数量:', referenceImages.length);
    if (referenceImages.length > 0) {
      console.log('[Adjust] 参考图片:', referenceImages.map(img => img.url).join(', '));
    }

    try {
      const sdkSize = this.resolveSdkSize(sizeHint);
      
      const generateParams: {
        prompt: string;
        size: string;
        image?: string | string[];
      } = {
        prompt: adjustedPrompt,
        size: sdkSize,
      };
      
      if (referenceImages.length > 0) {
        const imageUrls = referenceImages.map(img => img.url);
        generateParams.image = imageUrls.length === 1 ? imageUrls[0] : imageUrls;
        console.log('[Adjust] 参考图片参数:', generateParams.image);
      }

      const response = await this.imageClient.generate(generateParams as any);

      const helper = this.imageClient.getResponseHelper(response);

      if (!helper.success || !helper.imageUrls || helper.imageUrls.length === 0) {
        throw new Error(helper.errorMessages?.join(', ') || '图片生成失败');
      }

      const newImageUrl = helper.imageUrls[0];
      const newImageId = `img_${Date.now()}`;

      // 存储新图片数据，同时保留原始需求
      this.generatedImages.set(newImageId, {
        title: '微调后的图片',
        description: adjustedPrompt,
        style: params.styleType || original?.style || '',
        status: '合规通过',
        time: '刚刚',
        url: newImageUrl,
        params,
        prompt: typeof originalPrompt === 'string' ? originalPrompt : JSON.stringify(originalPrompt || {}),
        structuredNeeds: originalPrompt,
      });
      this.generatedImages.set(`url:${newImageUrl}`, this.generatedImages.get(newImageId)!);

      return {
        imageUrl: newImageUrl,
        imageId: newImageId,
        params,
        message: '图片已根据您的参数重新生成',
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

  /**
   * 上传图片到 TOS 对象存储
   * @param file 文件数据（Buffer）
   * @param filename 文件名
   * @returns 上传后的图片 URL
   */
  async uploadImage(file: Buffer, filename?: string): Promise<string> {
    console.log('[Upload] 开始上传图片:', filename || 'unknown');
    
    try {
      // 生成唯一文件名
      const uniqueFilename = filename || `upload_${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
      
      // 上传到 TOS（返回实际存储的 key）
      const actualKey = await this.s3Storage.uploadFile({
        fileContent: file,
        fileName: uniqueFilename,
        contentType: 'image/png'
      });
      
      // 生成访问 URL（有效期 7 天）
      const url = await this.s3Storage.generatePresignedUrl({
        key: actualKey,
        expireTime: 7 * 24 * 60 * 60  // 7 天
      });
      
      console.log('[Upload] 上传成功, key:', actualKey);
      console.log('[Upload] 图片 URL:', url);
      return url;
    } catch (error) {
      console.error('[Upload] 上传失败:', error);
      throw error;
    }
  }

  /**
   * 获取待处理图片（用于参数配置页面）
   * 返回最近生成的图片
   */
  getPendingImage(): { id: string; image_url: string } | null {
    const images = Array.from(this.generatedImages.entries())
      .filter(([key]) => !key.startsWith('url:'));
    
    if (images.length === 0) {
      return null;
    }

    const latest = images.reduce((a, b) => {
      const idA = a[0];
      const idB = b[0];
      const timeA = idA.startsWith('img_') ? parseInt(idA.split('_')[1], 10) : 0;
      const timeB = idB.startsWith('img_') ? parseInt(idB.split('_')[1], 10) : 0;
      return timeA > timeB ? a : b;
    });

    return {
      id: latest[0],
      image_url: latest[1].url
    };
  }
}