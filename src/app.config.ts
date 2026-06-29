export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/index/index',
    'pages/gallery/index',
    'pages/adjust/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#FFFFFF',
    navigationBarTitleText: 'AI营销素材生成',
    navigationBarTextStyle: 'black'
  }
  // 移除原生 tabBar，改用自定义 TabBar 组件实现动态权限控制
})