
import { Controller, Get, Post, Delete, Body, Param, HttpException, HttpStatus, ParseIntPipe } from '@nestjs/common';
import { TopologyService } from './topology.service';
import type { NetworkTopology } from '@mesh/shared';

@Controller('topology')
export class TopologyController {
  constructor(private readonly topologyService: TopologyService) {}

  @Post('sync')
  async sync(@Body() data: any) {
    try {
      return await this.topologyService.syncTopology(data as NetworkTopology);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('deploy')
  async deploy(@Body() body: { mac: string; x: number; y: number; floorId: string }) {
    return await this.topologyService.deployDevice(body.mac, body.x, body.y, body.floorId);
  }

  // 新增：批量部署 (支持智能拖拽)
  @Post('deploy/batch')
  async deployBatch(@Body() body: { placements: { mac: string; x: number; y: number; floorId: string }[] }) {
    try {
      // 简单循环处理 (生产环境可用事务优化)
      // 修复 TS2345: 显式声明数组类型，防止被推断为 never[]
      const results: any[] = [];
      for (const p of body.placements) {
        results.push(await this.topologyService.deployDevice(p.mac, p.x, p.y, p.floorId));
      }
      return { success: true, count: results.length };
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // 新增：撤回设备 (Reset to Unassigned)
  @Post('retract')
  async retract(@Body() body: { mac: string }) {
    try {
      return await this.topologyService.retractDevice(body.mac);
    } catch (error: any) {
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('loop/:id')
  async deleteLoop(@Param('id', ParseIntPipe) loopId: number) {
    return await this.topologyService.deleteLoop(loopId);
  }

  @Get()
  async getAll() {
    return await this.topologyService.getFullTopology();
  }
}
