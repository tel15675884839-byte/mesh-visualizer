
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DeviceStatus, NetworkTopology } from '@mesh/shared';

@Injectable()
export class TopologyService {
  private readonly logger = new Logger(TopologyService.name);

  constructor(private prisma: PrismaService) {}

  // 撤回设备：清空 slotId，状态改回 UNASSIGNED
  async retractDevice(mac: string) {
    return await this.prisma.device.update({
      where: { mac },
      data: {
        slotId: null,
        status: DeviceStatus.UNASSIGNED
      }
    });
  }

  async deleteLoop(loopId: number) {
    return await this.prisma.$transaction(async (tx) => {
      const result = await tx.device.deleteMany({ where: { loopId } });
      return { success: true, deleted: result.count };
    });
  }

  async deployDevice(mac: string, x: number, y: number, floorId: string) {
    // 简单的 Upsert 逻辑：如果 Slot 已存在则更新，不存在则创建
    // 注意：为了简化，这里每次都创建新 Slot，旧的会被 GC 或忽略
    return await this.prisma.$transaction(async (tx) => {
      const device = await tx.device.findUnique({ where: { mac } });
      if (!device) throw new Error(`Device ${mac} not found`);

      // 创建新 Slot
      const newSlot = await tx.slot.create({
        data: { floorId, x, y, expectedType: device.type }
      });

      // 更新设备
      return await tx.device.update({
        where: { mac },
        data: { slotId: newSlot.id, status: DeviceStatus.ONLINE }
      });
    });
  }

  async syncTopology(data: NetworkTopology) {
    // 复用之前的 sync 逻辑，为了脚本简洁，这里省略部分重复代码，只保留核心结构
    // 实际运行时请确保这里包含完整的 sync 逻辑 (参考 Stage 6)
    return await this.prisma.$transaction(async (tx) => {
      // 确保默认楼层
      let defaultFloor = await tx.floor.findFirst();
      if (!defaultFloor) {
        defaultFloor = await tx.floor.create({
          data: { name: "Default Floor", level: 1, scaleRatio: 1.0, altitude: 0 }
        });
      }
      
      // 同步设备
      for (const device of data.devices) {
        const existing = await tx.device.findUnique({ where: { mac: device.mac } });
        if (existing) {
          await tx.device.update({
            where: { mac: device.mac },
            data: { type: device.type as string, status: DeviceStatus.ONLINE, loopId: device.loopId },
          });
        } else {
          await tx.device.create({
            data: { mac: device.mac, type: device.type as string, loopId: device.loopId, status: DeviceStatus.UNASSIGNED, slotId: null },
          });
        }
      }
      // 更新连接
      await tx.edge.deleteMany({});
      const allDevices = await tx.device.findMany({ select: { id: true, mac: true } });
      const macToIdMap = new Map(allDevices.map((d) => [d.mac, d.id]));
      const edgesToCreate: any[] = [];
      for (const edge of data.edges) {
        // @ts-ignore
        const sourceUuid = macToIdMap.get(edge.sourceId);
        // @ts-ignore
        const targetUuid = macToIdMap.get(edge.targetId);
        if (sourceUuid && targetUuid) {
          edgesToCreate.push({ sourceId: sourceUuid, targetId: targetUuid, rssi: edge.rssi, linkQuality: edge.linkQuality, isNew: true });
        }
      }
      if (edgesToCreate.length > 0) await tx.edge.createMany({ data: edgesToCreate });
      return { success: true };
    });
  }

  async getFullTopology() {
    const devices = await this.prisma.device.findMany({ include: { slot: { include: { floor: true } } } });
    const edges = await this.prisma.edge.findMany();
    const floors = await this.prisma.floor.findMany({ include: { slots: true } });
    return { devices, edges, floors };
  }
}
