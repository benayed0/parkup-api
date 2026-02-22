import { Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';
import { ConfigService } from '@nestjs/config';
import { StorageDriver, UploadOptions } from '../storage.types';

@Injectable()
export class CloudinaryStorageDriver implements StorageDriver {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async uploadBuffer(buffer: Buffer, options: UploadOptions): Promise<string> {
    const {
      folder,
      publicId,
      resourceType = 'image',
      overwrite = true,
    } = options;

    return new Promise<string>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          overwrite,
          resource_type: resourceType,
        },
        (error?: UploadApiErrorResponse, result?: UploadApiResponse) => {
          if (error) return reject(error);
          if (!result?.secure_url) return reject(new Error('Cloudinary upload returned no secure_url'));
          resolve(result.secure_url);
        },
      );

      streamifier.createReadStream(buffer).pipe(uploadStream);
    });
  }

  /**
   * Robust extraction:
   * - handles /image/upload/v123/folder/name.jpg
   * - handles transformations: /image/upload/c_fill,w_400/v123/folder/name.jpg
   * - strips extension, querystring
   */
  private getPublicIdFromCloudinaryUrl(url: string): string {
    const u = new URL(url);
    const segments = u.pathname.split('/').filter(Boolean);

    // Find ".../upload/...."
    const uploadIndex = segments.findIndex((s) => s === 'upload');
    if (uploadIndex === -1 || uploadIndex === segments.length - 1) {
      throw new Error(`Invalid Cloudinary URL (missing /upload/): ${url}`);
    }

    // Everything after 'upload' may include transformations and/or version:
    // e.g. ["c_fill,w_400", "v1700000", "products", "abc-0.jpg"]
    let afterUpload = segments.slice(uploadIndex + 1);

    // Drop transformation segments until we hit version or folder
    // Version segment looks like v123...
    if (afterUpload[0]?.startsWith('c_') || afterUpload[0]?.includes(',')) {
      // could be multiple transformation segments; drop until version or actual folder
      while (afterUpload.length && !afterUpload[0].startsWith('v') && afterUpload[0].includes('_')) {
        afterUpload = afterUpload.slice(1);
      }
    }

    // Drop version segment if present
    if (afterUpload[0]?.startsWith('v')) afterUpload = afterUpload.slice(1);

    if (afterUpload.length < 2) {
      // must have at least folder + filename
      throw new Error(`Invalid Cloudinary URL (cannot parse publicId): ${url}`);
    }

    const filename = afterUpload.pop()!; // "abc-0.jpg"
    const nameNoExt = filename.split('.')[0];
    return [...afterUpload, nameNoExt].join('/'); // "products/abc-0"
  }

  async deleteByUrl(url: string): Promise<boolean> {
    try {
      const publicId = this.getPublicIdFromCloudinaryUrl(url);
      const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      return result.result === 'ok' || result.result === 'not found';
    } catch {
      return false;
    }
  }

  async deleteManyByUrl(urls: string[]): Promise<boolean[]> {
    return Promise.all(urls.map((u) => this.deleteByUrl(u)));
  }
}
