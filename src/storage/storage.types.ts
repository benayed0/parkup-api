export interface UploadOptions {
  folder: string;
  publicId?: string;
  resourceType?: 'image' | 'video' | 'raw';
  overwrite?: boolean;
}

export interface StorageDriver {
  uploadBuffer(buffer: Buffer, options: UploadOptions): Promise<string>;
  deleteByUrl(url: string): Promise<boolean>;
  deleteManyByUrl(urls: string[]): Promise<boolean[]>;
}
