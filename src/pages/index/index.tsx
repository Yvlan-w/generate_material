import { useState, useEffect } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea as UiTextarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Network } from '@/network';
import { Send, TriangleAlert, Check, LoaderCircle, Image as ImageIcon, RefreshCw } from 'lucide-react-taro';
import ImagePreview from '@/components/ImagePreview';
import './index.css';

interface Message {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: Date;
  type?: 'text' | 'image' | 'compliance-result' | 'violation-warning' | 'thinking';
  data?: any;
}

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

  if (stage === 'collecting') {
    const autoGenerateTrigger = /生成|开始|确认|就这样|出图|开始做/.test(msg);
    if (autoGenerateTrigger) {
      return '正在进行合规校验并生成素材，请稍候...';
    }
    return stageLabelMap.collecting;
  }

  return stageLabelMap[stage] || '正在处理您的请求...';
}

interface SessionState {
  sessionId: string;
  stage: 'collecting' | 'compliance-checking' | 'generating' | 'completed' | 'violation';
  structuredNeeds?: any;
  complianceResult?: any;
  generatedImage?: string;
}

interface PendingImage {
  id: string;
  url: string;
  localUrl?: string;
  imageType?: 'reference' | 'included';
  aspects?: string[];
  customAspect?: string;
  position?: string;
  note?: string;
}

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
  const [imagesToSend, setImagesToSend] = useState<PendingImage[]>([]);
  const [scrollToId, setScrollToId] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [editImageId, setEditImageId] = useState<string | null>(null);

  const [temperatures, setTemperatures] = useState({
    extractNeeds: 0.3,
    generatePrompts: 0.7
  });

  useEffect(() => {
    const savedTemps = Taro.getStorageSync('temperatures');
    if (savedTemps && typeof savedTemps === 'object') {
      const parsedTemps = {
        extractNeeds: typeof savedTemps.extractNeeds === 'number' ? Math.round(savedTemps.extractNeeds * 100) / 100 : 0.3,
        generatePrompts: typeof savedTemps.generatePrompts === 'number' ? Math.round(savedTemps.generatePrompts * 100) / 100 : 0.7
      };
      setTemperatures(parsedTemps);
      console.log('IndexPage: loaded temperatures:', parsedTemps);
    }

    const isLoggedIn = Taro.getStorageSync('isLoggedIn');
    console.log('IndexPage: isLoggedIn:', isLoggedIn);
    if (!isLoggedIn) {
      Taro.redirectTo({ url: '/pages/login/index' });
      return;
    }
  }, []);

  const handleRestartChat = () => {
    setMessages([{
      id: 'init',
      role: 'agent',
      content: '您好！我是投资咨询行业营销素材生成助手。\n\n我将帮您生成符合行业规范的营销素材图片。请告诉我您希望生成什么类型的图片？\n\n例如：品牌宣传图、团队风采展示、数据可视化图表、产品介绍海报等。',
      timestamp: new Date(),
      type: 'text'
    }]);
    setInputValue('');
    setSessionState({
      sessionId: `session_${Date.now()}`,
      stage: 'collecting'
    });
    setImagesToSend([]);
    setEditImageId(null);
    Taro.showToast({ title: '已重新开始对话', icon: 'success', duration: 1500 });
  };

  return (
    <View className="min-h-screen bg-gray-50">
      <HomePage
        messages={messages}
        setMessages={setMessages}
        inputValue={inputValue}
        setInputValue={setInputValue}
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
        sessionState={sessionState}
        setSessionState={setSessionState}
        imagesToSend={imagesToSend}
        setImagesToSend={setImagesToSend}
        scrollToId={scrollToId}
        setScrollToId={setScrollToId}
        previewImage={previewImage}
        setPreviewImage={setPreviewImage}
        showPreview={showPreview}
        setShowPreview={setShowPreview}
        editImageId={editImageId}
        setEditImageId={setEditImageId}
        handleRestartChat={handleRestartChat}
        temperatures={temperatures}
      />
    </View>
  );
};

interface HomePageProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  isProcessing: boolean;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  sessionState: SessionState;
  setSessionState: React.Dispatch<React.SetStateAction<SessionState>>;
  imagesToSend: PendingImage[];
  setImagesToSend: React.Dispatch<React.SetStateAction<PendingImage[]>>;
  scrollToId: string;
  setScrollToId: React.Dispatch<React.SetStateAction<string>>;
  previewImage: string;
  setPreviewImage: React.Dispatch<React.SetStateAction<string>>;
  showPreview: boolean;
  setShowPreview: React.Dispatch<React.SetStateAction<boolean>>;
  editImageId: string | null;
  setEditImageId: React.Dispatch<React.SetStateAction<string | null>>;
  handleRestartChat: () => void;
  temperatures: {
    extractNeeds: number;
    generatePrompts: number;
  };
}

const HomePage = ({
  messages,
  setMessages,
  inputValue,
  setInputValue,
  isProcessing,
  setIsProcessing,
  sessionState,
  setSessionState,
  imagesToSend,
  setImagesToSend,
  scrollToId,
  setScrollToId,
  previewImage,
  setPreviewImage,
  showPreview,
  setShowPreview,
  editImageId,
  setEditImageId,
  handleRestartChat,
  temperatures
}: HomePageProps) => {
  useEffect(() => {
    if (scrollToId) {
      const timer = setTimeout(() => {
        setScrollToId('');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [scrollToId, setScrollToId]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() && imagesToSend.length === 0 || isProcessing) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: inputValue.trim() || (imagesToSend.length > 0 ? `上传了 ${imagesToSend.length} 张图片` : ''),
      timestamp: new Date(),
      type: imagesToSend.length > 0 ? 'image' : 'text',
      data: imagesToSend.length > 0 ? {
        imageUrl: imagesToSend[0]?.url,
        imageUrls: imagesToSend.map(img => img.url),
        imageDetails: imagesToSend
      } : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsProcessing(true);
    setScrollToId(userMessage.id);

    const processingHint = getProcessingHint(sessionState.stage, userMessage.content);
    if (processingHint) {
      const thinkingMessage: Message = {
        id: `msg_${Date.now()}_thinking`,
        role: 'system',
        content: processingHint,
        timestamp: new Date(),
        type: 'thinking'
      };
      setMessages(prev => [...prev, thinkingMessage]);
    }

    try {
      const userInfo = Taro.getStorageSync('userInfo');
      const userId = userInfo?.id || '';
      const requestData: Record<string, any> = {
        sessionId: sessionState.sessionId,
        message: userMessage.content,
        stage: sessionState.stage,
        userId,
        temperatures
      };

      console.log('[DEBUG] Sending request with stage:', sessionState.stage, 'requestData:', JSON.stringify(requestData));

      if (imagesToSend.length > 0) {
        const referenceImages = imagesToSend.filter(img => img.imageType === 'reference');
        const includedElements = imagesToSend.filter(img => img.imageType === 'included');

        if (referenceImages.length > 0) {
          requestData.referenceImages = referenceImages.map(img => ({
            url: img.url,
            aspects: img.aspects || []
          }));
        }

        if (includedElements.length > 0) {
          requestData.includedImages = includedElements.map(img => ({
            url: img.url,
            position: img.position || '',
            note: img.note || ''
          }));
        }
      }

      const response = await Network.request({
        url: '/api/image/chat',
        method: 'POST',
        data: requestData
      });

      const { code, msg, data } = response.data;

      console.log('[DEBUG] Received response, code:', code, 'data.stage:', data?.stage, 'full data:', JSON.stringify(data));

      if (code === 200) {
        setSessionState(prev => ({
          ...prev,
          stage: data.stage,
          structuredNeeds: data.structuredNeeds,
          complianceResult: data.complianceResult,
          generatedImage: data.generatedImage
        }));
        setImagesToSend([]);

        setMessages(prev => prev.filter((m) => m.type !== 'thinking'));

        if (data.reply) {
          const agentMessage: Message = {
            id: `msg_${Date.now()}_agent`,
            role: 'agent',
            content: data.reply,
            timestamp: new Date(),
            type: data.generatedImage ? 'image' : (data.type || 'text'),
            data: data.generatedImage ? { imageUrl: data.generatedImage, needs: data.structuredNeeds, disclaimer: data.disclaimer } : data.data
          };
          setMessages(prev => [...prev, agentMessage]);
          setScrollToId(agentMessage.id);
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
          setScrollToId(warningMessage.id);
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
          setScrollToId(complianceMessage.id);
        }

        if (data.stage === 'completed' && data.generatedImage && !data.reply) {
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
          setScrollToId(imageMessage.id);
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

  const doUploadFiles = async (files: { path?: string; raw?: File }[]) => {
    Taro.showLoading({ title: '上传图片中...' });
    const newImages: PendingImage[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        let responseData: any;
        if (file.raw) {
          // H5 端：取原始 File 对象，手动构建 FormData 上传（绕过 Taro.uploadFile 的 blob 拦截）
          const formData = new FormData();
          formData.append('image', file.raw);
          const resp = await fetch('/api/image/upload', { method: 'POST', body: formData });
          responseData = await resp.json();
        } else {
          // 小程序端：使用 Network.uploadFile
          const uploadResult: any = await Network.uploadFile({
            url: '/api/image/upload',
            filePath: file.path!,
            name: 'image'
          });
          responseData = typeof uploadResult.data === 'string'
            ? JSON.parse(uploadResult.data)
            : uploadResult.data;
        }
        if (responseData.code === 200 && responseData.data?.url) {
          newImages.push({
            id: `img_${Date.now()}_${i}`,
            url: responseData.data.url,
            imageType: undefined,
            aspects: [],
            customAspect: '',
            position: '',
            note: ''
          });
        } else {
          Taro.showToast({ title: '图片上传失败', icon: 'error', duration: 1500 });
        }
      } catch (error) {
        console.error('上传图片失败:', error);
        Taro.showToast({ title: '图片上传失败', icon: 'error', duration: 1500 });
      }
    }
    Taro.hideLoading();
    if (newImages.length > 0) {
      setImagesToSend(prev => [...prev, ...newImages]);
      setEditImageId(newImages[0].id);
    }
  };

  const handleImageUpload = async () => {
    const env = Taro.getEnv();
    const isMiniApp = env === Taro.ENV_TYPE.WEAPP || env === Taro.ENV_TYPE.TT;
    if (isMiniApp) {
      Taro.chooseImage({
        count: 9,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const files = res.tempFilePaths.map(path => ({ path }));
          void doUploadFiles(files);
        }
      });
      return;
    }
    // H5 端：DOM input file 选取原始 File 对象
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.onchange = (e) => {
      const fileList = (e.target as HTMLInputElement).files;
      if (!fileList || fileList.length === 0) return;
      const raws = Array.from(fileList).map(raw => ({ raw }));
      void doUploadFiles(raws);
      input.value = '';
    };
    input.click();
  };

  const removePendingImage = (id: string) => {
    setImagesToSend(prev => prev.filter(img => img.id !== id));
  };

  const clearAllPendingImages = () => {
    setImagesToSend([]);
  };

  const updateImageNote = (id: string, field: 'imageType' | 'aspects' | 'position' | 'customAspect' | 'note', value: string | string[]) => {
    setImagesToSend(prev => prev.map(img => {
      if (img.id !== id) return img;
      if (field === 'imageType') {
        return { ...img, imageType: value as 'reference' | 'included', aspects: value === 'reference' ? (img.aspects || []) : undefined, position: value === 'included' ? (img.position || '') : undefined };
      } else if (field === 'aspects') {
        return { ...img, aspects: (value as string[]).filter(v => v.trim()) };
      } else if (field === 'position') {
        return { ...img, position: value as string };
      } else if (field === 'customAspect') {
        return { ...img, customAspect: value as string };
      } else if (field === 'note') {
        return { ...img, note: value as string };
      }
      return img;
    }));
  };

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user';

    if (message.type === 'thinking') {
      return (
        <Card key={message.id} style={{
          marginTop: '12px',
          borderRadius: '16px',
          border: 'none',
          backgroundColor: '#F8FAFC'
        }}
        >
          <CardContent style={{ padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
            <LoaderCircle size={16} color="#64748B" className="mr-2" style={{ animation: 'spin 1s linear infinite' }} />
            <Text className="text-sm text-gray-500">{message.content}</Text>
          </CardContent>
        </Card>
      );
    }

    if (message.type === 'compliance-result') {
      return (
        <Card key={message.id} style={{
          marginTop: '12px',
          borderRadius: '16px',
          border: 'none',
          backgroundColor: '#ECFDF5'
        }}
        >
          <CardContent style={{ padding: '12px 16px', display: 'flex', alignItems: 'center' }}>
            <Check size={16} color="#059669" className="mr-2" />
            <Text className="text-sm text-green-700">{message.content}</Text>
          </CardContent>
        </Card>
      );
    }

    if (message.type === 'violation-warning') {
      return (
        <Card key={message.id} style={{
          marginTop: '12px',
          borderRadius: '16px',
          border: '1px solid #FCA5A5',
          backgroundColor: '#FEF2F2'
        }}
        >
          <CardContent style={{ padding: '12px 16px' }}>
            <View style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '8px' }}>
              <TriangleAlert size={16} color="#DC2626" className="mr-2 flex-shrink-0" />
              <Text className="text-sm text-red-700">{message.content}</Text>
            </View>
          </CardContent>
        </Card>
      );
    }

    if (message.type === 'image' && message.data?.imageUrl) {
      return (
        <Card key={message.id} style={{
          marginTop: '12px',
          borderRadius: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          border: 'none',
          backgroundColor: isUser ? '#EFF6FF' : '#FFFFFF'
        }}
        >
          <CardContent style={{ padding: '12px' }}>
            {isUser && message.content && (
              <Text className="block text-sm whitespace-pre-wrap mb-3" style={{ lineHeight: '1.6' }}>
                {message.content}
              </Text>
            )}
            <Image
              src={message.data.imageUrl}
              className="w-full rounded-lg"
              mode="widthFix"
              style={{
                borderRadius: '12px',
                maxHeight: '400px',
                objectFit: 'contain'
              }}
              onClick={() => {
                setPreviewImage(message.data.imageUrl);
                setShowPreview(true);
              }}
            />
            {message.data.imageUrls && message.data.imageUrls.length > 1 && (
              <View style={{
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: '8px',
                marginTop: '8px'
              }}
              >
                {message.data.imageUrls.slice(1).map((url: string, index: number) => {
                  const detail = message.data.imageDetails?.[index + 1];
                  return (
                    <View key={index} style={{ width: '60px' }}>
                      <Image
                        src={url}
                        style={{
                          width: '60px',
                          height: '60px',
                          borderRadius: '8px',
                          objectFit: 'cover'
                        }}
                        mode="aspectFill"
                      />
                      {detail && ((detail.aspects && detail.aspects.length > 0) || detail.position) && (
                        <View style={{ marginTop: '4px', padding: '2px 4px', backgroundColor: '#F0FDF4', borderRadius: '4px' }}>
                          <Text className="block text-[10px] text-green-700">
                            {detail.aspects?.length ? detail.aspects.join('、') : detail.position}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
            {message.data.disclaimer && (
              <Text className="block text-xs text-gray-400 mt-3" style={{ textAlign: 'center' }}>
                {message.data.disclaimer}
              </Text>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card key={message.id} style={{
        marginTop: '12px',
        borderRadius: isUser ? '16px' : '16px',
        border: 'none',
        backgroundColor: isUser ? '#EFF6FF' : '#FFFFFF'
      }}
      >
        <CardContent style={{ padding: '12px 16px' }}>
          <Text className="text-sm whitespace-pre-wrap" style={{ lineHeight: '1.6' }}>
            {message.content}
          </Text>
        </CardContent>
      </Card>
    );
  };

  return (
    <View className="min-h-screen bg-gray-50">
      <ScrollArea scrollTop={0} style={{ height: 'calc(100vh - 180px)' }}>
        <View style={{ padding: '16px' }}>
          {messages.map(renderMessage)}
        </View>
      </ScrollArea>

      <View
        style={{
          position: 'fixed',
          bottom: 50,
          left: 0,
          right: 0,
          zIndex: 400,
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E2E8F0',
          boxShadow: '0 -2px 8px rgba(0,0,0,0.04)',
          maxHeight: '60vh',
          overflowY: 'auto'
        }}
      >
        {messages.length > 1 && (
          <View style={{ padding: '8px 16px', borderBottom: '1px solid #F1F5F9' }}>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRestartChat}
              style={{ height: '32px', paddingLeft: '12px', paddingRight: '12px' }}
            >
              <RefreshCw size={14} color="#64748B" style={{ marginRight: '6px' }} />
              <Text style={{ fontSize: '12px', color: '#64748B' }}>重新开始对话</Text>
            </Button>
          </View>
        )}

        {imagesToSend.length > 0 && (
          <View style={{ padding: '8px 16px', borderBottom: '1px solid #F1F5F9' }}>
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '8px' }}>
              <Text className="block text-xs text-gray-500" style={{ flex: 1 }}>
                待发送图片 ({imagesToSend.length})
              </Text>
              <Text className="block text-xs text-blue-500" onClick={clearAllPendingImages} style={{ marginLeft: '8px' }}>
                清除全部
              </Text>
            </View>
            <ScrollArea orientation="horizontal" style={{ flex: 0, maxHeight: '100px' }}>
              <View style={{ display: 'flex', flexDirection: 'row', gap: '8px', paddingRight: '16px' }}>
                {imagesToSend.map((img) => (
                  <View
                    key={img.id}
                    style={{
                      position: 'relative',
                      width: '80px',
                      height: '80px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: `2px solid ${editImageId === img.id ? '#3B82F6' : (img.imageType ? '#E2E8F0' : '#F59E0B')}`,
                      backgroundColor: '#F8FAFC'
                    }}
                    onClick={() => setEditImageId(editImageId === img.id ? null : img.id)}
                  >
                    <Image
                      src={img.url}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      mode="aspectFill"
                    />
                    <View
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        backgroundColor: '#EF4444',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                      }}
                      onClick={(e) => { e.stopPropagation(); removePendingImage(img.id); }}
                    >
                      <Text className="block text-xs text-white">-</Text>
                    </View>
                    {img.imageType === 'reference' && (
                      <View
                        style={{
                          position: 'absolute',
                          bottom: '0',
                          left: '0',
                          right: '0',
                          backgroundColor: 'rgba(59, 130, 246, 0.8)',
                          padding: '2px 4px'
                        }}
                      >
                        <Text className="block text-[10px] text-white font-medium">参考图</Text>
                      </View>
                    )}
                    {img.imageType === 'included' && (
                      <View
                        style={{
                          position: 'absolute',
                          bottom: '0',
                          left: '0',
                          right: '0',
                          backgroundColor: 'rgba(34, 197, 94, 0.8)',
                          padding: '2px 4px'
                        }}
                      >
                        <Text className="block text-[10px] text-white font-medium">包含元素</Text>
                      </View>
                    )}
                    {!img.imageType && (
                      <View
                        style={{
                          position: 'absolute',
                          top: '0',
                          left: '0',
                          right: '0',
                          backgroundColor: 'rgba(245, 158, 11, 0.9)',
                          padding: '2px 4px'
                        }}
                      >
                        <Text className="block text-[10px] text-white font-medium">未设置</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </ScrollArea>

            {editImageId && (
              <View style={{ marginTop: '8px', padding: '12px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                {(() => {
                  const editingImg = imagesToSend.find(img => img.id === editImageId);
                  if (!editingImg) return null;
                  return (
                    <View>
                      <View style={{ marginBottom: '12px' }}>
                        <Text className="block text-sm font-medium text-gray-700 mb-3">请选择图片用途</Text>
                        <View style={{ display: 'flex', flexDirection: 'row', gap: '12px' }}>
                          <Button
                            size="default"
                            variant={editingImg.imageType === 'reference' ? 'default' : 'outline'}
                            onClick={() => updateImageNote(editImageId, 'imageType', 'reference')}
                            style={{ flex: 1, height: '40px' }}
                          >
                            <Text style={{ fontSize: '14px' }}>参考图片</Text>
                          </Button>
                          <Button
                            size="default"
                            variant={editingImg.imageType === 'included' ? 'default' : 'outline'}
                            onClick={() => updateImageNote(editImageId, 'imageType', 'included')}
                            style={{ flex: 1, height: '40px' }}
                          >
                            <Text style={{ fontSize: '14px' }}>包含元素</Text>
                          </Button>
                        </View>
                      </View>

                      {editingImg.imageType === 'reference' && (
                        <View style={{ marginBottom: '8px' }}>
                          <Text className="block text-sm font-medium text-gray-700 mb-3">参考方向（可多选）</Text>
                          <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '8px' }}>
                            {['风格', '色调', '构图', '氛围'].map(aspect => (
                              <Button
                                key={aspect}
                                size="sm"
                                variant={(editingImg.aspects || []).includes(aspect) ? 'default' : 'outline'}
                                onClick={() => {
                                  const currentAspects = editingImg.aspects || [];
                                  const newAspects = currentAspects.includes(aspect)
                                    ? currentAspects.filter(a => a !== aspect)
                                    : [...currentAspects, aspect];
                                  updateImageNote(editImageId, 'aspects', newAspects);
                                }}
                                style={{ height: '36px', paddingLeft: '16px', paddingRight: '16px' }}
                              >
                                <Text style={{ fontSize: '13px' }}>{aspect}</Text>
                              </Button>
                            ))}
                          </View>
                          {editingImg.aspects && editingImg.aspects.length > 0 && (
                            <Text className="block text-xs text-gray-500 mt-2">
                              已选：{editingImg.aspects.join('、')}
                            </Text>
                          )}
                          <View style={{ marginTop: '8px' }}>
                            <Text className="block text-xs text-gray-500 mb-2">自定义借鉴方面</Text>
                            <View style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
                              <View style={{ flex: 1, height: '36px'}}>
                                <Input
                                  style={{ width: '100%', height: '100%', fontSize: '13px', backgroundColor: 'transparent', padding: '0 12px' }}
                                  placeholder="例如：字体、配色方案、元素布局..."
                                  value={editingImg.customAspect || ''}
                                  onInput={(e) => updateImageNote(editImageId, 'customAspect', e.detail.value)}
                                />
                              </View>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (editingImg.customAspect?.trim()) {
                                    const currentAspects = editingImg.aspects || [];
                                    const custom = editingImg.customAspect.trim();
                                    if (!currentAspects.includes(custom)) {
                                      updateImageNote(editImageId, 'aspects', [...currentAspects, custom]);
                                      updateImageNote(editImageId, 'customAspect', '');
                                    }
                                  }
                                }}
                                style={{ height: '36px', paddingLeft: '12px', paddingRight: '12px', flexShrink: 0 }}
                              >
                                <Text style={{ fontSize: '12px' }}>添加</Text>
                              </Button>
                            </View>
                          </View>
                        </View>
                      )}

                      {editingImg.imageType === 'included' && (
                        <View>
                          <Text className="block text-sm font-medium text-gray-700 mb-3">放置位置</Text>
                          <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '8px' }}>
                            {['左上角', '右上角', '左下角', '右下角', '顶部居中', '底部居中', '居中'].map(pos => (
                              <Button
                                key={pos}
                                size="sm"
                                variant={editingImg.position === pos ? 'default' : 'outline'}
                                onClick={() => updateImageNote(editImageId, 'position', pos)}
                                style={{ height: '36px', paddingLeft: '16px', paddingRight: '16px' }}
                              >
                                <Text style={{ fontSize: '13px' }}>{pos}</Text>
                              </Button>
                            ))}
                          </View>
                          {editingImg.position && (
                            <Text className="block text-xs text-gray-500 mt-2">
                              已选：{editingImg.position}
                            </Text>
                          )}
                          <View style={{ marginTop: '12px' }}>
                            <Text className="block text-sm font-medium text-gray-700 mb-2">图片备注</Text>
                            <UiTextarea
                              style={{ width: '100%', minHeight: '60px', fontSize: '13px', backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '8px 12px' }}
                              placeholder="请描述这张图片是什么，以及希望如何处理它。例如：这是XX公司的logo，希望保持原有的颜色和比例..."
                              value={editingImg.note || ''}
                              onInput={(e) => updateImageNote(editImageId, 'note', e.detail.value)}
                              maxlength={200}
                            />
                            <Text className="block text-xs text-gray-400 mt-1" style={{ textAlign: 'right' }}>
                              {(editingImg.note?.length || 0)}/200
                            </Text>
                          </View>
                        </View>
                      )}

                      {!editingImg.imageType && (
                        <View style={{ marginTop: '8px', padding: '8px', backgroundColor: '#FEF3C7', borderRadius: '6px' }}>
                          <Text className="block text-xs text-amber-800">
                            请先选择图片类型，以便准确处理您的图片
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })()}
              </View>
            )}
          </View>
        )}

        <View style={{ padding: '12px 16px' }}>
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
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
                variant="default"
                onClick={handleSendMessage}
                disabled={isProcessing || !inputValue.trim() && imagesToSend.length === 0}
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
        </View>
      </View>

      <ImagePreview
        imageUrl={previewImage}
        visible={showPreview}
        onClose={() => setShowPreview(false)}
      />
    </View>
  );
};


export default IndexPage;