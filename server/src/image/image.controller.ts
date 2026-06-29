import { Controller, Post, Get, Body, Query, Param } from '@nestjs/common';
import { ImageService } from './image.service';

/**
 * 图片生成Controller
 * 提供多轮对话式需求收集、合规检查、图片生成等API
 */
@Controller('image')
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  /**
   * 多轮对话接口 - 需求收集Agent
   * POST /api/image/chat
   * 
   * 流程：
   * 用户提问 → 需求收集Agent → 结构化需求JSON → 合规校验
   * ├─ 违规 → 返回拒绝提示 + 违规方面 + 改进建议 → 回到Agent
   * └─ 通过 → 正负提示词 → 文生图 → 图片 + 需求 + 免责文案
   */
  @Post('chat')
  async chat(@Body() body: { sessionId: string; message: string; stage: string; userId?: string }) {
    console.log('[API] Chat request:', body);
    
    const result = await this.imageService.chat(
      body.sessionId,
      body.message,
      body.stage as any,
      body.userId
    );
    
    return {
      code: 200,
      msg: 'success',
      data: result
    };
  }

  /**
   * 获取对话历史
   * GET /api/image/session/:id
   */
  @Get('session/:id')
  async getSession(@Param('id') sessionId: string) {
    console.log('[API] Get session:', sessionId);
    
    const session = this.imageService.getSession(sessionId);
    
    return {
      code: 200,
      msg: 'success',
      data: session || null
    };
  }

  /**
   * 图片生成接口（保留原有）
   * POST /api/image/generate
   */
  @Post('generate')
  async generateImage(@Body() body: { userInput: string; style?: string }) {
    console.log('[API] Generate request:', body);
    
    // 使用对话流程模拟单轮生成
    const sessionId = `single_${Date.now()}`;
    const result = await this.imageService.chat(
      sessionId,
      `${body.userInput}，风格选择：${body.style || '专业稳重'}`,
      'collecting'
    );
    
    return {
      code: 200,
      msg: 'success',
      data: {
        imageUrl: result.generatedImage ?? '',
        imageId: sessionId,
        compliant: result.complianceResult?.passed ?? true,
        message: result.reply,
        parsedData: result.structuredNeeds ?? null,
        complianceData: result.complianceResult ?? null
      }
    };
  }

  /**
   * 图片列表接口
   * GET /api/image/list
   */
  @Get('list')
  async getImageList(@Query('userId') userId?: string, @Query('filter') filter?: string) {
    console.log('[API] List request, userId:', userId, 'filter:', filter);
    
    const images = await this.imageService.getImageList(userId, filter);
    
    return {
      code: 200,
      msg: 'success',
      data: {
        images
      }
    };
  }

  /**
   * 图片微调接口
   * POST /api/image/adjust
   */
  @Post('adjust')
  async adjustImage(@Body() body: { imageId: string; params: any }) {
    console.log('[API] Adjust request:', body);
    
    const result = await this.imageService.adjustImage(body.imageId, body.params);
    
    return {
      code: 200,
      msg: 'success',
      data: result
    };
  }
}