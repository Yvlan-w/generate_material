import { useState, useEffect } from 'react'
import { View, Image, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { X, Download, ZoomIn, ZoomOut } from 'lucide-react-taro'

interface ImagePreviewProps {
  imageUrl: string
  visible: boolean
  onClose: () => void
}

const ImagePreview = ({ imageUrl, visible, onClose }: ImagePreviewProps) => {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    if (visible) {
      setScale(1)
    }
  }, [visible, imageUrl])

  const handleDownload = () => {
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

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 1))
  }

  if (!visible) return null

  return (
    <View
      className="fixed inset-0 z-[10000] bg-black/90 flex flex-col"
      onClick={onClose}
    >
      <View
        className="flex-1 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={imageUrl}
          mode="aspectFit"
          style={{
            transform: `scale(${scale})`,
            transition: 'transform 0.2s ease',
            maxWidth: '100%',
            maxHeight: '100%'
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </View>

      <View
        className="absolute top-4 right-4 flex flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <View
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"
          onClick={handleZoomOut}
        >
          <ZoomOut size={20} color="#fff" />
        </View>
        <View
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"
          onClick={handleZoomIn}
        >
          <ZoomIn size={20} color="#fff" />
        </View>
        <View
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"
          onClick={handleDownload}
        >
          <Download size={20} color="#fff" />
        </View>
        <View
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm"
          onClick={onClose}
        >
          <X size={20} color="#fff" />
        </View>
      </View>

      <View className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
        <Text className="text-white/70 text-sm">
          缩放比例: {Math.round(scale * 100)}%
        </Text>
      </View>
    </View>
  )
}

export default ImagePreview