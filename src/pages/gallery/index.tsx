import { useState, useEffect } from 'react';
import { View, Text, Image } from '@tarojs/components';
import { Button } from '@/components/ui/button';
import { Network } from '@/network';
import Taro from '@tarojs/taro';
import { ImageOff, RefreshCw, Sparkles } from 'lucide-react-taro';
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
    setFailedImages(new Set());
    try {
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
      newSet.add(imageId);
      return newSet;
    });
  };

  // 处理图片点击：把选中的图片信息存到 storage，供 adjust 页面读取
  const handleImageClick = (_imageId: string, imageUrl?: string) => {
    if (imageUrl) {
      Taro.setStorageSync('pendingAdjustImage', { imageId: _imageId, imageUrl });
    }
    Taro.switchTab({ url: '/pages/adjust/index' });
  };

  // 获取筛选按钮样式
  const getFilterButtonStyle = (option: string) => {
    const isActive = filter === option;
    return {
      backgroundColor: isActive ? '#3B82F6' : '#F1F5F9',
      color: isActive ? '#FFFFFF' : '#64748B',
      borderRadius: '12px',
      paddingLeft: '16px',
      paddingRight: '16px',
      paddingTop: '8px',
                      paddingBottom: '8px',
      fontSize: '14px',
      fontWeight: isActive ? '600' : '400',
      border: 'none'
    };
  };

  return (
    <View style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: '#F8FAFC'
    }}
    >
      {/* 标题区域 */}
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
          <Sparkles size={20} color="#3B82F6" style={{ marginRight: '8px' }} />
          <Text style={{ fontSize: '20px', fontWeight: '700', color: '#1E293B' }}>
            生成图片库
          </Text>
        </View>
        <Text style={{
          fontSize: '14px',
          color: '#64748B',
          marginTop: '8px'
        }}
        >
          查看和管理所有已生成的营销素材图片
        </Text>
      </View>

      {/* 筛选栏 */}
      <View style={{
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingTop: '16px',
          paddingBottom: '16px',
        backgroundColor: '#FFFFFF'
      }}
      >
        <View style={{ display: 'flex', flexDirection: 'row', gap: '12px' }}>
          {filterOptions.map((option) => (
            <View
              key={option}
              style={getFilterButtonStyle(option)}
              onClick={() => setFilter(option)}
            >
              <Text style={{
                fontSize: '14px',
                color: filter === option ? '#FFFFFF' : '#64748B',
                fontWeight: filter === option ? '600' : '400'
              }}
              >
                {option}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* 图片网格 */}
      <View style={{
        paddingLeft: '16px',
      paddingRight: '16px',
        paddingTop: '16px',
        flex: 1,
        paddingBottom: '80px'
      }}
      >
        {loading ? (
          <View style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '128px'
          }}
          >
            <RefreshCw size={24} color="#64748B" className="animate-spin" />
            <Text style={{
              fontSize: '14px',
              color: '#64748B',
              marginLeft: '12px'
            }}
            >
              加载中...
            </Text>
          </View>
        ) : images.length === 0 ? (
          <View style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            border: '1px solid #E2E8F0'
          }}
          >
            <ImageOff size={48} color="#94A3B8" />
            <Text style={{
              fontSize: '16px',
              color: '#64748B',
              marginTop: '16px'
            }}
            >
              暂无图片
            </Text>
            <Text style={{
              fontSize: '14px',
              color: '#94A3B8',
              marginTop: '8px'
            }}
            >
              去首页生成您的第一张营销素材吧！
            </Text>
          </View>
        ) : (
          <View style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px'
          }}
          >
            {images.map((image) => (
              <View 
                key={image.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  border: '1px solid #E2E8F0'
                }}
                onClick={() => handleImageClick(image.id, image.url)}
              >
                <View style={{
                  aspectRatio: '1',
                  backgroundColor: '#F1F5F9',
                  position: 'relative'
                }}
                >
                  {failedImages.has(image.id) ? (
                    <View style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    >
                      <ImageOff size={24} color="#94A3B8" />
                      <Text style={{
                        fontSize: '12px',
                        color: '#94A3B8',
                        marginTop: '8px'
                      }}
                      >
                        图片加载失败
                      </Text>
                    </View>
                  ) : (
                    <Image
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                      src={image.url}
                      mode="aspectFill"
                      onError={() => handleImageError(image.id)}
                    />
                  )}
                </View>
                <View style={{ padding: '12px' }}>
                  <Text style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: '#1E293B',
                    marginBottom: '8px'
                  }}
                  >
                    {image.title}
                  </Text>
                  <View style={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  >
                    <View style={{
                      backgroundColor: image.status === '合规通过' ? '#D1FAE5' : '#FEF3C7',
                      borderRadius: '8px',
                      paddingLeft: '8px',
                      paddingRight: '8px',
                      paddingTop: '4px',
                      paddingBottom: '4px'
                    }}
                    >
                      <Text style={{
                        fontSize: '12px',
                        color: image.status === '合规通过' ? '#047857' : '#B45309',
                        fontWeight: '500'
                      }}
                      >
                        {image.status}
                      </Text>
                    </View>
                    <Text style={{
                      fontSize: '12px',
                      color: '#94A3B8'
                    }}
                    >
                      {image.time}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 刷新按钮 */}
      {images.length > 0 && (
        <View style={{
          paddingLeft: '20px',
        paddingRight: '20px',
          paddingTop: '16px',
          paddingBottom: '80px'
        }}
        >
          <Button
            style={{
              width: '100%',
              backgroundColor: '#F1F5F9',
              borderRadius: '12px',
              height: '44px'
            }}
            onClick={loadImages}
          >
            <RefreshCw size={16} color="#64748B" style={{ marginRight: '8px' }} />
            <Text style={{ fontSize: '14px', color: '#64748B' }}>刷新列表</Text>
          </Button>
        </View>
      )}

      {/* 自定义 TabBar */}
      <CustomTabBar />
    </View>
  );
};

export default GalleryPage;