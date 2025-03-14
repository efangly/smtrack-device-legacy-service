import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GraphService } from './graph.service';
import { JwtAuthGuard } from '../common/guards';

@Controller('graph')
@UseGuards(JwtAuthGuard)
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get()
  async findAll(@Query('sn') sn: string, @Query('filter') filter: string) {
    return this.graphService.findAll(sn, filter);
  }
}
