import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

/**
 * 参数配置服务
 * 管理图片生成相关参数配置
 */
@Injectable()
export class ConfigService {
  private getClient() {
    return getSupabaseClient();
  }

  /**
   * 获取所有参数配置
   */
  async getAllParams() {
    const client = this.getClient();
    const { data, error } = await client
      .from('generation_params')
      .select('*')
      .eq('is_active', true)
      .order('param_name', { ascending: true });
    
    if (error) {
      throw new Error(`获取参数配置失败: ${error.message}`);
    }
    
    return data;
  }

  /**
   * 获取单个参数配置
   */
  async getParam(paramName: string) {
    const client = this.getClient();
    const { data, error } = await client
      .from('generation_params')
      .select('*')
      .eq('param_name', paramName)
      .maybeSingle();
    
    if (error) {
      throw new Error(`获取参数配置失败: ${error.message}`);
    }
    
    return data;
  }

  /**
   * 更新参数配置
   */
  async updateParam(id: number, paramValue: string, description?: string) {
    const client = this.getClient();
    
    const updateData: Record<string, string | undefined> = {
      param_value: paramValue,
    };
    
    if (description !== undefined) {
      updateData.description = description;
    }
    
    const { data, error } = await client
      .from('generation_params')
      .update(updateData)
      .eq('id', id)
      .select()
      .maybeSingle();
    
    if (error) {
      throw new Error(`更新参数配置失败: ${error.message}`);
    }
    
    return data;
  }

  /**
   * 获取参数值（数值类型）
   */
  async getParamValue(paramName: string): Promise<number> {
    const param = await this.getParam(paramName);
    if (!param) {
      throw new Error(`参数 ${paramName} 不存在`);
    }
    
    const value = parseFloat(param.param_value);
    if (isNaN(value)) {
      throw new Error(`参数 ${paramName} 的值不是有效数字`);
    }
    
    return value;
  }
}