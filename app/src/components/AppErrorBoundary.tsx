import React from 'react'

interface State { hasError: boolean; error?: any }

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: any): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: any, info: any) {
    // Minimal logging; could be extended to send to telemetry endpoint
    console.error('[AppErrorBoundary] Uncaught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: 680, margin: '40px auto', fontFamily: 'sans-serif', lineHeight: 1.4 }}>
          <h2 style={{ marginTop: 0 }}>Algo deu errado 😬</h2>
          <p>Ocorreu um erro ao renderizar esta página. Tente:</p>
          <ul>
            <li>Recarregar a aplicação</li>
            <li>Limpar cache (Ctrl+Shift+R)</li>
          </ul>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: 16 }}>
            <summary>Detalhes do Erro</summary>
            {String(this.state.error?.message || this.state.error)}
            <br/>
            {String(this.state.error?.stack || '')}
          </details>
        </div>
      )
    }
    return this.props.children
  }
}

export default AppErrorBoundary