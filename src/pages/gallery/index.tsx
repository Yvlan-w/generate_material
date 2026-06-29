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
  id: number;
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

  // 筛选选项
  const filterOptions = ['全部', '合规通过', '待审核'];

  // 加载图片列表
  useEffect(() => {
    loadImages();
  }, [filter]);

  const loadImages = async () => {
    setLoading(true);
    try {
      const response = await Network.request({
        url: '/api/image/list',
        method: 'GET',
        data: { filter }
      });

      console.log('图片列表响应:', response.data);

      if (response.data && response.data.code === 200 && response.data.data) {
        setImages(response.data.data.images || []);
      } else {
        // 使用模拟数据
        setImages([
          {
            id: 1,
            title: '专业品牌宣传',
            description: '团队协作场景',
            status: '合规通过',
            time: '今天',
            url: 'https://images.unsplash.com/photo-1551434678-e076c9db5a46?w=400&h=400&fit=crop'
          },
          {
            id: 2,
            title: '数据可视化',
            description: '业绩展示图表',
            status: '合规通过',
            time: '昨天',
            url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=400&fit=crop'
          },
          {
            id: 3,
            title: '现代办公',
            description: '办公场景展示',
            status: '合规通过',
            time: '3天前',
            url: 'https://images.unsplash.com/photo-1521737711867-e3b1e9e9e9e9?w=400&h=400&fit=crop'
          },
          {
            id: 4,
            title: '团队风采',
            description: '投资咨询团队',
            status: '待审核',
            time: '5天前',
            url: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=400&h=400&fit=crop'
          }
        ]);
      }
    } catch (error) {
      console.error('加载图片失败:', error);
      // 使用模拟数据
      setImages([
        {
          id: 1,
          title: '专业品牌宣传',
          description: '团队协作场景',
          status: '合规通过',
          time: '今天',
          url: 'https://images.unsplash.com/photo-1551434678-e076c9db5a46?w=400&h=400&fit=crop'
        },
        {
          id: 2,
          title: '数据可视化',
          description: '业绩展示图表',
          status: '合规通过',
          time: '昨天',
          url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=400&fit=crop'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // 处理图片点击
  const handleImageClick = (_imageId: number) => {
    // 跳转到微调页面，传递图片ID
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
          <View className="flex items-center justify-center h-32">
            <Text className="text-sm text-on-surface-variant">暂无图片</Text>
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
                    <Image
                      className="w-full h-full object-cover"
                      src={image.url}
                      mode="aspectFill"
                    />
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
            <Text className="text-on-surface">加载更多</Text>
          </Button>
        </View>
      )}

      {/* 自定义 TabBar */}
      <CustomTabBar />
    </View>
  );
};

export default GalleryPage;