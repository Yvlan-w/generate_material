import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Network } from '@/network'
import { Settings, Save, LoaderCircle } from 'lucide-react-taro'
import CustomTabBar from '@/components/CustomTabBar'

interface ParamItem {
  id: number
  paramName: string
  paramValue: number
  defaultValue: number
  minValue: number
  maxValue: number
  step: number
  description: string
  isActive: boolean
}

export default function AdjustPage() {
  const [params, setParams] = useState<ParamItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadParams = async () => {
    setLoading(true)
    try {
      const response = await Network.request({ url: '/api/config/params' })
      const list = response.data?.data || []
      setParams(Array.isArray(list) ? list : [])
    } catch (error) {
      console.error('加载参数失败:', error)
      Taro.showToast({ title: '加载参数失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadParams()
  }, [])

  const updateParam = (index: number, value: number) => {
    setParams(prev => prev.map((p, i) => (i === index ? { ...p, paramValue: value } : p)))
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      for (const p of params) {
        await Network.request({
          url: `/api/config/params/${p.id}`,
          method: 'PUT',
          data: { param_value: p.paramValue }
        })
      }
      Taro.showToast({ title: '保存成功', icon: 'success' })
    } catch (error) {
      console.error('保存失败:', error)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <View style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#F8FAFC' }}>
      <View style={{ padding: '24px', paddingBottom: '100px' }}>
        <View style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
          <View style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            backgroundColor: '#3B82F6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '12px'
          }}
          >
            <Settings size={22} color="#FFFFFF" />
          </View>
          <View>
            <Text style={{ fontSize: '18px', fontWeight: '600', color: '#1E293B', display: 'block' }}>参数配置</Text>
            <Text style={{ fontSize: '13px', color: '#64748B', display: 'block' }}>调整图片生成的精细参数</Text>
          </View>
        </View>

        <View style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '20px',
          marginBottom: '20px',
          boxShadow: '0 2px 12px rgba(0,0,0,0.05)'
        }}
        >
          <Text style={{ fontSize: '14px', color: '#475569', marginBottom: '16px', display: 'block' }}>
            以下参数将影响 AI 生成图片时的随机性与多样性，调整后点击底部保存。
          </Text>
        </View>

        {loading ? (
          <View style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
            <LoaderCircle size={28} color="#3B82F6" className="animate-spin" />
          </View>
        ) : params.length === 0 ? (
          <View style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '20px',
            padding: '40px',
            textAlign: 'center'
          }}
          >
            <Text style={{ fontSize: '14px', color: '#94A3B8', display: 'block' }}>暂无参数配置</Text>
          </View>
        ) : (
          params.map((p, index) => (
            <View key={p.id} style={{
              backgroundColor: '#FFFFFF',
              borderRadius: '20px',
              padding: '20px',
              marginBottom: '16px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.05)'
            }}
            >
              <View style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <Text style={{ fontSize: '16px', fontWeight: '600', color: '#1E293B' }}>{p.paramName}</Text>
                <Text style={{ fontSize: '14px', fontWeight: '600', color: '#3B82F6' }}>{p.paramValue}</Text>
              </View>
              <Text style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', display: 'block' }}>
                {p.description}
              </Text>
              <Slider
                value={[p.paramValue]}
                min={p.minValue}
                max={p.maxValue}
                step={p.step}
                onValueChange={(v: number[]) => updateParam(index, Array.isArray(v) ? v[0] : v)}
              />
            </View>
          ))
        )}

        {!loading && params.length > 0 && (
          <Button
            style={{
              width: '100%',
              backgroundColor: '#3B82F6',
              borderRadius: '16px',
              height: '52px',
              boxShadow: '0 4px 12px rgba(59,130,246,0.3)'
            }}
            onClick={saveAll}
            disabled={saving}
          >
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              {saving ? (
                <LoaderCircle size={20} color="#FFFFFF" className="animate-spin" />
              ) : (
                <Save size={20} color="#FFFFFF" style={{ marginRight: '8px' }} />
              )}
              <Text style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: '500' }}>{saving ? '保存中...' : '保存配置'}</Text>
            </View>
          </Button>
        )}
      </View>
      <CustomTabBar />
    </View>
  )
}