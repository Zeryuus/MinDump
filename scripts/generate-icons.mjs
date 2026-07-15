import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const svg = readFileSync(join(publicDir, 'icon.svg'))

await sharp(svg).resize(192, 192).png().toFile(join(publicDir, 'icon-192.png'))
await sharp(svg).resize(512, 512).png().toFile(join(publicDir, 'icon-512.png'))

console.log('Icônes générées : public/icon-192.png, public/icon-512.png')
