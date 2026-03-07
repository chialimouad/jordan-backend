import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import * as streamifier from 'streamifier';

@Injectable()
export class CloudinaryService {
    private readonly logger = new Logger(CloudinaryService.name);

    constructor(private configService: ConfigService) {
        cloudinary.config({
            cloud_name: this.configService.get<string>('cloudinary.cloudName'),
            api_key: this.configService.get<string>('cloudinary.apiKey'),
            api_secret: this.configService.get<string>('cloudinary.apiSecret'),
        });
        this.logger.log('Cloudinary configured');
    }

    async uploadImage(
        file: Express.Multer.File,
        folder: string = 'wafaa/profiles',
    ): Promise<UploadApiResponse> {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder,
                    resource_type: 'image',
                    transformation: [
                        { width: 800, height: 800, crop: 'limit' },
                        { quality: 'auto:good' },
                        { fetch_format: 'auto' },
                    ],
                },
                (error, result) => {
                    if (error || !result) {
                        this.logger.error('Upload failed', error);
                        reject(error || new Error('Upload returned no result'));
                    } else {
                        resolve(result);
                    }
                },
            );

            streamifier.createReadStream(file.buffer).pipe(uploadStream);
        });
    }

    async deleteImage(publicId: string): Promise<void> {
        try {
            await cloudinary.uploader.destroy(publicId);
            this.logger.log(`Deleted image: ${publicId}`);
        } catch (error) {
            this.logger.error(`Failed to delete image: ${publicId}`, error);
        }
    }
}
