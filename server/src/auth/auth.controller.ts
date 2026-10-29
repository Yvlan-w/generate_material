import { Controller, Post, Get, Delete, Body, Query, Param, Req, UseGuards, ForbiddenException } from '@nestjs/common'
import { AuthService } from './auth.service'
import { AdminGuard, AuthGuard, AuthRequest } from './auth.guard'

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  
  /**
   * 微信登录接口
   * POST /api/auth/login
   * Body: { code: string, nickname?: string, avatarUrl?: string }
   */
  @Post('login')
  async login(
    @Body() body: { code: string; nickname?: string; avatarUrl?: string }
  ) {
    console.log('[AuthController] login called with:', { code: body.code, nickname: body.nickname })
    
    const result = await this.authService.wechatLogin(body.code, body.nickname, body.avatarUrl)
    
    console.log('[AuthController] login result:', { userId: result.user.id, isAdmin: result.user.is_admin })
    
    return {
      code: 200,
      msg: 'success',
      data: result,
    }
  }
  
  /**
   * 添加管理员接口
   * POST /api/auth/admin/add
   * Body: { openid: string, role?: string }
   */
  @Post('admin/add')
  @UseGuards(AuthGuard, AdminGuard)
  async addAdmin(@Body() body: { openid: string; role?: string }) {
    console.log('[AuthController] addAdmin called with:', body)
    
    try {
      await this.authService.addAdmin(body.openid, body.role || 'admin')
      return {
        code: 200,
        msg: '管理员添加成功',
        data: { openid: body.openid },
      }
    } catch (error) {
      const err = error as Error
      return {
        code: 400,
        msg: err.message,
        data: null,
      }
    }
  }
  
  /**
   * 移除管理员接口
   * DELETE /api/auth/admin/remove?openid=xxx
   */
  @Delete('admin/remove')
  @UseGuards(AuthGuard, AdminGuard)
  async removeAdmin(@Query('openid') openid: string) {
    console.log('[AuthController] removeAdmin called with openid:', openid)
    
    try {
      await this.authService.removeAdmin(openid)
      return {
        code: 200,
        msg: '管理员移除成功',
        data: { openid },
      }
    } catch (error) {
      const err = error as Error
      return {
        code: 400,
        msg: err.message,
        data: null,
      }
    }
  }
  
  /**
   * 获取管理员列表
   * GET /api/auth/admin/list
   */
  @Get('admin/list')
  @UseGuards(AuthGuard, AdminGuard)
  async getAdminList() {
    console.log('[AuthController] getAdminList called')
    
    const admins = await this.authService.getAdminList()
    
    console.log('[AuthController] admin list:', admins.length)
    
    return {
      code: 200,
      msg: 'success',
      data: { admins },
    }
  }
  
  /**
   * 获取用户信息
   * GET /api/auth/user/:openid
   */
  @Get('user/:openid')
  @UseGuards(AuthGuard)
  async getUser(@Param('openid') openid: string, @Req() req: AuthRequest) {
    console.log('[AuthController] getUser called with openid:', openid)

    const currentUser = req.user!
    if (currentUser.openid !== openid) {
      const isAdmin = await this.authService.checkAdminByUserId(currentUser.id)
      if (!isAdmin) {
        throw new ForbiddenException('无权查看其他用户信息')
      }
    }

    const user = await this.authService.getUserByOpenid(openid)
    
    if (!user) {
      return {
        code: 404,
        msg: '用户不存在',
        data: null,
      }
    }
    
    return {
      code: 200,
      msg: 'success',
      data: { user },
    }
  }
}