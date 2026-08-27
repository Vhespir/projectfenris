// Turns a raw uploaded photo or video into what actually gets stored: a
// resized/compressed photo and a thumbnail, or a transcoded, length-capped
// video and a poster-frame thumbnail. Keeping this out of the route handler
// since it needs real temp files on disk (ffmpeg doesn't work off a stream).
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import ffmpegPath from 'ffmpeg-static'
import ffprobePath from 'ffprobe-static'

const run = promisify(execFile)

// Ground-truth footage from a disaster in progress rarely needs more than
// this to be useful, and every extra second is more storage and transcode
// time. Trimmed silently rather than rejected, so a slightly-long clip
// still posts instead of erroring out.
const MAX_VIDEO_SECONDS = 60
const MAX_VIDEO_HEIGHT = 720

export async function processPhoto(buffer) {
  const full = await sharp(buffer)
    .rotate() // apply EXIF orientation, then strip it, so it doesn't render sideways
    .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer({ resolveWithObject: true })

  const thumb = await sharp(buffer)
    .rotate()
    .resize({ width: 400, height: 400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer()

  return {
    buffer: full.data,
    thumbnail: thumb,
    width: full.info.width,
    height: full.info.height,
  }
}

export async function processVideo(inputBuffer) {
  const dir = await mkdtemp(join(tmpdir(), 'fenris-media-'))
  const inputPath = join(dir, 'input')
  const outputPath = join(dir, 'output.mp4')
  const thumbPath = join(dir, 'thumb.jpg')

  try {
    await writeFile(inputPath, inputBuffer)

    await run(ffmpegPath, [
      '-y', '-i', inputPath,
      '-t', String(MAX_VIDEO_SECONDS),
      '-vf', `scale=-2:'min(${MAX_VIDEO_HEIGHT},ih)'`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart',
      outputPath,
    ])

    await run(ffmpegPath, [
      '-y', '-i', outputPath,
      '-ss', '00:00:00.5', '-vframes', '1',
      thumbPath,
    ]).catch(() => run(ffmpegPath, ['-y', '-i', outputPath, '-vframes', '1', thumbPath]))

    const { stdout } = await run(ffprobePath.path, [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height:format=duration',
      '-of', 'json',
      outputPath,
    ])
    const probe = JSON.parse(stdout)
    const stream = probe.streams?.[0] ?? {}

    const [video, thumbnail] = await Promise.all([
      readFile(outputPath),
      readFile(thumbPath).catch(() => null),
    ])

    return {
      buffer: video,
      thumbnail,
      width: stream.width ?? null,
      height: stream.height ?? null,
      durationSeconds: probe.format?.duration ? Number(probe.format.duration) : null,
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
