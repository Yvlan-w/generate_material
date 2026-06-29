import { Controller, Get, Post, Body, Param, Put } from '@nestjs/common';
import { ConfigService } from './config.service';

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: ConfigService) {}
  
  /**
   * 获取所有参数配置
   * GET /api/config/params
   */
  @Get('params')
  async getAllParams() {
    console.log('[ConfigController] getAllParams called');
    
    const params = await this.configService.getAllParams();
    
    console.log('[ConfigController] params count:', params?.length || 0);
    
    return {
      code: 200,
      msg: 'success',
      data: { params },
    };
  }
  
  /**
   * 获取单个参数配置
   * GET /api/config/param/:name
   */
  @Get('param/:name')
  async getParam(@Param('name') paramName: string) {
    console.log('[ConfigController] getParam called with:', paramName);
    
    const param = await this.configService.getParam(paramName);
    
    if (!param) {
      return {
        code: 404,
        msg: '参数不存在',
        data: null,
      };
    }
    
    return {
      code: 200,
      msg: 'success',
      data: { param },
    };
  }
  
  /**
   * 更新参数配置
   * PUT /api/config/params/:id
   * Body: { paramValue: string, description?: string }
   */
  @Put('params/:id')
  async updateParam(
    @Param('id') id: string,
    @Body() body: { paramValue: string; description?: string }
  ) {
    console.log('[ConfigController] updateParam called with id:', id, 'value:', body.paramValue);
    
    const param = await this.configService.updateParam(
      parseInt(id, 10),
      body.paramValue,
      body.description
    );
    
    if (!param) {
      return {
        code: 404,
        msg: '参数不存在',
        data: null,
      };
    }
    
    return {
      code: 200,
      msg: '参数更新成功',
      data: { param },
    };
  }
  
  /**
   * 获取图片生成配置对象
   * GET /api/config/generation-config
   */
  @Get('generation-config')
  async getGenerationConfig() {
    console.log('[ConfigController] getGenerationConfig called');
    
    // 获取关键参数
    const temperature = await this.configService.getParamValue('temperature');
    const styleStrength = await this.configService.getParamValue('style_strength');
    
    return {
      code: 200,
      msg: 'success',
      data: {
        config: {
          temperature,
          style_strength: styleStrength,
        },
      },
    };
  }
}