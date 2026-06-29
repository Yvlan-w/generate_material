export default typeof definePageConfig === 'function'
  ? definePageConfig({
      navigationBarTitleText: '微调'
    })
  : {
      navigationBarTitleText: '微调'
    }