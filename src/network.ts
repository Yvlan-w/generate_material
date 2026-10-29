import Taro from '@tarojs/taro'

/**
 * 网络请求模块
 * 封装 Taro.request、Taro.uploadFile、Taro.downloadFile，自动添加项目域名前缀
 * 如果请求的 url 以 http:// 或 https:// 开头，则不会添加域名前缀
 *
 * IMPORTANT: 项目已经全局注入 PROJECT_DOMAIN
 * IMPORTANT: 除非你需要添加全局参数，如给所有请求加上 header，否则不能修改此文件
 */
export namespace Network {
    let redirectingToLogin = false

    const isExternalUrl = (url: string): boolean => {
        return url.startsWith('http://') || url.startsWith('https://')
    }

    const createUrl = (url: string): string => {
        if (isExternalUrl(url)) {
            return url
        }
        return `${PROJECT_DOMAIN}${url}`
    }

    /** 读取本地登录凭证，统一注入 Authorization 头 */
    const getAuthHeader = (): Record<string, string> => {
        try {
            const token = Taro.getStorageSync('token')
            return token ? { Authorization: `Bearer ${token}` } : {}
        } catch {
            return {}
        }
    }

    /**
     * 仅对本站接口注入登录凭证
     * 外部资源（如图片 CDN / 对象存储预签名地址）不附加 Authorization，避免签名校验失败
     */
    const withAuthHeader = <O extends { url: string; header?: Record<string, any> }>(
        option: O,
        originalUrl: string
    ): O => {
        if (isExternalUrl(originalUrl)) {
            return option
        }
        return {
            ...option,
            header: {
                ...(option.header || {}),
                ...getAuthHeader(),
            },
        } as O
    }

    /** 登录状态失效：清理本地登录态并回到登录页 */
    const handleUnauthorized = () => {
        if (redirectingToLogin) {
            return
        }
        try {
            Taro.removeStorageSync('userInfo')
            Taro.removeStorageSync('isLoggedIn')
            Taro.removeStorageSync('token')
            Taro.removeStorageSync('isAdmin')
        } catch (error) {
            console.warn('[Network] 清理登录状态失败', error)
        }

        const pages = Taro.getCurrentPages()
        const currentRoute = pages[pages.length - 1]?.route || ''
        if (currentRoute === 'pages/login/index') {
            return
        }

        redirectingToLogin = true
        Taro.redirectTo({ url: '/pages/login/index' })
            .then(() => {
                redirectingToLogin = false
            })
            .catch(() => {
                redirectingToLogin = false
            })
    }

    const handleResult = <T extends { statusCode?: number }>(
        response: T,
        success?: (res: T) => void,
        complete?: (res: T) => void
    ): T => {
        if (response.statusCode === 401) {
            handleUnauthorized()
        }
        success?.(response)
        complete?.(response)
        return response
    }

    export const request = (
        option: Taro.request.Option
    ): Promise<Taro.request.SuccessCallbackResult> => {
        const { success, fail, complete, ...rest } = option
        return (Taro.request(withAuthHeader({
            ...rest,
            url: createUrl(rest.url),
            timeout: rest.timeout || 300000,
        }, rest.url)) as unknown as Promise<Taro.request.SuccessCallbackResult>)
            .then(response => handleResult(response, success as any, complete as any))
            .catch(error => {
                fail?.(error)
                complete?.(error)
                throw error
            })
    }

    export const uploadFile = (
        option: Taro.uploadFile.Option
    ): Promise<Taro.uploadFile.SuccessCallbackResult> => {
        const { success, fail, complete, ...rest } = option
        return (Taro.uploadFile(withAuthHeader({
            ...rest,
            url: createUrl(rest.url),
            timeout: rest.timeout || 300000,
        }, rest.url)) as unknown as Promise<Taro.uploadFile.SuccessCallbackResult>)
            .then(response => handleResult(response, success as any, complete as any))
            .catch(error => {
                fail?.(error)
                complete?.(error)
                throw error
            })
    }

    export const downloadFile = (
        option: Taro.downloadFile.Option
    ): Promise<Taro.downloadFile.FileSuccessCallbackResult> => {
        const { success, fail, complete, ...rest } = option
        return (Taro.downloadFile(withAuthHeader({
            ...rest,
            url: createUrl(rest.url),
            timeout: rest.timeout || 300000,
        }, rest.url)) as unknown as Promise<Taro.downloadFile.FileSuccessCallbackResult>)
            .then(response => handleResult(response, success as any, complete as any))
            .catch(error => {
                fail?.(error)
                complete?.(error)
                throw error
            })
    }
}
