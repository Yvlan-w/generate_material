import { useState } from 'react';
import { View, Text } from '@tarojs/components';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Network } from '@/network';
import Taro from '@tarojs/taro';
import './index.css';

/**
 * 首页 - 用户输入界面
 * 用户通过自然语言提问描述图片需求
 */
const IndexPage = () => {
  const [userInput, setUserInput] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('专业稳重');
  const [isGenerating, setIsGenerating] = useState(false);
  const [recentImages, setRecentImages] = useState([
    {
      id: 1,
      title: '专业品牌宣传图',
      description: '蓝色主色调，团队协作场景',
      status: '合规通过',
      time: '2小时前',
      url: ''
    },
    {
      id: 2,
      title: '数据可视化图表',
      description: '现代简约风格，业绩展示',
      status: '合规通过',
      time: '昨天',
      url: ''
    }
  ]);

  // 快捷风格标签
  const styleTags = ['专业稳重', '现代简约', '科技感', '温暖亲和', '数据可视化', '团队风采'];

  // 处理风格标签点击
  const handleStyleTagClick = (style: string) => {
    setSelectedStyle(style);
    // 自动添加风格提示到输入框
    if (!userInput) {
      setUserInput(`生成一张${style}风格的营销素材图片，`);
    }
  };

  // 处理生成按钮点击
  const handleGenerate = async () => {
    if (!userInput.trim()) {
      Taro.showToast({
        title: '请先描述您的图片需求',
        icon: 'none'
      });
      return;
    }

    setIsGenerating(true);

    try {
      const response = await Network.request({
        url: '/api/image/generate',
        method: 'POST',
        data: {
          userInput: userInput,
          style: selectedStyle
        }
      });

      console.log('生成响应:', response.data);

      // 检查响应结构
      if (response.data && response.data.code === 200 && response.data.data) {
        const { imageUrl, compliant, message } = response.data.data;

        // 添加到最近生成列表
        const newImage = {
          id: Date.now(),
          title: `${selectedStyle}风格图片`,
          description: userInput.slice(0, 30),
          status: compliant ? '合规通过' : '待审核',
          time: '刚刚',
          url: imageUrl
        };

        setRecentImages([newImage, ...recentImages.slice(0, 4)]);
        
        Taro.showToast({
          title: compliant ? '生成成功！' : message || '生成成功，待审核',
          icon: 'success'
        });

        // 跳转到图库页面查看生成的图片
        Taro.switchTab({ url: '/pages/gallery/index' });
      } else {
        Taro.showToast({
          title: response.data?.msg || '生成失败，请重试',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('生成失败:', error);
      Taro.showToast({
        title: '生成失败，请检查网络',
        icon: 'none'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View className="flex flex-col h-full bg-background">
      {/* 标题区域 */}
      <View className="px-4 pt-6 pb-4">
        <Text className="block text-xl font-bold text-on-surface mb-2">描述您的图片需求</Text>
        <Text className="block text-sm text-on-surface-variant">
          通过自然语言描述，AI将为您生成符合投资咨询行业规范的营销素材图片
        </Text>
      </View>

      {/* 输入区域 */}
      <View className="px-4 mb-6">
        <View className="bg-surface-container rounded-xl p-4">
          <Textarea
            className="bg-transparent text-on-surface placeholder:text-on-surface-variant"
            placeholder="例如：生成一张专业稳重的品牌宣传图，蓝色为主色调，展示团队协作场景..."
            value={userInput}
            onInput={(e) => setUserInput(e.detail.value)}
            maxlength={500}
          />
          <View className="flex justify-end mt-2">
            <Text className="text-xs text-on-surface-variant">{userInput.length}/500</Text>
          </View>
        </View>
      </View>

      {/* 快捷风格标签 */}
      <View className="px-4 mb-6">
        <Text className="block text-sm font-semibold text-on-surface mb-3">快捷风格选择</Text>
        <View className="flex flex-wrap gap-2">
          {styleTags.map((style) => (
            <Button
              key={style}
              size="sm"
              variant={selectedStyle === style ? 'default' : 'outline'}
              className={selectedStyle === style 
                ? 'bg-primary text-on-primary' 
                : 'bg-surface-container text-on-surface border-none'}
              onClick={() => handleStyleTagClick(style)}
            >
              {style}
            </Button>
          ))}
        </View>
      </View>

      {/* 合规提示 */}
      <View className="px-4 mb-6">
        <View className="bg-primary-container bg-opacity-30 rounded-lg p-3">
          <View className="flex items-start gap-2">
            <Text className="text-xs text-on-surface-variant">
              所有生成的图片都将经过合规审核，确保符合投资咨询行业规范，不包含收益承诺、夸大宣传等违规内容
            </Text>
          </View>
        </View>
      </View>

      {/* 生成按钮 */}
      <View className="px-4 mb-8">
        <Button
          className="w-full bg-primary text-on-primary rounded-xl py-4 font-semibold shadow-lg"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          <View className="flex items-center justify-center gap-2">
            {isGenerating ? (
              <Text className="text-on-primary">生成中...</Text>
            ) : (
              <Text className="text-on-primary">开始生成</Text>
            )}
          </View>
        </Button>
      </View>

      {/* 最近生成 */}
      <View className="px-4 flex-1">
        <Text className="block text-base font-semibold text-on-surface mb-4">最近生成</Text>
        <View className="space-y-3">
          {recentImages.map((image) => (
            <Card key={image.id} className="bg-surface-container shadow-md">
              <CardContent className="p-3">
                <View className="flex gap-3">
                  <View className="w-20 h-20 bg-surface-container-high rounded-lg flex items-center justify-center">
                    {image.url ? (
                      <Text className="text-xs text-on-surface-variant">图片</Text>
                    ) : (
                      <Text className="text-xs text-on-surface-variant">暂无</Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="block text-sm font-medium text-on-surface mb-1">{image.title}</Text>
                    <Text className="block text-xs text-on-surface-variant mb-2">{image.description}</Text>
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
                </View>
              </CardContent>
            </Card>
          ))}
        </View>
      </View>
    </View>
  );
};

export default IndexPage;