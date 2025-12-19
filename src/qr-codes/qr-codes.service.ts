import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { ParkingZonesService } from '../parking-zones/parking-zones.service';

@Injectable()
export class QrCodesService {
  private readonly baseUrl: string;

  constructor(
    private readonly parkingZonesService: ParkingZonesService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = 'http://localhost:57852'; //this.configService.get<string>('APP_BASE_URL', 'https://parkup.app');
  }

  async generateQrCode(
    zoneId: string,
    size: number = 300,
  ): Promise<{ dataUrl: string; content: string; zoneId: string }> {
    const zone = await this.parkingZonesService.findOne(zoneId);

    if (!zone) {
      throw new NotFoundException(`Parking zone with ID ${zoneId} not found`);
    }

    const content = this.buildQrContent(zoneId);
    const dataUrl = await this.generateQrDataUrl(content, size);

    return {
      dataUrl,
      content,
      zoneId,
    };
  }

  async generateBulkQrCodes(
    zoneIds: string[],
    size: number = 300,
  ): Promise<
    Array<{ zoneId: string; dataUrl: string; content: string; error?: string }>
  > {
    const results = await Promise.all(
      zoneIds.map(async (zoneId) => {
        try {
          const qrData = await this.generateQrCode(zoneId, size);
          return qrData;
        } catch {
          return {
            zoneId,
            dataUrl: '',
            content: '',
            error: `Zone not found`,
          };
        }
      }),
    );

    return results;
  }

  async generateQrBuffer(
    zoneId: string,
    size: number = 300,
  ): Promise<{ buffer: Buffer; content: string; zoneId: string }> {
    const zone = await this.parkingZonesService.findOne(zoneId);

    if (!zone) {
      throw new NotFoundException(`Parking zone with ID ${zoneId} not found`);
    }

    const content = this.buildQrContent(zoneId);
    const buffer = await QRCode.toBuffer(content, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
    });

    return {
      buffer,
      content,
      zoneId,
    };
  }

  private buildQrContent(zoneId: string): string {
    return `${this.baseUrl}/parking/start?zone=${zoneId}`;
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
