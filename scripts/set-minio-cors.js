const { S3Client, PutBucketCorsCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: "leetcad",
    secretAccessKey: "leetcad_dev",
  },
  forcePathStyle: true,
});

async function setCors() {
  const params = {
    Bucket: "leetcad-uploads",
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedHeaders: ["*"],
          AllowedMethods: ["PUT", "POST", "GET", "HEAD"],
          AllowedOrigins: ["http://localhost:8080", "http://127.0.0.1:8080"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3000,
        },
      ],
    },
  };

  try {
    await s3.send(new PutBucketCorsCommand(params));
    console.log("CORS updated successfully for leetcad-uploads");
  } catch (err) {
    console.error("Error setting CORS:", err);
  }
}

setCors();
