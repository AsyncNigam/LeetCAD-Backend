import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { S3Client, PutBucketLifecycleConfigurationCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

@Injectable()
export class StorageService implements OnModuleInit {
  /** S3 client used for generating browser-facing presigned URLs */
  private readonly publicS3: S3Client;
  private readonly bucket = process.env.R2_BUCKET_NAME || "leetcad-storage";
  private readonly logger = new Logger(StorageService.name);

  constructor() {
    this.publicS3 = new S3Client({
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      region: "auto",
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY || "",
        secretAccessKey: process.env.R2_SECRET_KEY || "",
      },
      forcePathStyle: true,
    });
  }

  async onModuleInit() {
    try {
      const command = new PutBucketLifecycleConfigurationCommand({
        Bucket: this.bucket,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: "auto-delete-old-submissions",
              Status: "Enabled",
              Filter: { Prefix: "submissions/" },
              Expiration: { Days: 3 },
            },
          ],
        },
      });
      await this.publicS3.send(command);
      this.logger.log("Storage lifecycle policy enforced: Submissions expire after 3 days.");
    } catch (error: any) {
      this.logger.error(`Failed to set bucket lifecycle configuration: ${error.message}`);
    }
  }

  async getPresignedUploadUrl(
    userId: string,
    filename: string,
  ): Promise<{ url: string; fields: Record<string, string>; fileKey: string }> {
    const fileKey = `submissions/${userId}/${randomUUID()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
      ContentType: "application/octet-stream",
    });

    const url = await getSignedUrl(this.publicS3, command, { expiresIn: 900 });

    return { url, fields: {}, fileKey };
  }
}
