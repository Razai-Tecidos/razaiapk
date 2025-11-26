import { getRuntime, isRuntime } from './runtime'

export type SavePayload = {
  data: Blob | ArrayBuffer | Uint8Array | string
  fileName: string
  mimeType?: string
  description?: string
  defaultPath?: string
}

export type SaveResult = {
  location?: string
  cancelled?: boolean
  fallbackUsed?: boolean
  success: boolean
}

export async function saveFile(payload: SavePayload): Promise<SaveResult> {
  const runtime = getRuntime()

  if (isRuntime('tauri-desktop', 'tauri-mobile')) {
    try {
      const [{ save }, fsMod] = await Promise.all([
        import('@tauri-apps/plugin-dialog'),
        import('@tauri-apps/plugin-fs'),
      ])
      const suggested = payload.defaultPath || payload.fileName
      const picked = await save({ defaultPath: suggested, filters: payload.mimeType ? [{ name: payload.description || payload.mimeType, extensions: [extensionFromName(payload.fileName)] }] : undefined })
      if (!picked) return { cancelled: true, success: false }
      const data = await toUint8Array(payload.data)
      const fs: any = fsMod
      if (typeof fs.writeFile === 'function') {
        await fs.writeFile(picked, data)
      } else if (typeof fs.writeBinaryFile === 'function') {
        await fs.writeBinaryFile(picked, data)
      } else if (typeof fs.writeTextFile === 'function') {
        await fs.writeTextFile(picked, new TextDecoder().decode(data))
      } else {
        throw new Error('No suitable write function exposed by plugin-fs')
      }
      return { location: picked, success: true }
    } catch (error) {
      console.warn('[platform:filesystem] tauri saveFile failed; falling back to web download', error)
      return triggerWebDownload(payload, true)
    }
  }

  if (runtime === 'capacitor') {
    // Placeholder: rely on Capacitor Filesystem plugin when integrated; for now, fall back to web download logic.
    return triggerWebDownload(payload, true)
  }

  if (runtime === 'node-test') {
    return { fallbackUsed: true, success: true }
  }

  return triggerWebDownload(payload, false)
}

function extensionFromName(name: string): string {
  const parts = name.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : '*'
}

async function toUint8Array(input: Blob | ArrayBuffer | Uint8Array | string): Promise<Uint8Array> {
  if (typeof input === 'string') {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(input)
    throw new Error('TextEncoder not available in current environment')
  }
  if (input instanceof Blob) {
    const buf = await input.arrayBuffer()
    return new Uint8Array(buf)
  }
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer)
  throw new Error('Unsupported data type for saveFile')
}

function triggerWebDownload(payload: SavePayload, fallbackUsed: boolean): SaveResult {
  if (typeof document === 'undefined') return { fallbackUsed, success: true }
  try {
    const blob = toBlob(payload.data, payload.mimeType)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = payload.fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    return { fallbackUsed, success: true }
  } catch (error) {
    console.error('[platform:filesystem] triggerWebDownload failed', error)
    return { fallbackUsed, success: false }
  }
}

function toBlob(input: Blob | ArrayBuffer | Uint8Array | string, mimeType?: string): Blob {
  if (input instanceof Blob) return input
  if (typeof input === 'string') return new Blob([input], { type: mimeType || 'text/plain;charset=utf-8' })
  if (input instanceof ArrayBuffer) return new Blob([input], { type: mimeType || 'application/octet-stream' })
  if (ArrayBuffer.isView(input)) {
    const baseView = new Uint8Array(input.buffer, (input as ArrayBufferView).byteOffset, (input as ArrayBufferView).byteLength)
    const copy = new Uint8Array(baseView.byteLength)
    copy.set(baseView)
    return new Blob([copy.buffer], { type: mimeType || 'application/octet-stream' })
  }
  throw new Error('Unsupported data type for toBlob')
}
