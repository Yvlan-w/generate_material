import { Controller, Post, Get, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ImageService } from './image.service';

/**
 * 图片生成接口
 */
@Controller('image')
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  /**
   * 图片生成接口
   * POST /api/image/generate
   */
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generateImage(@Body() body: { userInput: string; style?: string }) {
    console.log('图片生成请求:', body);
    
    const result = await this.imageService.generateImage(
      body.userInput,
      body.style || '专业稳重'
    );
    
    console.log('图片生成响应:', result);
    
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
  @HttpCode(HttpStatus.OK)
  async adjustImage(@Body() body: { imageId: string; params: any }) {
    console.log('图片微调请求:', body);
    
    const result = await this.imageService.adjustImage(
      body.imageId,
      body.params
    );
    
    console.log('图片微调响应:', result);
    
    return {
      code: 200,
      msg: 'success',
      data: result
    };
  }

  /**
   * 图片列表接口
   * GET /api/image/list
   */
  @Get('list')
  async getImages(@Query('filter') filter?: string) {
    console.log('图片列表请求:', { filter });
    
    const result = await this.imageService.getImages(filter || '全部');
    
    return {
      code: 200,
      msg: 'success',
      data: { images: result }
    };
  }
}