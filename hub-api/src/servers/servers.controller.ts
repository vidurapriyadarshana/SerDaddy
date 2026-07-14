import { Controller, Get, Post, Body, Param, Res, Req, Headers } from '@nestjs/common';
import { ServersService } from './servers.service';

@Controller('api/servers')
export class ServersController {
  constructor(private readonly service: ServersService) {}

  @Post()
  async create(
    @Headers('x-user-id') userId: string,
    @Body() data: { name: string; ip: string }
  ) {
    return this.service.create(userId, data);
  }

  @Get()
  async findAll(@Headers('x-user-id') userId: string) {
    return this.service.findAll(userId);
  }

  @Get(':id')
  async findOne(
    @Headers('x-user-id') userId: string,
    @Param('id') id: string
  ) {
    return this.service.findOne(userId, id);
  }

  @Get('install/:token')
  async getInstall(
    @Param('token') token: string,
    @Req() req: any,
    @Res() res: any
  ) {
    // Dynamically resolve panel host address from request headers
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const panelUrl = `${protocol}://${host}`;
    
    const script = this.service.getInstallScript(token, panelUrl);
    
    // Fastify/Express compatible header type response
    res.type('text/plain').send(script);
  }
}
