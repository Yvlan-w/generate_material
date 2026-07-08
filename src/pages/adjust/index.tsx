import { useEffect } from 'react';
import Taro from '@tarojs/taro';

const AdjustPage = () => {
  useEffect(() => {
    Taro.redirectTo({ url: '/pages/index/index?tab=adjust' });
  }, []);

  return null;
};

export default AdjustPage;