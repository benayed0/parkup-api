import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { ParkingMetersService } from '../parking-meters/parking-meters.service';

@Injectable()
export class QrCodesService {
  private readonly baseUrl: string;

  constructor(
    private readonly parkingMetersService: ParkingMetersService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = 'http://localhost:57852'; //this.configService.get<string>('APP_BASE_URL', 'https://parkup.app');
  }

  async generateQrCode(
    meterId: string,
    size: number = 300,
  ): Promise<{ dataUrl: string; content: string; meterId: string }> {
    const meter = await this.parkingMetersService.findOne(meterId);

    if (!meter) {
      throw new NotFoundException(`Parking meter with ID ${meterId} not found`);
    }

    const content = this.buildQrContent(meterId);
    const dataUrl = await this.generateQrDataUrl(content, size);

    return {
      dataUrl,
      content,
      meterId,
    };
  }

  async generateBulkQrCodes(
    meterIds: string[],
    size: number = 300,
  ): Promise<
    Array<{ meterId: string; dataUrl: string; content: string; error?: string }>
  > {
    const results = await Promise.all(
      meterIds.map(async (meterId) => {
        try {
          const qrData = await this.generateQrCode(meterId, size);
          return qrData;
        } catch {
          return {
            meterId,
            dataUrl: '',
            content: '',
            error: `Meter not found`,
          };
        }
      }),
    );

    return results;
  }

  async generateQrBuffer(
    meterId: string,
    size: number = 300,
  ): Promise<{ buffer: Buffer; content: string; meterId: string }> {
    const meter = await this.parkingMetersService.findOne(meterId);

    if (!meter) {
      throw new NotFoundException(`Parking meter with ID ${meterId} not found`);
    }

    const content = this.buildQrContent(meterId);
    const buffer = await QRCode.toBuffer(content, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    return {
      buffer,
      content,
      meterId,
    };
  }

  private buildQrContent(meterId: string): string {
    return `${this.baseUrl}/parking/start?meter=${meterId}`;
  }

  private async generateQrDataUrl(
    content: string,
    size: number,
  ): Promise<string> {
    return QRCode.toDataURL(content, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
  }
}
