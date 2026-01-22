
import axios from 'axios';

// 创建 axios 实例
export const api = axios.create({
  // 指向后端地址 (注意我们加了 /api 前缀)
  baseURL: 'http://localhost:3000/api',
  timeout: 5000,
});

// 响应拦截器：处理错误
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
