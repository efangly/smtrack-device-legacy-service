import { Injectable, Inject } from '@nestjs/common';
import { CreateTemplogDto } from './dto/create-templog.dto';
import { UpdateTemplogDto } from './dto/update-templog.dto';
import { PrismaService } from '../prisma/prisma.service';
import { dateFormat } from '../common/utils';
import { DevicePayloadDto, JwtPayloadDto } from '../common/dto';
import { Prisma } from '@prisma/client';
import { RedisService } from '../redis/redis.service';
import { ClientProxy } from '@nestjs/microservices';
import { InfluxdbService } from '../influxdb/influxdb.service';

@Injectable()
export class TemplogService {
  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly client: ClientProxy,
    private readonly influxdb: InfluxdbService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}
  async create(templogDto: CreateTemplogDto, user: DevicePayloadDto) {
    let internet = false;
    let door = false;
    let plugin = false;
    switch (templogDto.status.substring(5)) {
      case '000':
        internet = false;
        door = true;
        plugin = true;
        break;
      case '001':
        internet = false;
        door = true;
        plugin = false;
        break;
      case '010':
        internet = false;
        door = false;
        plugin = true;
        break;
      case '011':
        internet = false;
        door = false;
        plugin = false;
        break;
      case '100':
        internet = true;
        door = true;
        plugin = true;
        break;
      case '101':
        internet = true;
        door = true;
        plugin = false;
        break;
      case '110':
        internet = true;
        door = false;
        plugin = true;
        break;
      case '111':
        internet = true;
        door = false;
        plugin = false;
        break;
    }
    const data = {
      mcuId: user.id,
      internet: internet,
      door: door,
      plugin: plugin,
      tempValue: templogDto.tempValue,
      realValue: templogDto.realValue,
      date: templogDto.date,
      time: templogDto.time,
      isAlert: templogDto.isAlert,
      message: templogDto.message,
      probe: templogDto.mcuId,
      createdAt: dateFormat(new Date()),
      updatedAt: dateFormat(new Date())
    }
    this.client.emit('templog', data);
    await this.redis.del("templog");
    return data;
  }

  async findAll(user: JwtPayloadDto) {
    const { conditions, key } = this.findCondition(user);
    const cache = await this.redis.get(key);
    if (cache) return JSON.parse(cache);
    const templogs = await this.prisma.tempLogs.findMany({
      select: {
        mcuId: true,
        message: true,
        createdAt: true
      },
      where: conditions,
      orderBy: { createdAt: 'desc' }
    });
    if (templogs.length > 0) await this.redis.set(key, JSON.stringify(templogs), 30);
    return templogs;
  }

  async findHistory(user: JwtPayloadDto, filter: string) {
    let query = `from(bucket: "${process.env.INFLUXDB_BUCKET}") `;
    if (filter) {
      query += `|> range(start: ${filter}T00:00:00Z, stop: ${filter}T23:59:59Z) `;
    } else {
      query += '|> range(start: -1d) ';
    }
    query += '|> filter(fn: (r) => r._measurement == "templog-alert") |> timeShift(duration: 7h, columns: ["_time"]) ';
    switch (user.role) {
      case 'SERVICE':
        query += '|> filter(fn: (r) => r.hospital != "HID-DEVELOPMENT") ';
        break;
      case 'LEGACY_ADMIN':
        query += `|> filter(fn: (r) => r.hospital == "${user.hosId}") `;
        break;
      case "LEGACY_USER":
        query += `|> filter(fn: (r) => r.ward == "${user.wardId}") `;
        break; 
    }
    query += '|> filter(fn: (r) => r._field == "message")';
    query += '|> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")';
    const result = await this.influxdb.queryData(query);
    return result;
  }

  async findDashboard(ward?: string) {
    const [temp, door, plug] = await this.prisma.$transaction([
      this.prisma.tempLogs.count({ where: ward ? { isAlert: true, device: { ward } } : { isAlert: true } }),
      this.prisma.tempLogs.count({ where: ward ? { door: true, device: { ward } } : { door: true } }),
      this.prisma.tempLogs.count({ where: ward ? { plugin: true, device: { ward } } : { plugin: true } })
    ]);
    return { temp, door, plug };
  }

  async findOne(sn: string) {
    const cache = await this.redis.get(`templog:${sn}`);
    if (cache) return JSON.parse(cache);
    const templog = await this.prisma.tempLogs.findMany({
      where: { mcuId: sn },
      orderBy: { createdAt: 'desc' }
    });
    if (templog.length > 0) await this.redis.set(`templog:${sn}`, JSON.stringify(templog), 30);
    return templog;
  }

  async update(id: string, templogDto: UpdateTemplogDto) {
    templogDto.updatedAt = dateFormat(new Date());
    await this.redis.del("templog");
    return this.prisma.tempLogs.update({ where: { id }, data: templogDto });
  }

  async remove(id: string) {
    await this.redis.del("templog");
    return this.prisma.tempLogs.delete({ where: { id } });
  }

  private findCondition(user: JwtPayloadDto): { conditions: Prisma.TempLogsWhereInput | undefined, key: string } {
    let conditions: Prisma.TempLogsWhereInput | undefined = undefined;
    let key = "";
    switch (user.role) {
      case "LEGACY_USER":
        conditions = { isAlert: true, device: { ward: user.wardId } };
        key = `templog:${user.wardId}`;
        break;
      case "LEGACY_ADMIN":
        conditions = { isAlert: true, device: { hospital: user.hosId } };
        key = `templog:${user.hosId}`;
        break;
      case "SERVICE":
        conditions = { isAlert: true, NOT: { device: { hospital: "HID-DEVELOPMENT" } } };
        key = "templog:HID-DEVELOPMENT";
        break;
      default:
        conditions = { isAlert: true };
        key = "templog";
    }
    return { conditions, key };
  }
}
