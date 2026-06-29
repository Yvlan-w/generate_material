export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/gallery/index',
    'pages/adjust/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTitleText: 'AI营销素材生成',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#6B7280',
    selectedColor: '#1E40AF',
    backgroundColor: '#FFFFFF',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        iconPath: './assets/tabbar/home.png',
        selectedIconPath: './assets/tabbar/home-active.png'
      },
      {
        pagePath: 'pages/gallery/index',
        text: '图库',
        iconPath: './assets/tabbar/image.png',
        selectedIconPath: './assets/tabbar/image-active.png'
      },
      {
        pagePath: 'pages/adjust/index',
        text: '微调',
        iconPath: './assets/tabbar/sliders-horizontal.png',
        selectedIconPath: './assets/tabbar/sliders-horizontal-active.png'
      }
    ]
  }
})