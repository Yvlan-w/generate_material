import { useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Network } from '@/network';
import { Send, Bot, User, TriangleAlert, Check, LoaderCircle, Sparkles, Image as ImageIcon } from 'lucide-react-taro';
import CustomTabBar from '@/components/CustomTabBar';
import './index.css';

/**
 * 消息类型定义
 */
interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  type?: 'text' | 'image' | 'compliance-result' | 'violation-warning' | 'thinking';
  data?: any;
}

/**
 * 根据当前对话阶段和用户最新消息，推断给用户的"处理中"提示
 */
function getProcessingHint(
  stage: SessionState['stage'],
  latestUserMessage: string,
): string | null {
  const msg = latestUserMessage.trim();
  const stageLabelMap: Record<string, string> = {
    collecting: '正在分析您的需求...',
    'compliance-checking': '正在进行合规校验...',
    generating: '正在为您生成素材...',
    completed: '正在调整并生成新素材...',
    violation: '正在分析您的修改意见...',
  };

  // 如果当前在 collecting，且消息已经表达了完整意图，会自动进入生成流程
  if (stage === 'collecting') {
    const autoGenerateTrigger = /生成|开始|确认|就这样|出图|开始做/.test(msg);
    if (autoGenerateTrigger) {
      return '正在进行合规校验并生成素材，请稍候...';
    }
    return stageLabelMap.collecting;
  }

  return stageLabelMap[stage] || '正在处理您的请求...';
}

/**
 * 对话状态定义
 */
interface SessionState {
  sessionId: string;
  stage: 'collecting' | 'compliance-checking' | 'generating' | 'completed' | 'violation';
  structuredNeeds?: any;
  complianceResult?: any;
  generatedImage?: string;
}

/**
 * 首页 - 多轮对话式需求收集界面
 * 用户通过自然语言提问，Agent逐步引导收集需求
 */
const IndexPage = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'agent',
      content: '您好！我是投资咨询行业营销素材生成助手。\n\n我将帮您生成符合行业规范的营销素材图片。请告诉我您希望生成什么类型的图片？\n\n例如：品牌宣传图、团队风采展示、数据可视化图表、产品介绍海报等。',
      timestamp: new Date(),
      type: 'text'
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>({
    sessionId: `session_${Date.now()}`,
    stage: 'collecting'
  });

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isProcessing) return;
    
    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
      type: 'text'
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);

    // 根据当前阶段给出不同的"处理中"提示，让用户感知到后台在做什么
    const processingHint = getProcessingHint(sessionState.stage, userMessage.content);
    if (processingHint) {
      const tempMessage: Message = {
        id: `msg_${Date.now()}_thinking`,
        role: 'agent',
        content: processingHint,
        timestamp: new Date(),
        type: 'thinking',
      };
      setMessages(prev => [...prev, tempMessage]);
    }
    
    try {
      const userInfo = Taro.getStorageSync('userInfo') || {};
      
      console.log('调用对话API:', {
        url: '/api/image/chat',
        method: 'POST',
        data: {
          sessionId: sessionState.sessionId,
          message: userMessage.content,
          stage: sessionState.stage,
          userId: userInfo.id
        }
      });
      
      const response = await Network.request({
        url: '/api/image/chat',
        method: 'POST',
        data: {
          sessionId: sessionState.sessionId,
          message: userMessage.content,
          stage: sessionState.stage,
          userId: userInfo.id
        }
      });
      
      console.log('对话API响应:', response.data);
      
      const { code, msg, data } = response.data;
      
      console.log('[DEBUG] API response code:', code);
      console.log('[DEBUG] API response data:', JSON.stringify(data, null, 2));
      console.log('[DEBUG] Has reply:', !!data.reply);
      console.log('[DEBUG] Has generatedImage:', !!data.generatedImage);
      console.log('[DEBUG] Stage:', data.stage);
      console.log('[DEBUG] Type:', data.type);
      
      if (code === 200) {
        setSessionState(prev => ({
          ...prev,
          stage: data.stage,
          structuredNeeds: data.structuredNeeds,
          complianceResult: data.complianceResult,
          generatedImage: data.generatedImage
        }));

        // 移除之前添加的 thinking 占位消息（用真实的 reply / image 替换它的位置）
        setMessages(prev => prev.filter((m) => m.type !== 'thinking'));

        if (data.reply) {
          const agentMessage: Message = {
            id: `msg_${Date.now()}_agent`,
            role: 'agent',
            content: data.reply,
            timestamp: new Date(),
            type: data.type || 'text',
            data: data.data
          };
          setMessages(prev => [...prev, agentMessage]);
        }
        
        if (data.stage === 'violation' && data.complianceResult) {
          const warningMessage: Message = {
            id: `msg_${Date.now()}_warning`,
            role: 'system',
            content: `合规校验未通过\n\n违规方面：${data.complianceResult.violationAspects}\n\n改进建议：${data.complianceResult.suggestions}`,
            timestamp: new Date(),
            type: 'violation-warning',
            data: data.complianceResult
          };
          setMessages(prev => [...prev, warningMessage]);
        }
        
        if (data.stage === 'generating' && data.complianceResult?.passed) {
          const complianceMessage: Message = {
            id: `msg_${Date.now()}_compliance`,
            role: 'system',
            content: '合规校验通过，正在生成图片...',
            timestamp: new Date(),
            type: 'compliance-result'
          };
          setMessages(prev => [...prev, complianceMessage]);
        }
        
        if (data.stage === 'completed' && data.generatedImage) {
          const imageMessage: Message = {
            id: `msg_${Date.now()}_image`,
            role: 'agent',
            content: '',
            timestamp: new Date(),
            type: 'image',
            data: {
              imageUrl: data.generatedImage,
              needs: data.structuredNeeds,
              disclaimer: data.disclaimer
            }
          };
          setMessages(prev => [...prev, imageMessage]);
        }
      } else {
        setMessages(prev => prev.filter((m) => m.type !== 'thinking'));
        const errorMessage: Message = {
          id: `msg_${Date.now()}_error`,
          role: 'system',
          content: `抱歉，处理过程中出现错误：${msg}`,
          timestamp: new Date(),
          type: 'text'
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('对话API调用失败:', error);
      setMessages(prev => prev.filter((m) => m.type !== 'thinking'));
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: 'system',
        content: '抱歉，网络连接出现问题，请稍后重试。',
        timestamp: new Date(),
        type: 'text'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // 图片上传处理
  const handleImageUpload = async () => {
    try {
      const userInfo = Taro.getStorageSync('userInfo') || {};
      const isWeapp = Taro.getEnv() === Taro.ENV_TYPE.WEAPP;

      Taro.chooseImage({
        count: 9,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          const tempFilePaths = res.tempFilePaths;
          if (tempFilePaths.length === 0) return;

          setIsProcessing(true);

          try {
            let uploadedUrls: string[] = [];

            if (isWeapp) {
              // 小程序端：使用 Network.uploadFile
              const uploadPromises = tempFilePaths.map((filePath) => {
                return Network.uploadFile({
                  url: '/api/image/upload',
                  filePath,
                  name: 'image',
                  formData: {
                    userId: userInfo.id || ''
                  }
                });
              });

              const results = await Promise.all(uploadPromises);
              uploadedUrls = results
                .filter(r => r.data && JSON.parse(r.data).code === 200)
                .map(r => JSON.parse(r.data).data.url);
            } else {
              // H5端：使用原生 fetch + FormData，绕过 Taro uploadFile（Coze SW 拦截问题）
              const tempFiles = (res as any).tempFiles as File[] || [];
              if (tempFiles.length === 0) {
                throw new Error('未获取到文件对象');
              }

              const uploadUrl = `${PROJECT_DOMAIN}/api/image/upload`;
              const uploadPromises = tempFiles.map((file) => {
                const formData = new FormData();
                formData.append('image', file);
                formData.append('userId', userInfo.id || '');

                return fetch(uploadUrl, {
                  method: 'POST',
                  body: formData,
                  credentials: 'include'
                }).then(resp => resp.json());
              });

              const results = await Promise.all(uploadPromises);
              uploadedUrls = results
                .filter(r => r && r.code === 200)
                .map(r => r.data.url);
            }

            if (uploadedUrls.length > 0) {
              Taro.showActionSheet({
                itemList: ['作为参考图片', '作为包含元素'],
                success: (actionRes) => {
                  const imageUrls = uploadedUrls;
                  if (actionRes.tapIndex === 0) {
                    handleAddReferenceImages(imageUrls);
                  } else {
                    handleAddIncludedElements(imageUrls);
                  }
                },
                fail: () => {
                  setIsProcessing(false);
                }
              });
            } else {
              Taro.showToast({ title: '图片上传失败', icon: 'error' });
              setIsProcessing(false);
            }
          } catch (uploadError) {
            console.error('上传失败:', uploadError);
            Taro.showToast({ title: '图片上传失败', icon: 'error' });
            setIsProcessing(false);
          }
        },
        fail: () => {
          setIsProcessing(false);
        }
      });
    } catch (error) {
      console.error('图片上传失败:', error);
      setIsProcessing(false);
    }
  };

  const handleAddReferenceImages = (urls: string[]) => {
    setSessionState(prev => ({
      ...prev,
      structuredNeeds: {
        ...prev.structuredNeeds,
        referenceImages: [...(prev.structuredNeeds?.referenceImages || []), ...urls]
      }
    }));
    
    const imageMessage: Message = {
      id: `msg_${Date.now()}_image_upload`,
      role: 'user',
      content: `上传了 ${urls.length} 张参考图片`,
      timestamp: new Date(),
      type: 'image',
      data: {
        imageUrl: urls[0],
        imageUrls: urls,
        imageType: 'reference'
      }
    };
    setMessages(prev => [...prev, imageMessage]);
    
    handleSendMessageWithImage('reference', urls);
  };

  const handleAddIncludedElements = (urls: string[]) => {
    const newElements = urls.map(url => ({
      type: 'image' as const,
      value: url
    }));
    
    setSessionState(prev => ({
      ...prev,
      structuredNeeds: {
        ...prev.structuredNeeds,
        includedElements: [...(prev.structuredNeeds?.includedElements || []), ...newElements]
      }
    }));
    
    const imageMessage: Message = {
      id: `msg_${Date.now()}_image_upload`,
      role: 'user',
      content: `上传了 ${urls.length} 张素材图片`,
      timestamp: new Date(),
      type: 'image',
      data: {
        imageUrl: urls[0],
        imageUrls: urls,
        imageType: 'included'
      }
    };
    setMessages(prev => [...prev, imageMessage]);
    
    handleSendMessageWithImage('included', urls);
  };

  const handleSendMessageWithImage = async (imageType: 'reference' | 'included', urls: string[]) => {
    try {
      const userInfo = Taro.getStorageSync('userInfo') || {};
      
      const response = await Network.request({
        url: '/api/image/chat',
        method: 'POST',
        data: {
          sessionId: sessionState.sessionId,
          message: `上传了${imageType === 'reference' ? '参考' : '素材'}图片`,
          stage: sessionState.stage,
          userId: userInfo.id,
          imageType,
          imageUrls: urls
        }
      });

      const { code, data } = response.data;
      if (code === 200) {
        setSessionState(prev => ({
          ...prev,
          stage: data.stage,
          structuredNeeds: data.structuredNeeds
        }));
        
        if (data.reply) {
          const agentMessage: Message = {
            id: `msg_${Date.now()}_agent`,
            role: 'agent',
            content: data.reply,
            timestamp: new Date(),
            type: data.type || 'text'
          };
          setMessages(prev => [...prev, agentMessage]);
        }
      }
    } catch (error) {
      console.error('图片上传后发送消息失败:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  const handleReset = () => {
    setMessages([
      {
        id: 'init',
        role: 'agent',
        content: '您好！我是投资咨询行业营销素材生成助手。\n\n我将帮您生成符合行业规范的营销素材图片。请告诉我您希望生成什么类型的图片？',
        timestamp: new Date(),
        type: 'text'
      }
    ]);
    setSessionState({
      sessionId: `session_${Date.now()}`,
      stage: 'collecting'
    });
  };

  // 获取阶段状态Badge
  const getStageBadge = () => {
    const stageConfig = {
      collecting: { text: '需求收集', bg: '#E0F2FE', color: '#0369A1' },
      'compliance-checking': { text: '合规校验', bg: '#FEF3C7', color: '#B45309' },
      generating: { text: '图片生成', bg: '#DBEAFE', color: '#1E40AF' },
      completed: { text: '已完成', bg: '#D1FAE5', color: '#047857' },
      violation: { text: '需要优化', bg: '#FEE2E2', color: '#B91C1C' }
    };
    
    const config = stageConfig[sessionState.stage];
    return (
      <View style={{
        backgroundColor: config.bg,
        color: config.color,
        borderRadius: '12px',
        paddingLeft: '12px',
          paddingRight: '12px',
        paddingTop: '4px',
          paddingBottom: '4px',
        marginLeft: '8px'
      }}
      >
        <Text style={{ fontSize: '12px', color: config.color, fontWeight: '500' }}>
          {config.text}
        </Text>
      </View>
    );
  };

  // 渲染消息内容
  const renderMessage = (message: Message) => {
    if (message.type === 'thinking') {
      return (
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <LoaderCircle size={14} color="#64748B" className="animate-spin" />
          <Text style={{ fontSize: '14px', color: '#475569', marginLeft: '6px' }}>
            {message.content}
          </Text>
        </View>
      );
    }

    if (message.type === 'image') {
      return (
        <Card style={{
          marginTop: '12px',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: 'none'
        }}
        >
          <CardContent style={{ padding: '16px' }}>
            <Image 
              src={message.data?.imageUrl}
              className="w-full rounded-lg"
              mode="widthFix"
              style={{ borderRadius: '12px' }}
            />
            {message.data?.needs && (
              <View style={{ marginTop: '16px' }}>
                <Text className="block text-sm font-semibold text-gray-700">
                  需求摘要：
                </Text>
                <Text className="block text-sm text-gray-600 mt-2">
                  {message.data.needs.summary}
                </Text>
              </View>
            )}
            {message.data?.disclaimer && (
              <View style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: '#F8FAFC',
                borderRadius: '8px'
              }}
              >
                <Text className="block text-xs text-gray-500">
                  {message.data.disclaimer}
                </Text>
              </View>
            )}
          </CardContent>
        </Card>
      );
    }
    
    if (message.type === 'violation-warning') {
      return (
        <View style={{
          marginTop: '12px',
          backgroundColor: '#FEF2F2',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid #FECACA'
        }}
        >
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '8px' }}>
            <TriangleAlert size={18} color="#DC2626" style={{ marginRight: '8px' }} />
            <Text className="block text-sm font-semibold text-red-700">
              合规校验未通过
            </Text>
          </View>
          {message.data?.violationAspects && (
            <Text className="block text-sm text-red-600 mt-2">
              违规方面：{message.data.violationAspects}
            </Text>
          )}
          {message.data?.suggestions && (
            <Text className="block text-sm text-red-600 mt-2">
              改进建议：{message.data.suggestions}
            </Text>
          )}
        </View>
      );
    }
    
    if (message.type === 'compliance-result') {
      return (
        <View style={{
          marginTop: '12px',
          backgroundColor: '#F0FDF4',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid #BBF7D0'
        }}
        >
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Check size={18} color="#16A34A" style={{ marginRight: '8px' }} />
            <Text className="block text-sm font-semibold text-green-700">
              合规校验通过
            </Text>
          </View>
        </View>
      );
    }
    
    return (
      <Text className="block text-sm whitespace-pre-wrap" style={{ lineHeight: '1.6' }}>
        {message.content}
      </Text>
    );
  };

  return (
    <View style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: '#F8FAFC'
    }}
    >
      {/* 顶部状态栏 */}
      <View style={{
        position: 'sticky',
        top: 0,
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        paddingLeft: '16px',
          paddingRight: '16px',
        paddingTop: '12px',
          paddingBottom: '12px',
        zIndex: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}
      >
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Sparkles size={20} color="#3B82F6" style={{ marginRight: '8px' }} />
            <Text style={{ fontSize: '18px', fontWeight: '600', color: '#1E293B' }}>
              营销素材生成
            </Text>
            {getStageBadge()}
          </View>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleReset}
            style={{
              borderRadius: '12px',
              backgroundColor: '#F1F5F9'
            }}
          >
            <Text style={{ fontSize: '12px', color: '#64748B' }}>重新开始</Text>
          </Button>
        </View>
      </View>

      {/* 对话历史区域 */}
      <ScrollArea style={{ 
        flex: 1, 
        paddingLeft: '16px',
          paddingRight: '16px', 
        paddingTop: '16px',
          paddingBottom: '160px'
      }}
      >
        {messages.map((message) => (
          <View 
            key={message.id}
            style={{
              display: 'flex',
              marginBottom: '16px',
              justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <View 
              style={{
                display: 'flex',
                maxWidth: '85%',
                flexDirection: message.role === 'user' ? 'row-reverse' : 'row'
              }}
            >
              {/* 角色图标 */}
              <View 
                style={{
                  flexShrink: 0,
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: message.role === 'user' ? '#DBEAFE' : '#F1F5F9',
                  marginLeft: message.role === 'user' ? '8px' : '0',
                  marginRight: message.role === 'user' ? '0' : '8px'
                }}
              >
                {message.role === 'user' 
                  ? <User size={18} color="#3B82F6" /> 
                  : <Bot size={18} color="#64748B" />
                }
              </View>
              
              {/* 消息内容 */}
              <View 
                style={{
                  borderRadius: '16px',
                  padding: '12px 16px',
                  backgroundColor: message.role === 'user'
                    ? '#DBEAFE'
                    : '#FFFFFF',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  border: message.role === 'user' ? 'none' : '1px solid #E2E8F0'
                }}
              >
                {renderMessage(message)}
              </View>
            </View>
          </View>
        ))}
        
        {/* 处理中状态（已通过 thinking 消息展示，此处保留兜底 loading） */}
        {isProcessing && !messages.some((m) => m.type === 'thinking') && (
          <View style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
            <View style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              padding: '12px 16px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              border: '1px solid #E2E8F0'
            }}
            >
              <LoaderCircle size={18} color="#64748B" style={{ marginRight: '8px' }} className="animate-spin" />
              <Text style={{ fontSize: '14px', color: '#64748B' }}>
                正在处理您的请求...
              </Text>
            </View>
          </View>
        )}
      </ScrollArea>

      {/* 底部固定区域：输入框 + TabBar */}
      <View 
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 500
        }}
      >
        {/* 输入区域 */}
        <View 
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '12px',
            padding: '16px',
            paddingBottom: '72px',
            backgroundColor: '#FFFFFF',
            borderTop: '1px solid #E2E8F0',
            boxShadow: '0 -2px 8px rgba(0,0,0,0.04)'
          }}
        >
          <View 
            style={{
              flex: 1,
              backgroundColor: '#F1F5F9',
              borderRadius: '24px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Input
              style={{ 
                width: '100%', 
                fontSize: '16px',
                backgroundColor: 'transparent'
              }}
              placeholder={sessionState.stage === 'violation' 
                ? '请根据建议优化您的需求...' 
                : '请描述您的图片需求...'}
              value={inputValue}
              onInput={(e) => setInputValue(e.detail.value)}
              disabled={isProcessing}
              placeholderStyle="color: #94A3B8"
            />
          </View>
          <View style={{ flexShrink: 0, display: 'flex', flexDirection: 'row', gap: '8px' }}>
            <Button
              size="default"
              variant="outline"
              onClick={handleImageUpload}
              disabled={isProcessing}
              style={{
                borderRadius: '24px',
                paddingLeft: '16px',
                paddingRight: '16px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#F8FAFC',
                borderColor: '#E2E8F0'
              }}
            >
              <ImageIcon size={18} color="#64748B" />
            </Button>
            <Button
              size="default"
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isProcessing}
              style={{
                borderRadius: '24px',
                paddingLeft: '24px',
                paddingRight: '24px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Send size={18} color="#fff" />
            </Button>
          </View>
        </View>
        
        {/* 自定义 TabBar */}
        <CustomTabBar />
      </View>
    </View>
  );
};

export default IndexPage;