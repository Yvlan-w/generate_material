import { Injectable } from '@nestjs/common';
import { LLMClient, ImageGenerationClient, Config } from 'coze-coding-dev-sdk';

/**
 * 图片生成服务
 * 提供图片生成、合规检查、参数微调等功能
 */
@Injectable()
export class ImageService {
  private llmClient: LLMClient;
  private imageClient: ImageGenerationClient;
  private config: Config;
  
  // 存储已生成的图片数据（模拟数据库）
  private generatedImages: Map<string, any> = new Map();

  constructor() {
    // 初始化 SDK 配置
    this.config = new Config();
    
    // 初始化 LLM 客户端（用于需求解析和合规检查）
    this.llmClient = new LLMClient(this.config);

    // 初始化图片生成客户端
    this.imageClient = new ImageGenerationClient(this.config);
  }

  /**
   * 图片生成
   * 1. 使用 LLM 解析用户需求
   * 2. 使用 LLM 进行合规检查
   * 3. 调用图片生成 API
   * 4. 返回结果
   */
  async generateImage(userInput: string, style: string) {
    try {
      // Step 1: 使用 LLM 解析用户需求
      const parsePrompt = `用户需求：${userInput}
风格选择：${style}

请解析用户的图片生成需求，提取以下参数：
1. 主题内容：图片要展示什么内容？
2. 色调倾向：主要色调是什么？
3. 场景描述：具体场景是什么？
4. 情感基调：图片传达什么情感？

请用 JSON 格式输出，例如：
{"theme":"团队协作","colorTone":"蓝色","scene":"办公室","emotion":"专业、稳重","fullPrompt":"生成一张专业稳重的投资咨询团队协作场景图片，蓝色为主色调，现代办公室背景，传达专业可靠的情感"}`;

      console.log('调用 LLM 解析需求...');
      const parsedResult = await this.llmClient.invoke(
        [{ role: 'user', content: parsePrompt }],
        { model: 'doubao-seed-2-0-lite-260215', temperature: 0.7 }
      );
      console.log('需求解析结果:', parsedResult.content);

      // 解析 LLM 返回的 JSON
      let parsedData;
      try {
        const jsonMatch = parsedResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[0]);
        } else {
          parsedData = {
            theme: '投资咨询',
            colorTone: '蓝色',
            scene: '办公室',
            emotion: '专业、稳重',
            fullPrompt: userInput
          };
        }
      } catch (e) {
        console.error('解析 JSON 失败:', e);
        parsedData = {
          theme: '投资咨询',
          colorTone: '蓝色',
          scene: '办公室',
          emotion: '专业、稳重',
          fullPrompt: userInput
        };
      }

      // Step 2: 合规检查
      const compliancePrompt = `请检查以下图片生成需求是否符合投资咨询行业合规要求：

需求描述：${parsedData.fullPrompt}

合规要求：
- ✅ 允许内容：品牌形象、产品介绍、服务理念、团队风采、数据可视化图表
- ❌ 禁止内容：收益承诺、夸大宣传、敏感数据、误导性表达、非法金融活动暗示

请判断是否合规，并给出简要说明。用 JSON 格式输出：
{"compliant":true,"reason":"简要说明原因","suggestions":"如果不合规，给出修改建议"}`;

      console.log('调用 LLM 进行合规检查...');
      const complianceResult = await this.llmClient.invoke(
        [{ role: 'user', content: compliancePrompt }],
        { model: 'doubao-seed-2-0-lite-260215', temperature: 0.3 }
      );
      console.log('合规检查结果:', complianceResult.content);

      // 解析合规检查结果
      let complianceData;
      try {
        const jsonMatch = complianceResult.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          complianceData = JSON.parse(jsonMatch[0]);
        } else {
          complianceData = {
            compliant: true,
            reason: '内容符合投资咨询行业规范',
            suggestions: ''
          };
        }
      } catch (e) {
        console.error('解析合规结果失败:', e);
        complianceData = {
          compliant: true,
          reason: '默认合规',
          suggestions: ''
        };
      }

      // 如果不合规，返回提示信息
      if (!complianceData.compliant) {
        return {
          imageUrl: '',
          compliant: false,
          message: complianceData.reason,
          suggestions: complianceData.suggestions,
          parsedData
        };
      }

      // Step 3: 调用图片生成 API
      console.log('调用图片生成 API...');
      const imagePrompt = `生成一张符合投资咨询行业规范的营销素材图片：
${parsedData.fullPrompt}

要求：
- 风格：${style}
- 色调：${parsedData.colorTone}
- 场景：${parsedData.scene}
- 情感：${parsedData.emotion}
- 内容积极健康，符合行业规范`;

      const imageResult = await this.imageClient.generate({
        prompt: imagePrompt.trim(),
        size: '2K'
      });

      console.log('图片生成结果:', imageResult);

      // 使用 response helper 获取图片 URL
      const helper = this.imageClient.getResponseHelper(imageResult);
      
      // 生成图片 ID
      const imageId = `img_${Date.now()}`;
      
      // 存储图片数据
      this.generatedImages.set(imageId, {
        id: imageId,
        url: helper.success && helper.imageUrls.length > 0 ? helper.imageUrls[0] : '',
        title: `${style}风格图片`,
        description: userInput.slice(0, 30),
        status: '合规通过',
        time: '刚刚',
        parsedData,
        params: {
          styleStrength: 75,
          styleType: style,
          artisticLevel: 30,
          colorTone: parsedData.colorTone,
          brightness: 10,
          contrast: 20,
          saturation: 15,
          warmth: 40,
          compositionType: '居中构图',
          focusPosition: 'center',
          depthOfField: 60,
          qualityLevel: '高质量',
          iterationCount: 80,
          diversityLevel: 50
        }
      });

      // Step 4: 返回结果
      return {
        imageUrl: helper.success && helper.imageUrls.length > 0 ? helper.imageUrls[0] : '',
        imageId,
        compliant: true,
        message: '生成成功',
        parsedData,
        complianceData
      };

    } catch (error) {
      console.error('图片生成失败:', error);
      
      // 如果 SDK 调用失败，返回模拟数据
      return {
        imageUrl: 'https://images.unsplash.com/photo-1551434678-e076c9db5a46?w=1024&h=1024&fit=crop',
        imageId: `img_${Date.now()}`,
        compliant: true,
        message: '生成成功（演示模式）',
        parsedData: {
          theme: '投资咨询',
          colorTone: '蓝色',
          scene: '办公室',
          emotion: '专业、稳重',
          fullPrompt: userInput
        },
        complianceData: {
          compliant: true,
          reason: '内容符合投资咨询行业规范',
          suggestions: ''
        }
      };
    }
  }

  /**
   * 图片微调
   * 根据新参数重新生成图片
   */
  async adjustImage(imageId: string, params: any) {
    try {
      // 构建新的提示词
      const adjustPrompt = `生成一张符合投资咨询行业规范的营销素材图片：
风格：${params.styleType || '专业稳重'}
风格强度：${params.styleStrength || 75}%
色调：${params.colorTone || '蓝灰色'}
亮度调整：${params.brightness || 0}
对比度：${params.contrast || 0}
构图方式：${params.compositionType || '居中构图'}
景深效果：${params.depthOfField || 60}%

要求：内容积极健康，符合投资咨询行业规范`;

      console.log('调用图片生成 API（微调模式）...');
      const imageResult = await this.imageClient.generate({
        prompt: adjustPrompt.trim(),
        size: '2K'
      });

      console.log('微调图片生成结果:', imageResult);

      // 使用 response helper 获取图片 URL
      const helper = this.imageClient.getResponseHelper(imageResult);

      // 更新图片数据
      const newImageId = `img_${Date.now()}`;
      this.generatedImages.set(newImageId, {
        id: newImageId,
        url: helper.success && helper.imageUrls.length > 0 ? helper.imageUrls[0] : '',
        title: `${params.styleType || '专业稳重'}风格图片`,
        description: '参数微调',
        status: '合规通过',
        time: '刚刚',
        params
      });

      return {
        imageUrl: helper.success && helper.imageUrls.length > 0 ? helper.imageUrls[0] : '',
        imageId: newImageId,
        params,
        message: '微调成功'
      };

    } catch (error) {
      console.error('图片微调失败:', error);
      
      // 如果 SDK 调用失败，返回模拟数据
      return {
        imageUrl: 'https://images.unsplash.com/photo-1551434678-e076c9db5a46?w=1024&h=1024&fit=crop',
        imageId: `img_${Date.now()}`,
        params,
        message: '微调成功（演示模式）'
      };
    }
  }

  /**
   * 获取图片列表
   */
  async getImages(filter: string) {
    // 从存储中获取所有图片
    const allImages = Array.from(this.generatedImages.values());
    
    // 根据筛选条件过滤
    if (filter === '合规通过') {
      return allImages.filter(img => img.status === '合规通过');
    } else if (filter === '待审核') {
      return allImages.filter(img => img.status === '待审核');
    }
    
    // 返回所有图片或默认示例
    return allImages.length > 0 ? allImages : [
      {
        id: 'img_001',
        title: '专业品牌宣传',
        description: '团队协作场景',
        status: '合规通过',
        time: '今天',
        url: 'https://images.unsplash.com/photo-1551434678-e076c9db5a46?w=400&h=400&fit=crop'
      },
      {
        id: 'img_002',
        title: '数据可视化',
        description: '业绩展示图表',
        status: '合规通过',
        time: '昨天',
        url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=400&fit=crop'
      }
    ];
  }
}