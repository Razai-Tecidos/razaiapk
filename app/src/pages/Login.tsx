import React, { useState } from 'react'
import { TextInput, PasswordInput, Button, Paper, Title, Container, Text, Alert } from '@mantine/core'
import { supabase } from '@/lib/supabase'
import { useNavigate, useLocation } from 'react-router-dom'
import { DS } from '@/design-system/tokens'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      console.log('[login] Attempting login with:', email)
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
      })
      console.log('[login] Result:', error ? error.message : 'success', data)
      if (error) throw error
      // Force page reload to ensure auth state is properly loaded
      window.location.href = '/'
    } catch (err: any) {
      console.error('[login] Error:', err)
      const msg = err?.message || 'Erro ao fazer login'
      // Traduzir mensagens comuns do Supabase
      if (msg.includes('Invalid login credentials')) {
        setError('Email ou senha incorretos')
      } else if (msg.includes('Email not confirmed')) {
        setError('Email não confirmado. Verifique sua caixa de entrada.')
      } else if (msg.includes('User not found')) {
        setError('Usuário não encontrado')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: DS.color.bg 
    }}>
      <Container size={420} my={40}>
        <Title ta="center" style={{ fontFamily: DS.font.familySans, fontWeight: 900 }}>
          Razai Tools
        </Title>
        <Text c="dimmed" size="sm" ta="center" mt={5}>
          Faça login para continuar
        </Text>

        <Paper withBorder shadow="md" p={30} mt={30} radius="md">
          <form onSubmit={handleLogin}>
            {error && (
              <Alert color="red" mb="md" title="Erro">
                {error}
              </Alert>
            )}
            
            <TextInput 
              label="Email" 
              placeholder="seu@email.com" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <PasswordInput 
              label="Senha" 
              placeholder="Sua senha" 
              required 
              mt="md" 
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
            
            <Button fullWidth mt="xl" type="submit" loading={loading}>
              Entrar
            </Button>
          </form>
        </Paper>
      </Container>
    </div>
  )
}
