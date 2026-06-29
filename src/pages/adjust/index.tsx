import { useState, useEffect } from 'react';
import { View, Text } from '@tarojs/components';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Network } from '@/network';
import Taro from '@tarojs/taro';
import CustomTabBar from '@/components/CustomTabBar';
import './index.css';

interface ParamConfig {
  id: number;
  param_name: string;
  param_value: number;
  param_min: number | null;
  param_max: number | null;
  param_unit: string | null;
  description: string;
  is_active: boolean;
}

const qualityOptions = [
  { value: 1, label: 'Draft (草稿)' },
  { value: 2, label: 'Standard (标准)' },
  { value: 3, label: 'High (高)' },
  { value: 4, label: 'Ultra (超高)' }
];

const AdjustPage = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [params, setParams] = useState<ParamConfig[]>([]);
  const [modifiedParams, setModifiedParams] = useState<Record<string, number>>({});

  // 检查管理员权限
  useEffect(() => {
    const checkAdmin = async () => {
      const storedIsAdmin = Taro.getStorageSync('isAdmin');
      const isLoggedIn = Taro.getStorageSync('isLoggedIn');

      if (!isLoggedIn) {
        Taro.redirectTo({ url: '/pages/login/index' });
        return;
      }

      if (!storedIsAdmin) {
        Taro.showModal({
          title: '权限不足',
          content: '您不是管理员，无法访问参数配置页面',
          showCancel: false,
          success: () => {
            Taro.switchTab({ url: '/pages/index/index' });
          }
        });
        return;
      }

      setIsAdmin(true);
      fetchParams();
    };

    checkAdmin();
  }, []);

  // 获取参数配置
  const fetchParams = async () => {
    try {
      setLoading(true);
      const response = await Network.request({
        url: '/api/config/params',
        method: 'GET'
      });

      console.log('获取参数配置:', response.data);
      
      if (response.data.code === 200) {
        setParams(response.data.data);
        
        // 初始化修改参数记录
        const initialModified: Record<string, number> = {};
        response.data.data.forEach((param: ParamConfig) => {
          initialModified[param.param_name] = param.param_value;
        });
        setModifiedParams(initialModified);
      }
    } catch (error) {
      console.error('获取参数配置失败:', error);
      Taro.showToast({ title: '获取参数失败', icon: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // 更新参数值
  const handleParamChange = (paramName: string, value: number) => {
    setModifiedParams(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  // 保存所有参数
  const handleSaveAll = async () => {
    try {
      setSaving(true);
      
      // 逐个更新参数
      for (const [paramName, value] of Object.entries(modifiedParams)) {
        const param = params.find(p => p.param_name === paramName);
        if (param && param.param_value !== value) {
          await Network.request({
            url: `/api/config/params/${param.id}`,
            method: 'PUT',
            data: { param_value: value }
          });
        }
      }

      Taro.showToast({ title: '保存成功', icon: 'success' });
      
      // 重新获取参数
      fetchParams();
    } catch (error) {
      console.error('保存参数失败:', error);
      Taro.showToast({ title: '保存失败', icon: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // 重置为默认值
  const handleReset = () => {
    const resetParams: Record<string, number> = {};
    params.forEach(param => {
      resetParams[param.param_name] = param.param_value;
    });
    setModifiedParams(resetParams);
    Taro.showToast({ title: '已重置', icon: 'success' });
  };

  // 渲染参数配置项
  const renderParamItem = (param: ParamConfig) => {
    const currentValue = modifiedParams[param.param_name] ?? param.param_value;
    const hasMin = param.param_min !== null;
    const hasMax = param.param_max !== null;

    // 特殊处理质量等级（使用 Select）
    if (param.param_name === 'quality_level') {
      return (
        <Card key={param.id} className="mb-4">
          <CardHeader className="pb-2">
            <View className="flex flex-row justify-between items-center">
              <CardTitle className="text-lg">{param.param_name}</CardTitle>
              <Text className="text-primary font-semibold">
                {qualityOptions.find(o => o.value === currentValue)?.label || currentValue}
              </Text>
            </View>
            <CardDescription className="text-sm text-on-surface-variant">
              {param.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <View className="flex flex-row items-center gap-4">
              <Label className="text-sm">选择质量等级</Label>
              <Select
                value={currentValue.toString()}
                onValueChange={(value) => handleParamChange(param.param_name, parseInt(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择质量等级" />
                </SelectTrigger>
                <SelectContent>
                  {qualityOptions.map(option => (
                    <SelectItem key={option.value} value={option.value.toString()}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </View>
          </CardContent>
        </Card>
      );
    }

    // 一般参数使用 Slider
    return (
      <Card key={param.id} className="mb-4">
        <CardHeader className="pb-2">
          <View className="flex flex-row justify-between items-center">
            <CardTitle className="text-lg">{param.param_name}</CardTitle>
            <Text className="text-primary font-semibold">
              {currentValue}{param.param_unit ? ` ${param.param_unit}` : ''}
            </Text>
          </View>
          <CardDescription className="text-sm text-on-surface-variant">
            {param.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {hasMin && hasMax ? (
            <View className="flex flex-col gap-2">
              <Slider
                value={[currentValue]}
                min={param.param_min!}
                max={param.param_max!}
                step={param.param_name === 'temperature' ? 0.1 : 1}
                onValueChange={(value) => handleParamChange(param.param_name, value[0])}
                className="w-full"
              />
              <View className="flex flex-row justify-between text-xs text-on-surface-variant">
                <Text>{param.param_min}{param.param_unit ? ` ${param.param_unit}` : ''}</Text>
                <Text>{param.param_max}{param.param_unit ? ` ${param.param_unit}` : ''}</Text>
              </View>
            </View>
          ) : (
            <Text className="text-on-surface-variant text-sm">此参数不可调整范围</Text>
          )}
        </CardContent>
      </Card>
    );
  };

  // 非管理员显示
  if (!isAdmin) {
    return (
      <View className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Text className="text-xl text-on-surface mb-4">权限验证中...</Text>
        <Text className="text-sm text-on-surface-variant">正在检查管理员权限</Text>
      </View>
    );
  }

  // 加载中
  if (loading) {
    return (
      <View className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Text className="text-xl text-on-surface mb-4">加载参数配置...</Text>
      </View>
    );
  }

  return (
    <View className="flex flex-col min-h-screen bg-background pb-16">
      {/* 页面标题 */}
      <View className="px-4 py-6 bg-surface-container-low">
        <Text className="block text-2xl font-bold text-primary mb-2">参数配置</Text>
        <Text className="block text-sm text-on-surface-variant">
          调整 AI 生成参数，优化图片生成效果
        </Text>
      </View>

      <Separator className="my-2" />

      {/* 参数列表 */}
      <View className="px-4 py-4">
        <Text className="block text-lg font-semibold text-on-surface mb-4">
          当前配置
        </Text>

        {params.map(param => renderParamItem(param))}
      </View>

      <Separator className="my-2" />

      {/* 操作按钮 */}
      <View className="px-4 py-4">
        <View className="flex flex-col gap-3">
          <Button
            className="w-full bg-primary text-on-primary"
            onClick={handleSaveAll}
            disabled={saving}
          >
            <Text className="text-on-primary">{saving ? '保存中...' : '保存配置'}</Text>
          </Button>
          
          <Button
            className="w-full bg-surface-container text-on-surface"
            onClick={handleReset}
            variant="outline"
          >
            <Text className="text-on-surface">重置为当前值</Text>
          </Button>
        </View>
      </View>

      {/* 参数说明 */}
      <View className="px-4 py-4 bg-surface-container-lowest">
        <Text className="block text-sm text-on-surface-variant mb-2">
          参数说明：
        </Text>
        <Text className="block text-xs text-on-surface-variant">
          • Temperature: 控制生成结果的创意性，值越高越随机创意，值越低越稳定一致{'\n'}
          • Style Strength: 控制图片风格化程度{'\n'}
          • Iteration Count: 图片生成迭代次数，影响细节精细度{'\n'}
          • Quality Level: 图片质量等级，影响最终输出质量{'\n'}
          • Diversity: 多样性参数，控制生成结果的多样性
        </Text>
      </View>

      {/* 自定义 TabBar */}
      <CustomTabBar />
    </View>
  );
};

export default AdjustPage;