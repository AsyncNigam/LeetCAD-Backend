const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const s3 = new S3Client({
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  credentials: {
    accessKeyId: "leetcad",
    secretAccessKey: "leetcad_dev",
  },
  forcePathStyle: true,
});

async function run() {
  const fileContent = fs.readFileSync("scripts/test-cube.step");
  await s3.send(
    new PutObjectCommand({
      Bucket: "leetcad",
      Key: "problems/calibration-cube-golden.step",
      Body: fileContent,
      ContentType: "application/octet-stream",
    })
  );
  console.log("Golden file uploaded to MinIO.");
}

run().catch(console.error);
