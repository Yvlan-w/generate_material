import { Controller, Post, Get, Body, Query, Param, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  async chat(@Body() body: { 
    sessionId: string; 
    message: string; 
    stage: string; 
    userId?: string;
    imageType?: 'reference' | 'included';
    imageUrls?: string[];
    imageDetails?: Array<{ url: string; aspects?: string[]; position?: string }>;
    referenceImages?: Array<{ url: string; aspects?: string[] }>;
    includedImages?: Array<{ url: string; position?: string; note?: string }>;
    temperatures?: {
      extractNeeds?: number;
      generatePrompts?: number;
      generateImage?: number;
    };
  }) {
    console.log('[API] Chat request:', body);
    
    const result = await this.imageService.chat(
      body.sessionId,
      body.message,
      body.stage as any,
      body.userId,
      body.imageType,
      body.imageUrls,
      body.imageDetails,
      body.referenceImages,
      body.includedImages,
      body.temperatures
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
   * 切换图片收藏接口
   * POST /api/image/favorite
   */
  @Post('favorite')
  async toggleFavorite(@Body() body: { imageId: string }) {
    console.log('[API] Favorite request:', body);
    
    const result = await this.imageService.toggleFavorite(body.imageId);
    
    return {
      code: 200,
      msg: 'success',
      data: result
    };
  }

  /**
   * 清空用户图片接口
   * POST /api/image/clear
   */
  @Post('clear')
  async clearUserImages(@Body() body: { userId: string }) {
    console.log('[API] Clear images request:', body);
    
    const result = await this.imageService.clearUserImages(body.userId);
    
    return {
      code: 200,
      msg: 'success',
      data: result
    };
  }

  /**
   * 图片微调接口
   * POST /api/image/adjust
   */
  @Post('adjust')
  async adjustImage(@Body() body: { imageId: string; params: any; imageUrl?: string }) {
    console.log('[API] Adjust request:', body);

    const result = await this.imageService.adjustImage(body.imageId, body.params, body.imageUrl);

    return {
      code: 200,
      msg: 'success',
      data: result
    };
  }

  /**
   * 获取待处理图片
   * GET /api/image/pending
   */
  @Get('pending')
  async getPendingImage() {
    console.log('[API] Get pending image');
    
    const pendingImage = this.imageService.getPendingImage();
    
    return {
      code: 200,
      msg: 'success',
      data: pendingImage || null
    };
  }

  /**
   * 图片上传接口
   * POST /api/image/upload
   * 支持用户上传参考图片
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 10 * 1024 * 1024 },  // 最大 10MB
  }))
  async uploadImage(@UploadedFile() file: { buffer?: Buffer; path?: string; originalname?: string; size?: number }) {
    console.log('[API] Upload request, file:', file?.originalname, file?.size);
    
    if (!file) {
      return {
        code: 400,
        msg: '没有接收到文件',
        data: null
      };
    }
    
    try {
      // 使用 file.buffer（必须存在）
      if (!file.buffer) {
        return {
          code: 400,
          msg: '文件数据为空',
          data: null
        };
      }
      const url = await this.imageService.uploadImage(file.buffer, file.originalname);
      
      return {
        code: 200,
        msg: 'success',
        data: { url, filename: file.originalname }
      };
    } catch (error) {
      console.error('[API] Upload error:', error);
      return {
        code: 500,
        msg: '上传失败',
        data: null
      };
    }
  }
}