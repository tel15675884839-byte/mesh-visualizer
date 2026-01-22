import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
// 引入我们需要注册的拓扑模块
import { TopologyModule } from './topology/topology.module';

@Module({
  imports: [TopologyModule], // 在这里注册
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}