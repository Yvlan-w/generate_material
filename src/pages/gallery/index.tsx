import { useState, useEffect } from 'react';
import { View, Text, Image } from '@tarojs/components';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Network } from '@/network';
import Taro from '@tarojs/taro';
import CustomTabBar from '@/components/CustomTabBar';
import './index.css';

// 定义图片项类型
interface ImageItem {
  id: string;
  title: string;
  description: string;
  status: string;
  time: string;
  url: string;
}

/**
 * 图库页面 - 图片展示
 * 查看和管理所有已生成的营销素材图片
 */
const GalleryPage = () => {
  const [filter, setFilter] = useState('全部');
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // 筛选选项
  const filterOptions = ['全部', '合规通过', '待审核'];

  // 获取用户信息
  const userInfo = Taro.getStorageSync('userInfo') || {};

  // 加载图片列表
  useEffect(() => {
    loadImages();
  }, [filter]);

  const loadImages = async () => {
    setLoading(true);
    setFailedImages(new Set()); // 清除失败记录
    try {
      // 从数据库加载真实图片列表
      const response = await Network.request({
        url: '/api/image/list',
        method: 'GET',
        data: { 
          userId: userInfo.id,
          filter: filter === '全部' ? undefined : filter
        }
      });

      console.log('图片列表响应:', response.data);

      if (response.data && response.data.code === 200 && response.data.data) {
        setImages(response.data.data.images || []);
      } else {
        setImages([]);
      }
    } catch (error) {
      console.error('加载图片失败:', error);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  // 处理图片加载失败
  const handleImageError = (imageId: string) => {
    console.log('图片加载失败:', imageId);
    setFailedImages(prev => {
      const newSet = new Set(prev);
      newSet.add(imageId);  // 使用 imageId 参数
      return newSet;
    });
  };

  // 处理图片点击
  const handleImageClick = (_imageId: string) => {
    // 跳转到微调页面，传递图片ID
    // 未来可以用于查看图片详情：Taro.navigateTo({ url: `/pages/detail/index?id=${_imageId}` })
    Taro.switchTab({ url: '/pages/adjust/index' });
  };

  return (
    <View className="flex flex-col h-full bg-background">
      {/* 标题区域 */}
      <View className="px-4 pt-6 pb-4">
        <Text className="block text-xl font-bold text-on-surface mb-2">生成图片库</Text>
        <Text className="block text-sm text-on-surface-variant">
          查看和管理所有已生成的营销素材图片
        </Text>
      </View>

      {/* 筛选栏 */}
      <View className="px-4 mb-6">
        <View className="flex gap-2">
          {filterOptions.map((option) => (
            <Button
              key={option}
              size="sm"
              variant={filter === option ? 'default' : 'outline'}
              className={filter === option 
                ? 'bg-primary text-on-primary' 
                : 'bg-surface-container text-on-surface border-none'}
              onClick={() => setFilter(option)}
            >
              {option}
            </Button>
          ))}
        </View>
      </View>

      {/* 图片网格 */}
      <View className="px-4 flex-1 overflow-y-auto">
        {loading ? (
          <View className="flex items-center justify-center h-32">
            <Text className="text-sm text-on-surface-variant">加载中...</Text>
          </View>
        ) : images.length === 0 ? (
          <View className="flex flex-col items-center justify-center h-32">
            <Text className="block text-sm text-on-surface-variant mb-2">暂无图片</Text>
            <Text className="block text-xs text-on-surface-variant">
              去首页生成您的第一张营销素材吧！
            </Text>
          </View>
        ) : (
          <View className="grid grid-cols-2 gap-3">
            {images.map((image) => (
              <Card 
                key={image.id} 
                className="bg-surface-container shadow-md overflow-hidden"
                onClick={() => handleImageClick(image.id)}
              >
                <CardContent className="p-0">
                  <View className="aspect-square bg-surface-container-high">
                    {failedImages.has(image.id) ? (
                      // 图片加载失败时显示占位
                      <View className="w-full h-full flex items-center justify-center bg-gray-200">
                        <Text className="block text-xs text-gray-500">图片加载失败</Text>
                      </View>
                    ) : (
                      <Image
                        className="w-full h-full object-cover"
                        src={image.url}
                        mode="aspectFill"
                        onError={() => handleImageError(image.id)}
                      />
                    )}
                  </View>
                  <View className="p-3">
                    <Text className="block text-sm font-medium text-on-surface mb-1">{image.title}</Text>
                    <View className="flex items-center gap-2">
                      <Badge 
                        variant={image.status === '合规通过' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {image.status}
                      </Badge>
                      <Text className="text-xs text-on-surface-variant">{image.time}</Text>
                    </View>
                  </View>
                </CardContent>
              </Card>
            ))}
          </View>
        )}
      </View>

      {/* 加载更多 */}
      {images.length > 0 && (
        <View className="px-4 py-4">
          <Button
            className="w-full bg-surface-container text-on-surface border-none"
            onClick={loadImages}
          >
            <Text className="text-on-surface">刷新列表</Text>
          </Button>
        </View>
      )}

      {/* 自定义 TabBar */}
      <CustomTabBar />
    </View>
  );
};

export default GalleryPage;