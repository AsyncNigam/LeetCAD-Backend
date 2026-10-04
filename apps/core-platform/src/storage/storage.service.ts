import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { S3Client, PutBucketLifecycleConfigurationCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { randomUUID } from "node:crypto";

@Injectable()
export class StorageService implements OnModuleInit {
  /** S3 client used for generating browser-facing presigned URLs */
  private readonly publicS3: S3Client;
  private readonly bucket = "leetcad-uploads";
  private readonly logger = new Logger(StorageService.name);

  constructor() {
    // For presigned URLs the endpoint MUST be reachable by the browser.
    // Inside Docker, S3_ENDPOINT resolves to "http://minio:9000" which the
    // browser cannot reach.  PUBLIC_S3_ENDPOINT (or the .env default of
    // http://localhost:9000) gives the host-mapped address instead.
    const publicEndpoint =
      process.env.PUBLIC_S3_ENDPOINT ||
      process.env.S3_ENDPOINT ||
      "http://localhost:9000";

    this.publicS3 = new S3Client({
      endpoint: publicEndpoint,
      region: process.env.S3_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || "leetcad",
        secretAccessKey: process.env.S3_SECRET_KEY || "leetcad_dev",
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

    const { url, fields } = await createPresignedPost(this.publicS3, {
      Bucket: this.bucket,
      Key: fileKey,
      Conditions: [
        ["content-length-range", 1, 5242880], // 1 Byte to 5 MB
      ],
      Expires: 900, // 15 minutes
    });

    return { url, fields, fileKey };
  }
}
