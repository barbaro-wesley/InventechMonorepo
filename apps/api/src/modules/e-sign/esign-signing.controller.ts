import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common'
import { Response } from 'express'
import { DeclineSignatureDto, SubmitSignatureDto } from './dto/esign.dto'
import { ESignSigningService } from './services/esign-signing.service'
import { Public } from '@/common/decorators/public.decorator'

@Public()
@Controller('sign')
export class ESignSigningController {
  constructor(private readonly service: ESignSigningService) {}

  // Must be before :token to avoid route shadowing
  @Get(':token/document')
  async getDocument(@Param('token') token: string, @Res() res: Response) {
    const { stream, filename } = await this.service.getDocumentStream(token)
    res.removeHeader('X-Frame-Options')
    res.removeHeader('Content-Security-Policy')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
    res.setHeader('Cache-Control', 'private, max-age=300')
    stream.pipe(res)
  }

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
