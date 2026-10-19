export default typeof definePageConfig === 'function'
  ? definePageConfig({ navigationBarTitleText: '参数配置' })
  : { navigationBarTitleText: '参数配置' }