import { useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Network } from '@/network';
import { Send, Bot, User, TriangleAlert, Check, LoaderCircle } from 'lucide-react-taro';
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
  type?: 'text' | 'image' | 'compliance-result' | 'violation-warning';
  data?: any; // 附加数据（如图片URL、合规详情）
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
      content: '您好！我是投资咨询行业营销素材生成助手。\n\n我将帮您生成符合行业规范的营销素材图片。请告诉我您希望生成什么类型的图片？例如：\n• 品牌宣传图\n• 团队风采展示\n• 数据可视化图表\n• 产品介绍海报',
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
    
    try {
      // 调用对话API
      console.log('调用对话API:', {
        url: '/api/image/chat',
        method: 'POST',
        data: {
          sessionId: sessionState.sessionId,
          message: userMessage.content,
          stage: sessionState.stage
        }
      });
      
      const response = await Network.request({
        url: '/api/image/chat',
        method: 'POST',
        data: {
          sessionId: sessionState.sessionId,
          message: userMessage.content,
          stage: sessionState.stage
        }
      });
      
      console.log('对话API响应:', response.data);
      
      // 解析响应
      const { code, msg, data } = response.data;
      
      if (code === 200) {
        // 更新对话状态
        setSessionState(prev => ({
          ...prev,
          stage: data.stage,
          structuredNeeds: data.structuredNeeds,
          complianceResult: data.complianceResult,
          generatedImage: data.generatedImage
        }));
        
        // 添加Agent回复消息
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
        
        // 如果有违规警告，添加警告消息
        if (data.stage === 'violation' && data.complianceResult) {
          const warningMessage: Message = {
            id: `msg_${Date.now()}_warning`,
            role: 'system',
            content: `⚠️ 合规校验未通过\n\n违规方面：${data.complianceResult.violationAspects}\n\n改进建议：${data.complianceResult.suggestions}`,
            timestamp: new Date(),
            type: 'violation-warning',
            data: data.complianceResult
          };
          setMessages(prev => [...prev, warningMessage]);
        }
        
        // 如果合规通过，添加合规通过消息
        if (data.stage === 'generating' && data.complianceResult?.passed) {
          const complianceMessage: Message = {
            id: `msg_${Date.now()}_compliance`,
            role: 'system',
            content: '✅ 合规校验通过，正在生成图片...',
            timestamp: new Date(),
            type: 'compliance-result'
          };
          setMessages(prev => [...prev, complianceMessage]);
        }
        
        // 如果生成了图片，添加图片消息
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
        // 错误处理
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

  // 重置对话
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
      collecting: { text: '需求收集', variant: 'secondary' },
      'compliance-checking': { text: '合规校验', variant: 'outline' },
      generating: { text: '图片生成', variant: 'outline' },
      completed: { text: '已完成', variant: 'default' },
      violation: { text: '需要优化', variant: 'destructive' }
    };
    
    const config = stageConfig[sessionState.stage];
    return (
      <Badge variant={config.variant as any} className="ml-2">
        {config.text}
      </Badge>
    );
  };

  // 渲染消息内容
  const renderMessage = (message: Message) => {
    if (message.type === 'image') {
      return (
        <Card className="mt-4">
          <CardContent className="p-4">
            <Image 
              src={message.data?.imageUrl}
              className="w-full rounded-lg"
              mode="widthFix"
            />
            {message.data?.needs && (
              <View className="mt-4">
                <Text className="block text-sm font-semibold text-gray-700">
                  需求摘要：
                </Text>
                <Text className="block text-sm text-gray-600 mt-2">
                  {message.data.needs.summary}
                </Text>
              </View>
            )}
            {message.data?.disclaimer && (
              <View className="mt-4 p-3 bg-gray-50 rounded">
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
        <Card className="mt-4 bg-red-50 border-red-200">
          <CardContent className="p-4">
            <View className="flex items-center mb-2">
              <TriangleAlert size={20} color="#DC2626" className="mr-2" />
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
          </CardContent>
        </Card>
      );
    }
    
    if (message.type === 'compliance-result') {
      return (
        <Card className="mt-4 bg-green-50 border-green-200">
          <CardContent className="p-4">
            <View className="flex items-center">
              <Check size={20} color="#16A34A" className="mr-2" />
              <Text className="block text-sm font-semibold text-green-700">
                合规校验通过
              </Text>
            </View>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Text className="block text-sm whitespace-pre-wrap">
        {message.content}
      </Text>
    );
  };

  return (
    <View className="flex flex-col h-screen bg-background">
      {/* 顶部状态栏 */}
      <View className="sticky top-0 bg-background border-b border-border px-4 py-3 z-10">
        <View className="flex items-center justify-between">
          <View className="flex items-center">
            <Text className="text-lg font-semibold">
              营销素材生成
            </Text>
            {getStageBadge()}
          </View>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleReset}
          >
            重新开始
          </Button>
        </View>
      </View>

      {/* 对话历史区域 */}
      <ScrollArea className="flex-1 px-4 py-2">
        {messages.map((message) => (
          <View 
            key={message.id}
            className={`flex mb-4 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <View 
              className={`flex max-w-[80%] ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              {/* 角色图标 */}
              <View 
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.role === 'user' 
                    ? 'bg-primary ml-2' 
                    : 'bg-secondary mr-2'
                }`}
              >
                {message.role === 'user' 
                  ? <User size={16} color="#1E40AF" /> 
                  : <Bot size={16} color="#6B7280" />
                }
              </View>
              
              {/* 消息内容 */}
              <View 
                className={`rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary-container'
                    : message.type === 'violation-warning'
                    ? 'bg-transparent'
                    : 'bg-secondary-container'
                }`}
              >
                {renderMessage(message)}
              </View>
            </View>
          </View>
        ))}
        
        {/* 处理中状态 */}
        {isProcessing && (
          <View className="flex justify-start mb-4">
            <View className="flex items-center bg-secondary-container rounded-lg p-3">
              <LoaderCircle size={16} color="#6B7280" className="mr-2 animate-spin" />
              <Text className="block text-sm text-gray-600">
                正在处理...
              </Text>
            </View>
          </View>
        )}
      </ScrollArea>

      {/* 底部输入区域 */}
      <View 
        style={{
          position: 'fixed',
          bottom: 50,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'row',
          gap: '8px',
          padding: '12px',
          backgroundColor: '#fff',
          borderTop: '1px solid #e5e7eb',
          zIndex: 100
        }}
      >
        <View 
          style={{
            flex: 1,
            backgroundColor: '#F3F4F6',
            borderRadius: '20px',
            padding: '8px 12px'
          }}
        >
          <Input
            style={{ width: '100%', fontSize: '14px' }}
            placeholder={sessionState.stage === 'violation' 
              ? '请根据建议优化您的需求...' 
              : '请描述您的图片需求...'}
            value={inputValue}
            onInput={(e) => setInputValue(e.detail.value)}
            disabled={isProcessing}
          />
        </View>
        <View style={{ flexShrink: 0 }}>
          <Button
            size="default"
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isProcessing}
          >
            <Send size={16} color="#fff" />
          </Button>
        </View>
      </View>
      
      {/* 自定义 TabBar */}
      <CustomTabBar />
    </View>
  );
};

export default IndexPage;