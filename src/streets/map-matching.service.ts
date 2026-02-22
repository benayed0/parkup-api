import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MapMatchingService {
  private readonly logger = new Logger(MapMatchingService.name);
  private readonly mapboxUrl =
    'https://api.mapbox.com/matching/v5/mapbox/driving';

  constructor(private configService: ConfigService) {}

  private get mapboxToken(): string {
    return this.configService.get<string>('MAPBOX_ACCESS_TOKEN', '');
  }

  /**
   * Matches coordinates to the road network using Mapbox Map Matching API.
   * @param lngLatCoords - Array of [longitude, latitude] coordinates
   * @returns Matched [longitude, latitude] coordinates, or null on failure
   */
  async matchCoordinates(
    lngLatCoords: [number, number][],
  ): Promise<[number, number][] | null> {
    if (!this.mapboxToken || lngLatCoords.length < 2) return null;

    try {
      // Mapbox Map Matching supports max 100 waypoints per request
      const chunk = lngLatCoords.slice(0, 100);
      const coordString = chunk
        .map(([lng, lat]) => `${lng},${lat}`)
        .join(';');
      const url = `${this.mapboxUrl}/${coordString}?geometries=geojson&access_token=${this.mapboxToken}`;

      const response = await fetch(url);
      if (!response.ok) {
        this.logger.warn(
          `Mapbox Map Matching API error: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const data = (await response.json()) as {
        matchings?: { geometry: { coordinates: [number, number][] } }[];
        code?: string;
        message?: string;
      };

      if (data.code !== 'Ok' || !data.matchings?.length) {
        this.logger.warn(
          `Mapbox Map Matching no result: code=${data.code} msg=${data.message}`,
        );
        return null;
      }

      return data.matchings[0].geometry.coordinates;
    } catch (error) {
      this.logger.warn(`Map Matching request failed: ${error}`);
      return null;
    }
  }

  /**
   * Decodes a Google encoded polyline string into [lat, lng] coordinate pairs.
   */
  decodePolyline(encoded: string): [number, number][] {
    const coords: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b: number;
      let shift = 0;
      let result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      coords.push([lat / 1e5, lng / 1e5]);
    }

    return coords;
  }

  /**
   * Encodes [lat, lng] coordinate pairs into a Google encoded polyline string.
   */
  encodePolyline(coords: [number, number][]): string {
    let output = '';
    let prevLatE5 = 0;
    let prevLngE5 = 0;

    for (const [lat, lng] of coords) {
      const latE5 = Math.round(lat * 1e5);
      const lngE5 = Math.round(lng * 1e5);
      output += this._encodeValue(latE5 - prevLatE5);
      output += this._encodeValue(lngE5 - prevLngE5);
      prevLatE5 = latE5;
      prevLngE5 = lngE5;
    }

    return output;
  }

  private _encodeValue(value: number): string {
    let v = value < 0 ? ~(value << 1) : value << 1;
    let output = '';
    while (v >= 0x20) {
      output += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    output += String.fromCharCode(v + 63);
    return output;
  }
}
