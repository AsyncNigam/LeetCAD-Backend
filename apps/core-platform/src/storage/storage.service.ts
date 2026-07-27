import { Injectable } from "@nestjs/common";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket = "leetcad-uploads";

  constructor() {
    this.s3 = new S3Client({
      endpoint: "http://localhost:9000",
      region: "us-east-1",
      credentials: {
        accessKeyId: "leetcad",
        secretAccessKey: "leetcad_dev",
      },
      forcePathStyle: true,
    });
  }

  async getPresignedUploadUrl(
    userId: string,
    filename: string,
  ): Promise<{ url: string; fileKey: string }> {
    const fileKey = `${userId}/${randomUUID()}-${filename}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: fileKey,
    });

    const url = await getSignedUrl(this.s3, command, { expiresIn: 900 });

    return { url, fileKey };
  }
}
