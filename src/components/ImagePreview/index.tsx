import { useState, useEffect, useRef } from 'react'
import { View, Image, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { X } from 'lucide-react-taro'

interface ImagePreviewProps {
  imageUrl: string
  visible: boolean
  onClose: () => void
}

const ImagePreview = ({ imageUrl, visible, onClose }: ImagePreviewProps) => {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [showActionSheet, setShowActionSheet] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTouchDistance = useRef(0)
  const lastTouchCenter = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (visible) {
      setScale(1)
      setPosition({ x: 0, y: 0 })
    }
  }, [visible, imageUrl])

  const handleDownload = () => {
    setShowActionSheet(false)
    Taro.downloadFile({
      url: imageUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          Taro.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              Taro.showToast({ title: '保存成功', icon: 'success' })
            },
            fail: () => {
              Taro.showToast({ title: '保存失败，请检查权限', icon: 'none' })
            }
          })
        }
      },
      fail: () => {
        Taro.showToast({ title: '下载失败', icon: 'none' })
      }
    })
  }

  const handleTouchStart = (e: any) => {
    if (e.touches.length === 2) {
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      lastTouchDistance.current = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )
      lastTouchCenter.current = {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2
      }
    } else if (e.touches.length === 1) {
      longPressTimer.current = setTimeout(() => {
        setShowActionSheet(true)
      }, 800)
    }
  }

  const handleTouchMove = (e: any) => {
    if (e.touches.length === 2) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }

      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )

      const scaleFactor = currentDistance / lastTouchDistance.current
      setScale(prev => Math.min(Math.max(prev * scaleFactor, 1), 3))

      lastTouchDistance.current = currentDistance
    } else if (e.touches.length === 1) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
    }
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  if (!visible) return null

  return (
    <View
      className="fixed inset-0 z-[10000] bg-black/95 flex flex-col"
      onClick={onClose}
    >
      <View
        className="flex-1 flex items-center justify-center p-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Image
          src={imageUrl}
          mode="aspectFit"
          style={{
            transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
            transition: scale === 1 ? 'transform 0.2s ease' : 'none',
            maxWidth: '100%',
            maxHeight: '100%',
            touchAction: 'none'
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </View>

      <View
        className="absolute top-4 right-4"
        onClick={(e) => e.stopPropagation()}
      >
        <View
          className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm border border-white/30"
          onClick={onClose}
        >
          <X size={20} color="#fff" />
        </View>
      </View>

      {scale > 1 && (
        <View className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <Text className="text-white/70 text-sm">
            缩放比例: {Math.round(scale * 100)}%
          </Text>
        </View>
      )}

      {showActionSheet && (
        <View
          className="fixed inset-0 z-[10001] bg-black/50 flex items-end"
          onClick={() => setShowActionSheet(false)}
        >
          <View
            className="w-full bg-white rounded-t-2xl p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <View className="flex flex-col gap-3">
              <Text className="text-center text-gray-500 text-sm mb-2">长按图片操作</Text>
              <View
                className="w-full h-12 bg-blue-500 rounded-xl flex items-center justify-center"
                onClick={handleDownload}
              >
                <Text className="text-white text-lg font-medium">保存图片</Text>
              </View>
              <View
                className="w-full h-12 bg-gray-100 rounded-xl flex items-center justify-center"
                onClick={() => setShowActionSheet(false)}
              >
                <Text className="text-gray-600 text-lg font-medium">取消</Text>
              </View>
            </View>
            <View className="h-4"></View>
          </View>
        </View>
      )}
    </View>
  )
}

export default ImagePreview