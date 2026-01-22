
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 关键：开启跨域允许，否则前端无法访问
  app.enableCors();
  
  // 设置全局路由前缀，方便管理 API
  app.setGlobalPrefix('api');
  
  await app.listen(3000);
  console.log('Server is running on http://localhost:3000/api');
}
bootstrap();
