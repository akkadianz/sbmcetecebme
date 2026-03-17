const fs = require('fs')
const path = require('path')

const projectRoot = process.cwd()
const standaloneDir = path.join(projectRoot, '.next', 'standalone')
const standaloneStaticDir = path.join(standaloneDir, '.next', 'static')
const buildStaticDir = path.join(projectRoot, '.next', 'static')
const publicDir = path.join(projectRoot, 'public')
const standalonePublicDir = path.join(standaloneDir, 'public')

function copyDirectory(source, destination) {
  fs.mkdirSync(destination, { recursive: true })

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name)
    const destinationPath = path.join(destination, entry.name)

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath)
      continue
    }

    fs.copyFileSync(sourcePath, destinationPath)
  }
}

if (!fs.existsSync(standaloneDir)) {
  throw new Error('Next standalone build not found. Run "npm run build" first.')
}

if (fs.existsSync(buildStaticDir)) {
  copyDirectory(buildStaticDir, standaloneStaticDir)
}

if (fs.existsSync(publicDir)) {
  copyDirectory(publicDir, standalonePublicDir)
}
