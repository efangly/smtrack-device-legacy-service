import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { DeviceModule } from './device/device.module';
import { TemplogModule } from './templog/templog.module';
import { DeviceStrategy, JwtStrategy } from './common/strategies';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { InfluxdbModule } from './influxdb/influxdb.module';
import { PrismaModule } from './prisma/prisma.module';
import { GraphModule } from './graph/graph.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PassportModule,
    DeviceModule, 
    TemplogModule, 
    HealthModule, 
    RedisModule, 
    InfluxdbModule, 
    PrismaModule, 
    GraphModule, 
    RabbitmqModule
  ],
  providers: [JwtStrategy, DeviceStrategy]
})
export class AppModule {}
