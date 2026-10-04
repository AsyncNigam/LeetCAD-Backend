const fs = require('fs');

async function test() {
  const loginRes = await fetch("http://localhost:3000/api/auth/dev-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  const { accessToken } = await loginRes.json();
  
  const presignRes = await fetch("http://localhost:3000/api/storage/presigned-url", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({ filename: "cube.step", contentType: "application/octet-stream" })
  });
  const { url, fileKey } = await presignRes.json();
  
  console.log("Got presigned URL and fileKey:", fileKey);
  
  const fakeStep = fs.readFileSync('scripts/test-cube.step');

  await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: fakeStep
  });
  
  console.log("Uploaded file.");
  
  const submitRes = await fetch("http://localhost:3000/api/submissions/complete", {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`
    },
    body: JSON.stringify({ fileKey })
  });
  
  console.log("Submission registered:", await submitRes.json());
}
test().catch(console.error);
