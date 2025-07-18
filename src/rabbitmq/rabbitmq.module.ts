import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { RabbitmqService } from './rabbitmq.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'RABBITMQ_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ || 'amqp://admin:thanesmail1234@siamatic.co.th:5672'],
          queue: 'templog_queue',
          queueOptions: { durable: true }
        }
      }
    ]),
    ClientsModule.register([
      {
        name: 'MONITOR_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ || 'amqp://admin:thanesmail1234@siamatic.co.th:5672'],
          queue: 'monitor_queue',
          queueOptions: { durable: true }
        }
      }
    ])
  ],
  providers: [RabbitmqService],
  exports: [RabbitmqService]
})
export class RabbitmqModule { }