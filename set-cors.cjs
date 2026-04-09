const { Storage } = require('@google-cloud/storage');

async function configureBucketCors() {
  const storage = new Storage();
  // Ensure you are authenticated, e.g., via GOOGLE_APPLICATION_CREDENTIALS environment variable.
  const bucketName = 'gen-lang-client-0425317525.appspot.com';
  
  const corsConfiguration = [
    {
      origin: ['*'],
      method: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      responseHeader: ['Content-Type', 'Authorization', 'Content-Length', 'User-Agent', 'x-goog-resumable'],
      maxAgeSeconds: 3600,
    },
  ];

  try {
    await storage.bucket(bucketName).setCorsConfiguration(corsConfiguration);
    console.log(`CORS has been set successfully for ${bucketName}`);
  } catch (error) {
    console.error('Failed to set CORS:', error);
  }
}

configureBucketCors();
