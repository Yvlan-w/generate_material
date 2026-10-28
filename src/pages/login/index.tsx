import { useState, useEffect } from 'react'
// eslint-disable-next-line no-restricted-syntax -- 微信 openType="chooseAvatar" 头像选择能力必须使用原生 Button
import { View, Text, Button as TaroButton } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { Sparkles, ShieldCheck, LoaderCircle, User } from 'lucide-react-taro'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [nickname, setNickname] = useState('')
  const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT

  useEffect(() => {
    const savedUserInfo = Taro.getStorageSync('userInfo')
    if (savedUserInfo) {
      setNickname(savedUserInfo.nickname || '')
    }
  }, [])

  const handleLogin = async () => {
    if (!nickname.trim()) {
      Taro.showToast({ title: '请输入昵称', icon: 'none', duration: 2000 })
      return
    }

    setLoading(true)
    try {
      let code = ''
      if (isMiniApp) {
        try {
          const loginResult = await Taro.login()
          code = loginResult.code || ''
        } catch (e) {
          code = `test_h5_${Date.now()}`
        }
      } else {
        code = `test_h5_${Date.now()}`
      }
      console.log('登录凭证:', code)

      const response = await Network.request({
        url: '/api/auth/login',
        method: 'POST',
        data: { code, nickname: nickname.trim() }
      })

      console.log('登录响应:', response)
      const result = response.data?.data
      if (!result || !result.user) {
        throw new Error('登录响应数据异常')
      }

      const { user, token } = result

      Taro.setStorageSync('userInfo', {
        id: user.id,
        openid: user.openid,
        nickname: user.nickname,
        avatar_url: user.avatar_url
      })
      Taro.setStorageSync('isAdmin', user.is_admin)
      Taro.setStorageSync('isLoggedIn', true)
      Taro.setStorageSync('token', token)

      await Taro.showToast({
        title: user.is_admin ? '管理员登录成功' : '登录成功',
        icon: 'success',
        duration: 1500
      })

      setTimeout(() => {
        Taro.switchTab({ url: '/pages/index/index' })
      }, 1500)
    } catch (error: any) {
      console.error('登录失败:', error)
      await Taro.showToast({
        title: error.message || '登录失败，请重试',
        icon: 'none',
        duration: 2000
      })
    } finally {
      setLoading(false)
    }
  }

  const canLogin = nickname.trim().length > 0

  return (
    <View style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#F8FAFC'
    }}
    >
      <View style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '60px',
        paddingBottom: '30px'
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
          marginBottom: '20px'
        }}
        >
          <Sparkles size={40} color="#FFFFFF" />
        </View>
        <Text style={{ fontSize: '24px', fontWeight: '700', color: '#1E293B', marginBottom: '6px' }}>
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
          <View style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Text style={{ fontSize: '20px', fontWeight: '600', color: '#1E293B', display: 'block' }}>
              {isMiniApp ? '微信一键登录' : '用户登录'}
            </Text>
            <Text style={{
              fontSize: '14px',
              color: '#64748B',
              marginTop: '8px',
              display: 'block'
            }}
            >
              {isMiniApp ? '授权后可开始生成营销素材' : '当前为H5开发模式'}
            </Text>
          </View>

          {isMiniApp && (
            <TaroButton
              className="avatar-button"
              openType="chooseAvatar"
              onChooseAvatar={(e: any) => {
                if (e.detail?.avatarUrl) {
                  Taro.setStorageSync('tmpAvatar', e.detail.avatarUrl)
                }
              }}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: '#F1F5F9',
                border: '2px dashed #CBD5E1',
                margin: '0 auto 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0'
              }}
            >
              <User size={32} color="#94A3B8" />
            </TaroButton>
          )}

          <View style={{ marginBottom: '16px' }}>
            <Text style={{
              fontSize: '14px',
              color: '#64748B',
              marginBottom: '8px',
              display: 'block'
            }}
            >
              昵称
            </Text>
            <Input
              type="text"
              placeholder="请输入昵称"
              value={nickname}
              onInput={(e: any) => setNickname(e.detail?.value || '')}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 text-sm"
            />
          </View>

          <Button
            style={{
              width: '100%',
              backgroundColor: canLogin ? '#3B82F6' : '#94A3B8',
              borderRadius: '16px',
              height: '52px',
              boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
            }}
            onClick={handleLogin}
            disabled={loading || !canLogin}
          >
            {loading ? (
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <LoaderCircle size={20} color="#FFFFFF" className="animate-spin" />
                <Text style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '500', marginLeft: '8px' }}>
                  登录中...
                </Text>
              </View>
            ) : (
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={20} color="#FFFFFF" style={{ marginRight: '8px' }} />
                <Text style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '500' }}>
                  {isMiniApp ? '登录' : '测试登录'}
                </Text>
              </View>
            )}
          </Button>

          <View style={{
            backgroundColor: '#FEFCE8',
            borderRadius: '8px',
            padding: '12px',
            marginTop: '20px'
          }}
          >
            <Text style={{ fontSize: '12px', color: '#B45309', display: 'block' }}>
              {isMiniApp ? '点击头像可授权微信昵称，未授权可直接填写昵称' : '调试模式下使用模拟登录'}
            </Text>
          </View>
        </View>
      </View>

      <View style={{
        textAlign: 'center',
        paddingBottom: '32px',
        paddingLeft: '24px',
        paddingRight: '24px'
      }}
      >
        <Text style={{ fontSize: '12px', color: '#94A3B8', display: 'block' }}>
          登录即表示您同意我们的服务条款和隐私政策
        </Text>
        <Text style={{ fontSize: '12px', color: '#CBD5E1', marginTop: '8px', display: 'block' }}>
          © 2024 投资咨询营销素材生成平台
        </Text>
      </View>
    </View>
  )
}