import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Network } from '@/network'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT

  const handleLogin = async () => {
    setLoading(true)
    try {
      let code = 'test_h5_code'
      
      // 小程序环境获取真实登录凭证
      if (isMiniApp) {
        const loginResult = await Taro.login()
        code = loginResult.code
        console.log('小程序登录凭证:', code)
      }

      // 调用后端登录接口
      const response = await Network.request({
        url: '/api/auth/login',
        method: 'POST',
        data: { code, nickname: '用户' }
      })

      console.log('登录响应:', response)

      // 解析响应数据 - 后端返回 { code: 200, msg: 'success', data: { user, token } }
      const result = response.data?.data
      if (!result || !result.user) {
        throw new Error('登录响应数据异常')
      }

      const { user, token } = result

      // 保存用户信息到本地
      Taro.setStorageSync('userInfo', {
        id: user.id,
        openid: user.openid,
        nickname: user.nickname,
        avatar_url: user.avatar_url
      })
      Taro.setStorageSync('isAdmin', user.is_admin)
      Taro.setStorageSync('isLoggedIn', true)
      Taro.setStorageSync('token', token)

      // 显示成功提示
      await Taro.showToast({
        title: user.is_admin ? '管理员登录成功' : '登录成功',
        icon: 'success',
        duration: 1500
      })

      // 跳转到首页
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/index/index' })
      }, 1500)

    } catch (error: any) {
      console.error('登录失败:', error)
      await Taro.showToast({
        title: error.message || '登录失败，请重试',
        icon: 'error',
        duration: 2000
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="flex flex-col min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Logo 区域 */}
      <View className="flex flex-col items-center justify-center pt-20 pb-8">
        <View className="w-24 h-24 rounded-full bg-blue-600 flex items-center justify-center mb-4">
          <Text className="text-white text-4xl font-bold">AI</Text>
        </View>
        <Text className="block text-2xl font-bold text-blue-900 mb-2">营销素材生成平台</Text>
        <Text className="block text-sm text-blue-600">投资咨询行业专属</Text>
      </View>

      {/* 登录卡片 */}
      <View className="flex-1 px-6 pb-12">
        <Card className="mx-auto max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">用户登录</CardTitle>
            <CardDescription className="text-sm">
              登录后可使用图片生成功能
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 登录按钮 */}
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              onClick={handleLogin}
              disabled={loading}
            >
              <View className="flex items-center justify-center">
                <Text className="text-white font-medium">
                  {loading ? '登录中...' : (isMiniApp ? '微信授权登录' : '测试登录（H5开发模式）')}
                </Text>
              </View>
            </Button>

            {/* 提示信息 */}
            <View className="text-center space-y-2">
              <Text className="block text-xs text-gray-500">
                {isMiniApp 
                  ? '点击按钮将获取微信授权并登录' 
                  : '当前为H5开发模式，点击按钮模拟登录'}
              </Text>
              {!isMiniApp && (
                <Text className="block text-xs text-orange-500">
                  提示：微信登录功能仅在小程序中可用
                </Text>
              )}
            </View>
          </CardContent>
        </Card>
      </View>

      {/* 底部信息 */}
      <View className="text-center pb-8 px-6">
        <Text className="block text-xs text-gray-400">
          登录即表示您同意我们的服务条款和隐私政策
        </Text>
        <Text className="block text-xs text-gray-400 mt-2">
          © 2024 投资咨询营销素材生成平台
        </Text>
      </View>
    </View>
  )
}