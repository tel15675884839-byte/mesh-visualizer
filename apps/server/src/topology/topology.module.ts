import { Module } from '@nestjs/common';
import { TopologyController } from './topology.controller';
import { TopologyService } from './topology.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [TopologyController],
  providers: [TopologyService, PrismaService],
})
export class TopologyModule {}