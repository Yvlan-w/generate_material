import { useEffect } from 'react';
import Taro from '@tarojs/taro';

const GalleryPage = () => {
  useEffect(() => {
    Taro.redirectTo({ url: '/pages/index/index?tab=gallery' });
  }, []);

  return null;
};

export default GalleryPage;