export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '登录',
    })
  : { navigationBarTitleText: '登录' }