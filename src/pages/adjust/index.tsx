import { useState, useEffect } from 'react';
import { View, Text, Image } from '@tarojs/components';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Network } from '@/network';
import Taro from '@tarojs/taro';
import { Settings, Save, RefreshCw, Info, LoaderCircle, Image as ImageIcon, Sparkles } from 'lucide-react-taro';
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

interface PendingImage {
  imageId: string;
  imageUrl: string;
}

const AdjustPage = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [params, setParams] = useState<ParamConfig[]>([]);
  const [modifiedParams, setModifiedParams] = useState<Record<string, number>>({});
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustedUrl, setAdjustedUrl] = useState<string>('');

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

      // 读取图库传过来的待微调图片
      const pending = Taro.getStorageSync('pendingAdjustImage');
      if (pending && pending.imageUrl) {
        setPendingImage(pending);
        Taro.removeStorageSync('pendingAdjustImage');
      }
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

  // 使用当前参数微调待处理图片
  const handleApplyAdjustment = async () => {
    if (!pendingImage) {
      Taro.showToast({ title: '请先从图库选择图片', icon: 'none' });
      return;
    }
    try {
      setAdjusting(true);
      const styleType = modifiedParams.style_type ?? modifiedParams.styleType;
      const colorTone = modifiedParams.color_tone ?? modifiedParams.colorTone;
      const brightness = modifiedParams.brightness ?? modifiedParams.brightness_value ?? 0;
      const contrast = modifiedParams.contrast ?? modifiedParams.contrast_value ?? 0;

      const response = await Network.request({
        url: '/api/image/adjust',
        method: 'POST',
        data: {
          imageId: pendingImage.imageId,
          imageUrl: pendingImage.imageUrl,
          params: {
            styleType: styleType ? String(styleType) : undefined,
            colorTone: colorTone ? String(colorTone) : undefined,
            brightness: Number(brightness) || 0,
            contrast: Number(contrast) || 0,
          },
        },
      });

      if (response.data?.code === 200 && response.data.data?.imageUrl) {
        setAdjustedUrl(response.data.data.imageUrl);
        Taro.showToast({ title: '已生成微调版本', icon: 'success' });
      } else {
        Taro.showToast({ title: '微调失败', icon: 'error' });
      }
    } catch (error) {
      console.error('微调失败:', error);
      Taro.showToast({ title: '网络异常', icon: 'error' });
    } finally {
      setAdjusting(false);
    }
  };

  // 渲染参数配置项
  const renderParamItem = (param: ParamConfig) => {
    const currentValue = modifiedParams[param.param_name] ?? param.param_value;
    const hasMin = param.param_min !== null;
    const hasMax = param.param_max !== null;

    return (
      <View 
        key={param.id}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          border: '1px solid #E2E8F0'
        }}
      >
        {/* 参数标题 */}
        <View style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}
        >
          <Text style={{
            fontSize: '16px',
            fontWeight: '600',
            color: '#1E293B'
          }}
          >
            {param.param_name}
          </Text>
          <View style={{
            backgroundColor: '#DBEAFE',
            borderRadius: '8px',
            paddingLeft: '12px',
            paddingRight: '12px',
            paddingTop: '4px',
            paddingBottom: '4px'
          }}
          >
            <Text style={{
              fontSize: '14px',
              fontWeight: '600',
              color: '#3B82F6'
            }}
            >
              {currentValue}{param.param_unit ? ` ${param.param_unit}` : ''}
            </Text>
          </View>
        </View>
        
        {/* 参数描述 */}
        <Text style={{
          fontSize: '13px',
          color: '#64748B',
          marginBottom: '12px'
        }}
        >
          {param.description}
        </Text>
        
        {/* 滑块 */}
        {hasMin && hasMax ? (
          <View>
            <Slider
              value={[currentValue]}
              min={param.param_min!}
              max={param.param_max!}
              step={param.param_name === 'temperature' ? 0.1 : 1}
              onValueChange={(value) => handleParamChange(param.param_name, value[0])}
              className="w-full"
            />
            <View style={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginTop: '8px'
            }}
            >
              <Text style={{ fontSize: '12px', color: '#94A3B8' }}>
                {param.param_min}{param.param_unit ? ` ${param.param_unit}` : ''}
              </Text>
              <Text style={{ fontSize: '12px', color: '#94A3B8' }}>
                {param.param_max}{param.param_unit ? ` ${param.param_unit}` : ''}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={{ fontSize: '12px', color: '#94A3B8' }}>
            此参数不可调整范围
          </Text>
        )}
      </View>
    );
  };

  // 非管理员显示
  if (!isAdmin) {
    return (
      <View style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        padding: '16px'
      }}
      >
        <LoaderCircle size={32} color="#64748B" className="animate-spin" />
        <Text style={{
          fontSize: '16px',
          color: '#64748B',
          marginTop: '16px'
        }}
        >
          权限验证中...
        </Text>
        <Text style={{
          fontSize: '14px',
          color: '#94A3B8',
          marginTop: '8px'
        }}
        >
          正在检查管理员权限
        </Text>
      </View>
    );
  }

  // 加载中
  if (loading) {
    return (
      <View style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#F8FAFC',
        padding: '16px'
      }}
      >
        <Settings size={32} color="#3B82F6" />
        <Text style={{
          fontSize: '16px',
          color: '#64748B',
          marginTop: '16px'
        }}
        >
          加载参数配置...
        </Text>
      </View>
    );
  }

  return (
    <View style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#F8FAFC',
      paddingBottom: '80px'
    }}
    >
      {/* 页面标题 */}
      <View style={{
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingTop: '24px',
        paddingBottom: '16px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0'
      }}
      >
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <Settings size={20} color="#3B82F6" style={{ marginRight: '8px' }} />
          <Text style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
            参数配置
          </Text>
        </View>
        <Text style={{
          fontSize: '14px',
          color: '#64748B',
          marginTop: '8px'
        }}
        >
          调整 AI 生成参数，优化图片生成效果
        </Text>
      </View>

      {/* 待微调图片预览 */}
      {pendingImage && (
        <View style={{
          marginLeft: '16px',
          marginRight: '16px',
          marginTop: '16px',
          padding: '16px',
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          border: '1px solid #E2E8F0',
        }}
        >
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '12px' }}>
            <ImageIcon size={18} color="#3B82F6" style={{ marginRight: '8px' }} />
            <Text style={{ fontSize: '15px', fontWeight: '600', color: '#1E293B' }}>
              待微调图片
            </Text>
          </View>
          <Image
            src={adjustedUrl || pendingImage.imageUrl}
            mode="widthFix"
            style={{
              width: '100%',
              borderRadius: '12px',
              backgroundColor: '#F1F5F9',
            }}
          />
          {adjustedUrl && (
            <Text style={{ fontSize: '12px', color: '#10B981', marginTop: '10px', display: 'block' }}>
              已生成微调版本（对比上方原图）
            </Text>
          )}
          <Button
            style={{
              width: '100%',
              marginTop: '12px',
              backgroundColor: '#3B82F6',
              borderRadius: '12px',
              height: '44px',
            }}
            onClick={handleApplyAdjustment}
            disabled={adjusting}
          >
            {adjusting ? (
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <LoaderCircle size={16} color="#FFFFFF" className="animate-spin" />
                <Text style={{ color: '#FFFFFF', fontSize: '14px', marginLeft: '8px' }}>微调中...</Text>
              </View>
            ) : (
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                <Sparkles size={16} color="#FFFFFF" style={{ marginRight: '8px' }} />
                <Text style={{ color: '#FFFFFF', fontSize: '14px' }}>应用参数微调</Text>
              </View>
            )}
          </Button>
        </View>
      )}

      {/* 参数列表 */}
      <View style={{
        paddingLeft: '16px',
        paddingRight: '16px',
        paddingTop: '16px',
        flex: 1
      }}
      >
        <Text style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#1E293B',
          marginBottom: '12px'
        }}
        >
          当前配置
        </Text>

        {params.map(param => renderParamItem(param))}
      </View>

      {/* 操作按钮 */}
      <View style={{
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingTop: '16px',
        paddingBottom: '16px'
      }}
      >
        <Button
          style={{
            width: '100%',
            backgroundColor: '#3B82F6',
            borderRadius: '12px',
            height: '44px',
            marginBottom: '12px'
          }}
          onClick={handleSaveAll}
          disabled={saving}
        >
          {saving ? (
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <LoaderCircle size={16} color="#FFFFFF" className="animate-spin" />
              <Text style={{ color: '#FFFFFF', fontSize: '14px', marginLeft: '8px' }}>保存中...</Text>
            </View>
          ) : (
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Save size={16} color="#FFFFFF" style={{ marginRight: '8px' }} />
              <Text style={{ color: '#FFFFFF', fontSize: '14px' }}>保存配置</Text>
            </View>
          )}
        </Button>
        
        <Button
          style={{
            width: '100%',
            backgroundColor: '#F1F5F9',
            borderRadius: '12px',
            height: '44px'
          }}
          onClick={handleReset}
          variant="outline"
        >
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <RefreshCw size={16} color="#64748B" style={{ marginRight: '8px' }} />
            <Text style={{ color: '#64748B', fontSize: '14px' }}>重置为当前值</Text>
          </View>
        </Button>
      </View>

      {/* 参数说明 */}
      <View style={{
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingTop: '16px',
        paddingBottom: '16px',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E2E8F0'
      }}
      >
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '12px' }}>
          <Info size={16} color="#64748B" style={{ marginRight: '8px' }} />
          <Text style={{ fontSize: '14px', fontWeight: '600', color: '#64748B' }}>
            参数说明
          </Text>
        </View>
        <View style={{
          backgroundColor: '#F1F5F9',
          borderRadius: '12px',
          padding: '12px'
        }}
        >
          <Text style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.6' }}>
            • Temperature: 控制生成结果的创意性{'\n'}
            • Style Strength: 控制图片风格化程度{'\n'}
            • Iteration Count: 图片生成迭代次数{'\n'}
            • Quality Level: 图片质量等级{'\n'}
            • Diversity: 多样性参数
          </Text>
        </View>
      </View>

      {/* 自定义 TabBar */}
      <CustomTabBar />
    </View>
  );
};

export default AdjustPage;