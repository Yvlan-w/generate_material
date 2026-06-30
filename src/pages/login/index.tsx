import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { Sparkles, ShieldCheck, LoaderCircle } from 'lucide-react-taro'

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

      // 跳转到首页（使用 switchTab，因为首页是 tabBar 页面）
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
    <View style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#F8FAFC'
    }}
    >
      {/* Logo 区域 */}
      <View style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '80px',
        paddingBottom: '40px'
      }}
      >
        <View style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: '#3B82F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(59,130,246,0.3)',
          marginBottom: '24px'
        }}
        >
          <Sparkles size={40} color="#FFFFFF" />
        </View>
        <Text style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#1E293B',
          marginBottom: '8px'
        }}
        >
          营销素材生成平台
        </Text>
        <Text style={{
          fontSize: '14px',
          color: '#64748B',
          backgroundColor: '#DBEAFE',
          borderRadius: '8px',
          paddingLeft: '12px',
            paddingRight: '12px',
          paddingTop: '4px',
            paddingBottom: '4px'
        }}
        >
          投资咨询行业专属
        </Text>
      </View>

      {/* 登录卡片 */}
      <View style={{
        flex: 1,
        paddingLeft: '24px',
        paddingRight: '24px',
        paddingBottom: '48px'
      }}
      >
        <View style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          border: '1px solid #E2E8F0',
          maxWidth: '320px',
          margin: '0 auto'
        }}
        >
          {/* 标题 */}
          <View style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Text style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#1E293B'
            }}
            >
              用户登录
            </Text>
            <Text style={{
              fontSize: '14px',
              color: '#64748B',
              marginTop: '8px'
            }}
            >
              登录后可使用图片生成功能
            </Text>
          </View>

          {/* 登录按钮 */}
          <Button
            style={{
              width: '100%',
              backgroundColor: '#3B82F6',
              borderRadius: '16px',
              height: '52px',
              boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
            }}
            onClick={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <View style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center'
              }}
              >
                <LoaderCircle size={20} color="#FFFFFF" className="animate-spin" />
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: '500',
                  marginLeft: '8px'
                }}
                >
                  登录中...
                </Text>
              </View>
            ) : (
              <View style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center'
              }}
              >
                <ShieldCheck size={20} color="#FFFFFF" style={{ marginRight: '8px' }} />
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: '16px',
                  fontWeight: '500'
                }}
                >
                  {isMiniApp ? '微信授权登录' : '测试登录（H5模式）'}
                </Text>
              </View>
            )}
          </Button>

          {/* 提示信息 */}
          <View style={{
            textAlign: 'center',
            marginTop: '20px'
          }}
          >
            <Text style={{
              fontSize: '12px',
              color: '#94A3B8'
            }}
            >
              {isMiniApp 
                ? '点击按钮将获取微信授权并登录' 
                : '当前为H5开发模式，点击按钮模拟登录'}
            </Text>
            {!isMiniApp && (
              <View style={{
                backgroundColor: '#FEF3C7',
                borderRadius: '8px',
                padding: '12px',
                marginTop: '12px'
              }}
              >
                <Text style={{
                  fontSize: '12px',
                  color: '#B45309'
                }}
                >
                  提示：微信登录功能仅在小程序中可用
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      {/* 底部信息 */}
      <View style={{
        textAlign: 'center',
        paddingBottom: '32px',
        paddingLeft: '24px',
        paddingRight: '24px'
      }}
      >
        <Text style={{
          fontSize: '12px',
          color: '#94A3B8'
        }}
        >
          登录即表示您同意我们的服务条款和隐私政策
        </Text>
        <Text style={{
          fontSize: '12px',
          color: '#CBD5E1',
          marginTop: '8px'
        }}
        >
          © 2024 投资咨询营销素材生成平台
        </Text>
      </View>
    </View>
  )
}