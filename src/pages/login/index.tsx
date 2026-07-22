import { useState, useEffect } from 'react'
import { View, Text, Image, Button as TaroButton, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { Sparkles, ShieldCheck, LoaderCircle, User, ArrowRight } from 'lucide-react-taro'

type LoginStep = 'init' | 'chooseAvatar' | 'inputNickname' | 'loggingIn'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [nickname, setNickname] = useState('')
  const [loginStep, setLoginStep] = useState<LoginStep>('init')
  const [loginCode, setLoginCode] = useState('')
  const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT

  useEffect(() => {
    const savedUserInfo = Taro.getStorageSync('userInfo')
    if (savedUserInfo) {
      setNickname(savedUserInfo.nickname || '')
      setAvatarUrl(savedUserInfo.avatar_url || '')
    }
  }, [])

  const onChooseAvatar = (e: any) => {
    const { detail } = e
    setAvatarUrl(detail.avatarUrl)
    console.log('头像选择完成:', detail.avatarUrl)
    setLoginStep('inputNickname')
  }

  const onNicknameChange = (e: any) => {
    setNickname(e.detail.value)
  }

  const handleWechatLogin = async () => {
    try {
      setLoading(true)
      const loginResult = await Taro.login()
      const code = loginResult.code
      console.log('小程序登录凭证:', code)
      setLoginCode(code)
      setLoginStep('chooseAvatar')
    } catch (error) {
      console.error('获取登录凭证失败:', error)
      Taro.showToast({ title: '获取登录凭证失败', icon: 'error', duration: 2000 })
      setLoading(false)
    }
  }

  const handleConfirmLogin = async () => {
    if (!nickname.trim()) {
      Taro.showToast({ title: '请输入昵称', icon: 'none', duration: 2000 })
      return
    }

    setLoginStep('loggingIn')
    try {
      const response = await Network.request({
        url: '/api/auth/login',
        method: 'POST',
        data: { code: loginCode, nickname: nickname.trim(), avatarUrl }
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
        Taro.redirectTo({ url: '/pages/index/index' })
      }, 1500)

    } catch (error: any) {
      console.error('登录失败:', error)
      await Taro.showToast({
        title: error.message || '登录失败，请重试',
        icon: 'error',
        duration: 2000
      })
      setLoginStep('inputNickname')
    } finally {
      setLoading(false)
    }
  }

  const handleSkipAvatar = () => {
    setLoginStep('inputNickname')
  }

  const canLogin = nickname.trim().length > 0

  const renderInitStep = () => (
    <View>
      <View style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#1E293B'
        }}>
          用户登录
        </Text>
        <Text style={{
          fontSize: '14px',
          color: '#64748B',
          marginTop: '8px'
        }}>
          授权后可使用图片生成功能
        </Text>
      </View>

      <Button
        style={{
          width: '100%',
          backgroundColor: '#3B82F6',
          borderRadius: '16px',
          height: '52px',
          boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
        }}
        onClick={handleWechatLogin}
        disabled={loading}
      >
        {loading ? (
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <LoaderCircle size={20} color="#FFFFFF" className="animate-spin" />
            <Text style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '500', marginLeft: '8px' }}>
              加载中...
            </Text>
          </View>
        ) : (
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldCheck size={20} color="#FFFFFF" style={{ marginRight: '8px' }} />
            <Text style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '500' }}>
              微信一键登录
            </Text>
          </View>
        )}
      </Button>

      <View style={{ textAlign: 'center', marginTop: '20px' }}>
        <Text style={{ fontSize: '12px', color: '#94A3B8' }}>
          点击登录即表示同意获取您的头像和昵称
        </Text>
      </View>
    </View>
  )

  const renderAvatarStep = () => (
    <View>
      <View style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#1E293B'
        }}>
          选择头像
        </Text>
        <Text style={{
          fontSize: '14px',
          color: '#64748B',
          marginTop: '8px'
        }}>
          请选择您的头像
        </Text>
      </View>

      <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
        <TaroButton
          className="avatar-button"
          openType="chooseAvatar"
          onChooseAvatar={onChooseAvatar}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '50%',
            border: '2px dashed #CBD5E1',
            backgroundColor: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0',
            margin: '0',
            outline: 'none',
            background: 'none'
          }}
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover' }}
              mode="aspectFill"
            />
          ) : (
            <User size={56} color="#94A3B8" />
          )}
        </TaroButton>
        <Text style={{ fontSize: '14px', color: '#64748B', marginTop: '12px' }}>
          点击选择微信头像
        </Text>
      </View>

      <View style={{ display: 'flex', flexDirection: 'row', gap: '12px' }}>
        <Button
          style={{
            flex: 1,
            backgroundColor: '#F1F5F9',
            borderRadius: '12px',
            height: '44px'
          }}
          onClick={() => setLoginStep('init')}
          variant="outline"
        >
          <Text style={{ color: '#64748B', fontSize: '14px' }}>取消</Text>
        </Button>
        <Button
          style={{
            flex: 1,
            backgroundColor: '#3B82F6',
            borderRadius: '12px',
            height: '44px'
          }}
          onClick={handleSkipAvatar}
        >
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: '500' }}>跳过</Text>
            <ArrowRight size={16} color="#FFFFFF" style={{ marginLeft: '4px' }} />
          </View>
        </Button>
      </View>
    </View>
  )

  const renderNicknameStep = () => (
    <View>
      <View style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#1E293B'
        }}>
          设置昵称
        </Text>
        <Text style={{
          fontSize: '14px',
          color: '#64748B',
          marginTop: '8px'
        }}>
          请输入您的昵称
        </Text>
      </View>

      {avatarUrl && (
        <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '20px' }}>
          <Image
            src={avatarUrl}
            style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover' }}
            mode="aspectFill"
          />
        </View>
      )}

      <View style={{ marginBottom: '24px' }}>
        <Input
          type="nickname"
          className="nickname-input"
          placeholder="请输入您的昵称"
          value={nickname}
          onInput={onNicknameChange}
          style={{
            width: '100%',
            height: '48px',
            backgroundColor: '#F8FAFC',
            borderRadius: '12px',
            paddingLeft: '16px',
            paddingRight: '16px',
            fontSize: '14px',
            border: '1px solid #E2E8F0',
            boxSizing: 'border-box'
          }}
        />
      </View>

      <View style={{ display: 'flex', flexDirection: 'row', gap: '12px' }}>
        <Button
          style={{
            flex: 1,
            backgroundColor: '#F1F5F9',
            borderRadius: '12px',
            height: '44px'
          }}
          onClick={() => setLoginStep('chooseAvatar')}
          variant="outline"
        >
          <Text style={{ color: '#64748B', fontSize: '14px' }}>返回</Text>
        </Button>
        <Button
          style={{
            flex: 1,
            backgroundColor: canLogin ? '#3B82F6' : '#94A3B8',
            borderRadius: '12px',
            height: '44px'
          }}
          onClick={handleConfirmLogin}
          disabled={!canLogin || loginStep === 'loggingIn'}
        >
          {loginStep === 'loggingIn' ? (
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <LoaderCircle size={16} color="#FFFFFF" className="animate-spin" />
              <Text style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: '500', marginLeft: '6px' }}>
                登录中...
              </Text>
            </View>
          ) : (
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: '500' }}>确认登录</Text>
              <ArrowRight size={16} color="#FFFFFF" style={{ marginLeft: '4px' }} />
            </View>
          )}
        </Button>
      </View>
    </View>
  )

  const renderH5Login = () => (
    <View>
      <View style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Text style={{
          fontSize: '20px',
          fontWeight: '600',
          color: '#1E293B'
        }}>
          用户登录
        </Text>
        <Text style={{
          fontSize: '14px',
          color: '#64748B',
          marginTop: '8px'
        }}>
          当前为H5开发模式
        </Text>
      </View>

      <View style={{ marginBottom: '20px' }}>
        <Text style={{ fontSize: '14px', color: '#64748B', marginBottom: '8px', display: 'block' }}>
          昵称
        </Text>
        <Input
          type="text"
          placeholder="请输入昵称"
          value={nickname}
          onInput={onNicknameChange}
          style={{
            width: '100%',
            height: '48px',
            backgroundColor: '#F8FAFC',
            borderRadius: '12px',
            paddingLeft: '16px',
            paddingRight: '16px',
            fontSize: '14px',
            border: '1px solid #E2E8F0',
            boxSizing: 'border-box'
          }}
        />
      </View>

      <Button
        style={{
          width: '100%',
          backgroundColor: canLogin ? '#3B82F6' : '#94A3B8',
          borderRadius: '16px',
          height: '52px'
        }}
        onClick={handleConfirmLogin}
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
          <Text style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '500' }}>
            测试登录
          </Text>
        )}
      </Button>

      <View style={{
        backgroundColor: '#FEFCE8',
        borderRadius: '8px',
        padding: '12px',
        marginTop: '20px'
      }}>
        <Text style={{ fontSize: '12px', color: '#B45309' }}>
          提示：微信头像和昵称授权仅在小程序中可用
        </Text>
      </View>
    </View>
  )

  return (
    <View style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#F8FAFC'
    }}>
      <View style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '60px',
        paddingBottom: '30px'
      }}>
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
        }}>
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
        }}>
          投资咨询行业专属
        </Text>
      </View>

      <View style={{
        flex: 1,
        paddingLeft: '24px',
        paddingRight: '24px',
        paddingBottom: '48px'
      }}>
        <View style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          border: '1px solid #E2E8F0',
          maxWidth: '320px',
          margin: '0 auto'
        }}>
          {isMiniApp ? (
            loginStep === 'init' ? renderInitStep() :
            loginStep === 'chooseAvatar' ? renderAvatarStep() :
            renderNicknameStep()
          ) : (
            renderH5Login()
          )}
        </View>
      </View>

      <View style={{
        textAlign: 'center',
        paddingBottom: '32px',
        paddingLeft: '24px',
        paddingRight: '24px'
      }}>
        <Text style={{ fontSize: '12px', color: '#94A3B8' }}>
          登录即表示您同意我们的服务条款和隐私政策
        </Text>
        <Text style={{ fontSize: '12px', color: '#CBD5E1', marginTop: '8px' }}>
          © 2024 投资咨询营销素材生成平台
        </Text>
      </View>
    </View>
  )
}