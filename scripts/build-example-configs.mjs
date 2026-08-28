import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const exampleNames = ['streamdeck-plus-raid-browser', 'streamdeck-plus-xl-raid-browser']

for (const exampleName of exampleNames) {
  const sourcePath = join(repositoryRoot, 'examples', `${exampleName}.json`)
  const outputPath = join(repositoryRoot, 'companion', 'assets', `${exampleName}.companionconfig`)
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'))

  writeFileSync(outputPath, gzipSync(Buffer.from(`${JSON.stringify(source)}\n`), { level: 9 }))
}
