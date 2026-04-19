import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common'
import { DeclineSignatureDto, SubmitSignatureDto } from './dto/esign.dto'
import { ESignSigningService } from './services/esign-signing.service'

// Public controller — no JWT guard, authentication via token in URL
@Controller('sign')
export class ESignSigningController {
  constructor(private readonly service: ESignSigningService) {}

  @Get(':token')
  async getRequest(@Param('token') token: string, @Req() req: any) {
    const ip = req.ip ?? req.headers['x-forwarded-for']
    const ua = req.headers['user-agent'] ?? ''
    await this.service.markViewed(token, ip, ua)
    return this.service.getRequestByToken(token)
  }

  @Post(':token/sign')
  async sign(@Param('token') token: string, @Body() dto: SubmitSignatureDto, @Req() req: any) {
    const ip = req.ip ?? req.headers['x-forwarded-for']
    const ua = req.headers['user-agent'] ?? ''
    return this.service.sign(token, dto, ip, ua)
  }

  @Post(':token/decline')
  async decline(@Param('token') token: string, @Body() dto: DeclineSignatureDto, @Req() req: any) {
    const ip = req.ip ?? req.headers['x-forwarded-for']
    const ua = req.headers['user-agent'] ?? ''
    return this.service.decline(token, dto, ip, ua)
  }
}
