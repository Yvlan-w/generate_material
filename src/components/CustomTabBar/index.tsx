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
    const currentPage = Taro.getCurrentPages()?.[0]?.route || 'pages/index/index'
    setCurrentPath(`/${currentPage}`)
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
    Taro.switchTab({ url: tab.pagePath })
  }

  return (
    <View style={{
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
      paddingBottom: 'env(safe-area-inset-bottom)',
      zIndex: 999
    }}
    >
      {tabs.map((tab, index) => {
        const isActive = currentPath === tab.pagePath
        const IconComponent = tab.icon

        return (
          <View
            key={index}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => handleTabClick(tab)}
          >
            <IconComponent
              size={tab.iconSize}
              color={isActive ? '#1E40AF' : '#6B7280'}
            />
            <Text
              style={{
                fontSize: '12px',
                marginTop: '2px',
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