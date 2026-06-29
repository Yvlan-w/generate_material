import { useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Network } from '@/network';
import Taro from '@tarojs/taro';
import './index.css';

/**
 * 微调页面 - 参数调整
 * 开发人员对生成图片的效果进行微调
 */
const AdjustPage = () => {
  // 风格参数
  const [styleStrength, setStyleStrength] = useState(75);
  const [styleType, setStyleType] = useState('专业稳重');
  const [artisticLevel, setArtisticLevel] = useState(30);

  // 视觉参数
  const [colorTone, setColorTone] = useState('蓝灰色');
  const [brightness, setBrightness] = useState(10);
  const [contrast, setContrast] = useState(20);
  const [saturation, setSaturation] = useState(15);
  const [warmth, setWarmth] = useState(40);

  // 构图参数
  const [compositionType, setCompositionType] = useState('居中构图');
  const [focusPosition, setFocusPosition] = useState('center');
  const [depthOfField, setDepthOfField] = useState(60);

  // 高级参数
  const [qualityLevel, setQualityLevel] = useState('高质量');
  const [iterationCount, setIterationCount] = useState(80);
  const [seedValue, setSeedValue] = useState('12345');
  const [diversityLevel, setDiversityLevel] = useState(50);

  const [isAdjusting, setIsAdjusting] = useState(false);
  const [currentImage, setCurrentImage] = useState({
    url: 'https://images.unsplash.com/photo-1551434678-e076c9db5a46?w=800&h=450&fit=crop',
    title: '专业品牌宣传图'
  });

  // 风格类型选项
  const styleTypeOptions = ['专业稳重', '现代简约', '科技感', '温暖亲和'];

  // 色调倾向选项
  const colorToneOptions = ['蓝灰色', '暖橙色', '中性灰'];

  // 处理应用调整
  const handleApplyAdjust = async () => {
    setIsAdjusting(true);

    try {
      const adjustParams = {
        styleStrength,
        styleType,
        artisticLevel,
        colorTone,
        brightness,
        contrast,
        saturation,
        warmth,
        compositionType,
        focusPosition,
        depthOfField,
        qualityLevel,
        iterationCount,
        seedValue: parseInt(seedValue) || undefined,
        diversityLevel
      };

      console.log('调整参数:', adjustParams);

      const response = await Network.request({
        url: '/api/image/adjust',
        method: 'POST',
        data: {
          imageId: 'current-image-id',
          params: adjustParams
        }
      });

      console.log('调整响应:', response.data);

      if (response.data && response.data.code === 200 && response.data.data) {
        const { imageUrl } = response.data.data;
        
        setCurrentImage({
          url: imageUrl,
          title: `${styleType}风格图片`
        });

        Taro.showToast({
          title: '调整成功！',
          icon: 'success'
        });
      } else {
        Taro.showToast({
          title: response.data?.msg || '调整失败，请重试',
          icon: 'none'
        });
      }
    } catch (error) {
      console.error('调整失败:', error);
      Taro.showToast({
        title: '调整失败，请检查网络',
        icon: 'none'
      });
    } finally {
      setIsAdjusting(false);
    }
  };

  // 重置参数
  const handleReset = () => {
    setStyleStrength(75);
    setStyleType('专业稳重');
    setArtisticLevel(30);
    setColorTone('蓝灰色');
    setBrightness(10);
    setContrast(20);
    setSaturation(15);
    setWarmth(40);
    setCompositionType('居中构图');
    setFocusPosition('center');
    setDepthOfField(60);
    setQualityLevel('高质量');
    setIterationCount(80);
    setSeedValue('12345');
    setDiversityLevel(50);
    
    Taro.showToast({
      title: '参数已重置',
      icon: 'success'
    });
  };

  // 导出配置
  const handleExportConfig = () => {
    const config = {
      version: '1.0',
      createdAt: new Date().toISOString(),
      params: {
        styleStrength,
        styleType,
        artisticLevel,
        colorTone,
        brightness,
        contrast,
        saturation,
        warmth,
        compositionType,
        focusPosition,
        depthOfField,
        qualityLevel,
        iterationCount,
        seedValue,
        diversityLevel
      }
    };

    console.log('导出配置:', JSON.stringify(config, null, 2));
    
    Taro.showToast({
      title: '配置已导出到日志',
      icon: 'success'
    });
  };

  return (
    <View className="flex flex-col h-full bg-background">
      {/* 标题区域 */}
      <View className="px-4 pt-6 pb-4">
        <Text className="block text-xl font-bold text-on-surface mb-2">参数微调</Text>
        <Text className="block text-sm text-on-surface-variant">
          调整生成参数，优化图片效果（开发人员专用）
        </Text>
      </View>

      {/* 图片预览 */}
      <View className="px-4 mb-6">
        <Card className="bg-surface-container shadow-md">
          <CardContent className="p-4">
            <View className="aspect-video bg-surface-container-high rounded-lg mb-4">
              <Image
                className="w-full h-full object-cover rounded-lg"
                src={currentImage.url}
                mode="aspectFill"
              />
            </View>
            <View className="flex items-center justify-between">
              <Text className="text-sm font-medium text-on-surface">{currentImage.title}</Text>
              <Button
                size="sm"
                variant="outline"
                className="bg-primary-container text-primary"
              >
                查看详情
              </Button>
            </View>
          </CardContent>
        </Card>
      </View>

      {/* 风格参数 */}
      <View className="px-4 mb-6">
        <Text className="block text-base font-semibold text-on-surface mb-4">风格参数</Text>
        
        {/* 风格强度 */}
        <View className="mb-4">
          <View className="flex items-center justify-between mb-2">
            <Text className="text-sm font-medium text-on-surface">风格强度</Text>
            <Text className="text-sm text-on-surface-variant">{styleStrength}%</Text>
          </View>
          <Slider
            value={[styleStrength]}
            onValueChange={(value) => setStyleStrength(value[0])}
            max={100}
            step={1}
          />
          <View className="flex justify-between text-xs text-on-surface-variant mt-1">
            <Text>保守</Text>
            <Text>激进</Text>
          </View>
        </View>

        {/* 风格类型选择 */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-on-surface mb-2 block">风格类型</Text>
          <View className="grid grid-cols-2 gap-2">
            {styleTypeOptions.map((style) => (
              <Button
                key={style}
                size="sm"
                variant={styleType === style ? 'default' : 'outline'}
                className={styleType === style 
                  ? 'bg-primary text-on-primary' 
                  : 'bg-surface-container text-on-surface border-none'}
                onClick={() => setStyleType(style)}
              >
                {style}
              </Button>
            ))}
          </View>
        </View>

        {/* 艺术感程度 */}
        <View className="mb-4">
          <View className="flex items-center justify-between mb-2">
            <Text className="text-sm font-medium text-on-surface">艺术感程度</Text>
            <Text className="text-sm text-on-surface-variant">{artisticLevel}%</Text>
          </View>
          <Slider
            value={[artisticLevel]}
            onValueChange={(value) => setArtisticLevel(value[0])}
            max={50}
            step={1}
          />
        </View>
      </View>

      {/* 视觉参数 */}
      <View className="px-4 mb-6">
        <Text className="block text-base font-semibold text-on-surface mb-4">视觉参数</Text>

        {/* 色调倾向 */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-on-surface mb-2 block">色调倾向</Text>
          <View className="flex gap-2">
            {colorToneOptions.map((tone) => (
              <Button
                key={tone}
                size="sm"
                variant={colorTone === tone ? 'default' : 'outline'}
                className={colorTone === tone 
                  ? 'bg-primary text-on-primary' 
                  : 'bg-surface-container text-on-surface border-none'}
                onClick={() => setColorTone(tone)}
              >
                {tone}
              </Button>
            ))}
          </View>
        </View>

        {/* 亮度 */}
        <View className="mb-4">
          <View className="flex items-center justify-between mb-2">
            <Text className="text-sm font-medium text-on-surface">亮度</Text>
            <Text className="text-sm text-on-surface-variant">{brightness}</Text>
          </View>
          <Slider
            value={[brightness + 50]}
            onValueChange={(value) => setBrightness(value[0] - 50)}
            max={100}
            step={1}
          />
        </View>

        {/* 对比度 */}
        <View className="mb-4">
          <View className="flex items-center justify-between mb-2">
            <Text className="text-sm font-medium text-on-surface">对比度</Text>
            <Text className="text-sm text-on-surface-variant">{contrast}</Text>
          </View>
          <Slider
            value={[contrast + 50]}
            onValueChange={(value) => setContrast(value[0] - 50)}
            max={100}
            step={1}
          />
        </View>
      </View>

      {/* 操作按钮 */}
      <View className="px-4 mb-8">
        <Button
          className="w-full bg-primary text-on-primary rounded-xl py-4 font-semibold shadow-lg mb-3"
          onClick={handleApplyAdjust}
          disabled={isAdjusting}
        >
          <Text className="text-on-primary">
            {isAdjusting ? '调整中...' : '应用调整'}
          </Text>
        </Button>

        <View className="flex gap-3">
          <Button
            className="flex-1 bg-surface-container text-on-surface border-none"
            onClick={handleReset}
          >
            <Text className="text-on-surface">重置</Text>
          </Button>
          <Button
            className="flex-1 bg-surface-container text-on-surface border-none"
            onClick={handleExportConfig}
          >
            <Text className="text-on-surface">导出配置</Text>
          </Button>
        </View>
      </View>
    </View>
  );
};

export default AdjustPage;