import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { QrCodesService } from './qr-codes.service';
import { GenerateQrDto, GenerateBulkQrDto } from './dto';

@Controller('qr-codes')
export class QrCodesController {
  constructor(private readonly qrCodesService: QrCodesService) {}

  @Get('zone/:zoneId')
  async generateForZone(
    @Param('zoneId') zoneId: string,
    @Query('size') size?: string,
  ) {
    const qrData = await this.qrCodesService.generateQrCode(
      zoneId,
      size ? parseInt(size, 10) : 300,
    );

    return {
      success: true,
      data: qrData,
    };
  }

  @Get('zone/:zoneId/image')
  async generateImageForZone(
    @Param('zoneId') zoneId: string,
    @Query('size') size?: string,
    @Res() res?: Response,
  ) {
    const { buffer, zoneId: id } = await this.qrCodesService.generateQrBuffer(
      zoneId,
      size ? parseInt(size, 10) : 300,
    );

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="qr-${id}.png"`,
      'Content-Length': buffer.length,
    });

    res.status(HttpStatus.OK).send(buffer);
  }

  @Post()
  async generate(@Body() generateDto: GenerateQrDto) {
    const qrData = await this.qrCodesService.generateQrCode(
      generateDto.zoneId,
      generateDto.size,
    );

    return {
      success: true,
      data: qrData,
    };
  }

  @Post('bulk')
  async generateBulk(@Body() bulkDto: GenerateBulkQrDto) {
    const qrCodes = await this.qrCodesService.generateBulkQrCodes(
      bulkDto.zoneIds,
      bulkDto.size,
    );

    return {
      success: true,
      data: qrCodes,
      count: qrCodes.length,
    };
  }
}
