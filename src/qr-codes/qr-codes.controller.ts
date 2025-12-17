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

  @Get('meter/:meterId')
  async generateForMeter(
    @Param('meterId') meterId: string,
    @Query('size') size?: string,
  ) {
    const qrData = await this.qrCodesService.generateQrCode(
      meterId,
      size ? parseInt(size, 10) : 300,
    );

    return {
      success: true,
      data: qrData,
    };
  }

  @Get('meter/:meterId/image')
  async generateImageForMeter(
    @Param('meterId') meterId: string,
    @Query('size') size?: string,
    @Res() res?: Response,
  ) {
    const { buffer, meterId: id } = await this.qrCodesService.generateQrBuffer(
      meterId,
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
      generateDto.meterId,
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
      bulkDto.meterIds,
      bulkDto.size,
    );

    return {
      success: true,
      data: qrCodes,
      count: qrCodes.length,
    };
  }
}
