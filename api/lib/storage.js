// Cloudflare R2 is S3-API-compatible, so the regular AWS SDK client works
// against it, just pointed at R2's endpoint instead of AWS. Used for post
// media (photos/videos): those need to scale past what the app server's
// own disk can hold, unlike the small local avatar uploads in users.js.
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const accountId = process.env.R2_ACCOUNT_ID
const bucket = process.env.R2_BUCKET_NAME
const publicBaseUrl = process.env.R2_PUBLIC_URL // e.g. https://media.projectfenris.com or an r2.dev URL

const client = accountId
  ? new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    })
  : null

export function storageConfigured() {
  return !!client && !!bucket && !!publicBaseUrl
}

export async function uploadToR2(key, body, contentType) {
  if (!storageConfigured()) throw new Error('R2 storage is not configured')
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
  return `${publicBaseUrl.replace(/\/$/, '')}/${key}`
}

export async function deleteFromR2(key) {
  if (!storageConfigured()) return
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}

// Recover the object key from a public URL previously returned by
// uploadToR2, so a delete can be issued with just the stored URL.
export function keyFromUrl(url) {
  if (!publicBaseUrl || !url.startsWith(publicBaseUrl)) return null
  return url.slice(publicBaseUrl.replace(/\/$/, '').length + 1)
}
