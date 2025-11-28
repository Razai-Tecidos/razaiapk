import React, { useState } from 'react'
import { CutterMode } from '@/modules/cutter-mode/CutterMode'

export default function MobileStock() {
  // Force CutterMode to be always open and act as the main page content
  // We pass a dummy onClose that does nothing, or maybe reloads the page
  return (
    <div style={{ height: '100dvh', background: '#F9FAFB' }}>
      <CutterMode isOpen={true} onClose={() => {}} />
    </div>
  )
}
