import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { House, Image, Settings } from 'lucide-react-taro'

interface TabItem {
  pagePath: string
  text: string
  icon: any
  iconSize: number
}

const CustomTabBar = () => {
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentPath, setCurrentPath] = useState('/pages/index/index')

  useEffect(() => {
    // 获取管理员权限
    const adminFlag = Taro.getStorageSync('isAdmin')
    setIsAdmin(adminFlag === true)

    // 获取当前页面路径
    const pages = Taro.getCurrentPages()
    if (pages && pages.length > 0) {
      const currentPage = pages[pages.length - 1].route || 'pages/index/index'
      setCurrentPath(`/${currentPage}`)
    }
  }, [])

  // 基础 Tab 列表（所有用户可见）
  const baseTabs: TabItem[] = [
    {
      pagePath: '/pages/index/index',
      text: '首页',
      icon: House,
      iconSize: 20
    },
    {
      pagePath: '/pages/gallery/index',
      text: '图库',
      icon: Image,
      iconSize: 20
    }
  ]

  // 管理员专属 Tab（参数配置）
  const adminTabs: TabItem[] = [
    {
      pagePath: '/pages/adjust/index',
      text: '参数配置',
      icon: Settings,
      iconSize: 20
    }
  ]

  // 根据权限动态生成 Tab 列表
  const tabs = isAdmin ? [...baseTabs, ...adminTabs] : baseTabs

  const handleTabClick = (tab: TabItem) => {
    if (currentPath === tab.pagePath) return
    Taro.navigateTo({ url: tab.pagePath }).catch(() => {
      Taro.redirectTo({ url: tab.pagePath }).catch(err => {
        console.error('TabBar 跳转失败:', err)
      })
    })
  }

  return (
    <View
      className="custom-tabbar"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: '50px',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E5E7EB',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
        zIndex: 9999,
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      {tabs.map((tab, index) => {
        const isActive = currentPath === tab.pagePath
        const IconComponent = tab.icon

        return (
          <View
            key={index}
            className="tab-item"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
            onClick={() => handleTabClick(tab)}
          >
            <IconComponent
              size={tab.iconSize}
              color={isActive ? '#1E40AF' : '#6B7280'}
            />
            <Text
              className="tab-text"
              style={{
                fontSize: '12px',
                marginTop: '4px',
                color: isActive ? '#1E40AF' : '#6B7280'
              }}
            >
              {tab.text}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

export default CustomTabBar