#!/usr/bin/env node
const { spawn } = require('node:child_process')

async function isDevUp(url = 'http://localhost:5173', timeoutMs = 1500) {
  try {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), timeoutMs)
    const res = await fetch(url, { signal: ac.signal })
    clearTimeout(t)
    return res.ok || res.status === 404 // server responds
  } catch {
    return false
  }
}

function onceReady(proc, match = 'Local:') {
  return new Promise((resolve) => {
    let resolved = false
    const onData = (data) => {
      const text = data.toString()
      process.stdout.write(text)
      if (!resolved && text.includes(match)) {
        resolved = true
        // try to extract the URL
        const urlMatch = text.match(/Local:\s+(http:\/\/[^\s]+)/)
        const url = urlMatch ? urlMatch[1] : 'http://localhost:5173/'
        console.log(`\nDev server: ${url}\n`)
        resolve(url)
      }
    }
    proc.stdout.on('data', onData)
    proc.stderr.on('data', (d) => process.stderr.write(d.toString()))
    proc.on('exit', (code) => {
      if (!resolved) resolve(null)
    })
  })
}

async function main() {
  const alreadyUp = await isDevUp()
  let devProc = null
  if (!alreadyUp) {
    // start dev server
  const cmd = /^win/i.test(process.platform) ? 'cmd' : 'npm'
  const args = /^win/i.test(process.platform) ? ['/c','npm','run','dev'] : ['run','dev']
  devProc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    // wait for ready line (with fallback timeout)
    const race = Promise.race([
      onceReady(devProc),
      new Promise((r) => setTimeout(() => { console.log('\nDev server: http://localhost:5173/ (timeout fallback)\n'); r('http://localhost:5173/') }, 5000))
    ])
    await race
  } else {
    console.log('\nDev server: http://localhost:5173/ (already running)\n')
  }

  // run tests
  const testCmd = /^win/i.test(process.platform) ? 'cmd' : 'npx'
  const testArgs = /^win/i.test(process.platform) ? ['/c','npx','vitest','run'] : ['vitest','run']
  const testProc = spawn(testCmd, testArgs, { stdio: 'inherit' })
  testProc.on('exit', (code) => {
    // cleanup dev server if we started it
    if (devProc) {
      try { devProc.kill('SIGTERM') } catch {}
    }
    process.exit(code ?? 0)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
