import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '@/storage/database/supabase-client';

export interface UserInfo {
  id: string;
  openid: string;
  nickname: string | null;
  avatar_url: string | null;
  is_admin: boolean;
}

export interface AdminInfo {
  id: string;
  user_id: string;
  role: string | null;
  created_at: string;
}

@Injectable()
export class AuthService {
  private getClient() {
    return getSupabaseClient();
  }

  /**
   * 微信登录：通过 code 换取 openid，并判断是否为管理员
   * 注意：真实环境中需要调用微信 API，这里做模拟处理
   */
  async wechatLogin(code: string, nickname?: string, avatar_url?: string): Promise<{ user: UserInfo; token: string }> {
    const client = this.getClient();
    
    // 在真实环境中，需要调用微信 API 换取 openid:
    // const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}&js_code=${code}&grant_type=authorization_code`)
    // const data = await response.json() as WechatLoginResult
    
    // 开发环境：使用 code 作为模拟 openid（真实环境需要替换为微信 API 返回的 openid）
    const openid = `dev_openid_${code.slice(0, 8)}`;
    
    // 查询用户
    const { data: existingUser, error: queryError } = await client
      .from('users')
      .select('*')
      .eq('openid', openid)
      .maybeSingle();
    
    if (queryError) {
      throw new Error(`查询用户失败: ${queryError.message}`);
    }
    
    let user: UserInfo;
    
    if (existingUser) {
      // 更新用户信息（如果有新数据）
      if (nickname || avatar_url) {
        const { data: updatedUser, error: updateError } = await client
          .from('users')
          .update({
            nickname: nickname || existingUser.nickname,
            avatar_url: avatar_url || existingUser.avatar_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingUser.id)
          .select()
          .maybeSingle();
        
        if (updateError) {
          throw new Error(`更新用户失败: ${updateError.message}`);
        }
        
        user = {
          id: updatedUser!.id,
          openid: updatedUser!.openid,
          nickname: updatedUser!.nickname,
          avatar_url: updatedUser!.avatar_url,
          is_admin: false,
        };
      } else {
        user = {
          id: existingUser.id,
          openid: existingUser.openid,
          nickname: existingUser.nickname,
          avatar_url: existingUser.avatar_url,
          is_admin: false,
        };
      }
    } else {
      // 创建新用户
      const { data: newUser, error: createError } = await client
        .from('users')
        .insert({
          openid,
          nickname: nickname || '用户',
          avatar_url: avatar_url || null,
        })
        .select()
        .maybeSingle();
      
      if (createError) {
        throw new Error(`创建用户失败: ${createError.message}`);
      }
      
      user = {
        id: newUser!.id,
        openid: newUser!.openid,
        nickname: newUser!.nickname,
        avatar_url: newUser!.avatar_url,
        is_admin: false,
      };
    }
    
    // 查询是否为管理员（通过 user_id 查询）
    user.is_admin = await this.checkAdminByUserId(user.id);
    
    // 生成 token（真实环境需要使用 JWT）
    const token = `token_${user.id}_${Date.now()}`;
    
    return { user, token };
  }

  /**
   * 检查用户是否为管理员（通过 user_id）
   */
  async checkAdminByUserId(userId: string): Promise<boolean> {
    const client = this.getClient();
    
    const { data, error } = await client
      .from('admin_config')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      throw new Error(`查询管理员状态失败: ${error.message}`);
    }
    
    return !!data;
  }

  /**
   * 检查用户是否为管理员（通过 openid）
   */
  async checkAdmin(openid: string): Promise<boolean> {
    const client = this.getClient();
    
    // 先查询用户获取 user_id
    const { data: user, error: userError } = await client
      .from('users')
      .select('id')
      .eq('openid', openid)
      .maybeSingle();
    
    if (userError) {
      throw new Error(`查询用户失败: ${userError.message}`);
    }
    
    if (!user) {
      return false;
    }
    
    return this.checkAdminByUserId(user.id);
  }

  /**
   * 添加管理员（通过 openid）
   */
  async addAdmin(openid: string, role: string = 'admin'): Promise<AdminInfo> {
    const client = this.getClient();
    
    // 先查询用户获取 user_id
    const { data: user, error: userError } = await client
      .from('users')
      .select('id')
      .eq('openid', openid)
      .maybeSingle();
    
    if (userError) {
      throw new Error(`查询用户失败: ${userError.message}`);
    }
    
    if (!user) {
      throw new Error('用户不存在，请先让用户登录');
    }
    
    // 检查是否已是管理员
    const { data: existing, error: queryError } = await client
      .from('admin_config')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    
    if (queryError) {
      throw new Error(`查询管理员失败: ${queryError.message}`);
    }
    
    if (existing) {
      throw new Error('该用户已是管理员');
    }
    
    // 添加管理员
    const { data: newAdmin, error: createError } = await client
      .from('admin_config')
      .insert({
        user_id: user.id,
        role,
      })
      .select()
      .maybeSingle();
    
    if (createError) {
      throw new Error(`添加管理员失败: ${createError.message}`);
    }
    
    return {
      id: newAdmin!.id,
      user_id: newAdmin!.user_id,
      role: newAdmin!.role,
      created_at: newAdmin!.created_at,
    };
  }

  /**
   * 移除管理员（通过 openid）
   */
  async removeAdmin(openid: string): Promise<void> {
    const client = this.getClient();
    
    // 先查询用户获取 user_id
    const { data: user, error: userError } = await client
      .from('users')
      .select('id')
      .eq('openid', openid)
      .maybeSingle();
    
    if (userError) {
      throw new Error(`查询用户失败: ${userError.message}`);
    }
    
    if (!user) {
      throw new Error('用户不存在');
    }
    
    const { error } = await client
      .from('admin_config')
      .delete()
      .eq('user_id', user.id);
    
    if (error) {
      throw new Error(`移除管理员失败: ${error.message}`);
    }
  }

  /**
   * 获取管理员列表
   */
  async getAdminList(): Promise<AdminInfo[]> {
    const client = this.getClient();
    
    const { data, error } = await client
      .from('admin_config')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`获取管理员列表失败: ${error.message}`);
    }
    
    return (data || []).map(item => ({
      id: item.id,
      user_id: item.user_id,
      role: item.role,
      created_at: item.created_at,
    }));
  }

  /**
   * 根据 openid 获取用户信息
   */
  async getUserByOpenid(openid: string): Promise<UserInfo | null> {
    const client = this.getClient();
    
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('openid', openid)
      .maybeSingle();
    
    if (error) {
      throw new Error(`查询用户失败: ${error.message}`);
    }
    
    if (!data) {
      return null;
    }
    
    const is_admin = await this.checkAdminByUserId(data.id);
    
    return {
      id: data.id,
      openid: data.openid,
      nickname: data.nickname,
      avatar_url: data.avatar_url,
      is_admin,
    };
  }
}