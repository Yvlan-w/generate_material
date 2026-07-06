import { useState } from 'react'
import { View, Text, Image, Button as TaroButton } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { Sparkles, ShieldCheck, LoaderCircle, User } from 'lucide-react-taro'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState('')
  const [nickname, setNickname] = useState('')
  const isMiniApp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT

  const onChooseAvatar = (e: any) => {
    const { detail } = e
    setAvatarUrl(detail.avatarUrl)
  }

  const onNicknameChange = (e: any) => {
    setNickname(e.detail.value)
  }

  const handleLogin = async () => {
    if (!nickname.trim()) {
      Taro.showToast({
        title: '请输入昵称',
        icon: 'none',
        duration: 2000
      })
      return
    }

    setLoading(true)
    try {
      let code = 'test_h5_code'
      
      if (isMiniApp) {
        const loginResult = await Taro.login()
        code = loginResult.code
        console.log('小程序登录凭证:', code)
      }

      const response = await Network.request({
        url: '/api/auth/login',
        method: 'POST',
        data: { code, nickname: nickname.trim(), avatarUrl }
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
        <Text style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#1E293B',
          marginBottom: '6px'
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
              授权后可使用图片生成功能
            </Text>
          </View>

          {isMiniApp && (
            <View style={{ marginBottom: '20px' }}>
              <View style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: '20px'
              }}
              >
                <Text style={{
                  fontSize: '14px',
                  color: '#64748B',
                  marginBottom: '12px',
                  alignSelf: 'flex-start'
                }}
                >
                  选择头像
                </Text>
                <TaroButton
                  className="avatar-button"
                  openType="chooseAvatar"
                  onChooseAvatar={onChooseAvatar}
                  style={{
                    width: '100px',
                    height: '100px',
                    borderRadius: '50%',
                    border: '2px dashed #CBD5E1',
                    backgroundColor: '#F8FAFC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0',
                    margin: '0',
                    outline: 'none'
                  }}
                >
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      style={{
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        objectFit: 'cover'
                      }}
                      mode="aspectFill"
                    />
                  ) : (
                    <User size={48} color="#94A3B8" />
                  )}
                </TaroButton>
              </View>

              <View style={{ marginBottom: '20px' }}>
                <Text style={{
                  fontSize: '14px',
                  color: '#64748B',
                  marginBottom: '8px',
                  display: 'block'
                }}
                >
                  设置昵称
                </Text>
                <input
                  type="nickname"
                  className="nickname-input"
                  placeholder="请输入您的昵称"
                  value={nickname}
                  onChange={onNicknameChange}
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
            </View>
          )}

          <Button
            style={{
              width: '100%',
              backgroundColor: '#3B82F6',
              borderRadius: '16px',
              height: '52px',
              boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
            }}
            onClick={handleLogin}
            disabled={loading || (isMiniApp && !nickname.trim())}
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
                ? '点击登录即表示同意获取您的头像和昵称' 
                : '当前为H5开发模式，点击按钮模拟登录'}
            </Text>
            {!isMiniApp && (
              <View style={{
                backgroundColor: '#FEFCE8',
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
                  提示：微信头像和昵称授权仅在小程序中可用
                </Text>
              </View>
            )}
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