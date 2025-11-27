import React, { useState } from 'react'
import { TextInput, PasswordInput, Button, Paper, Title, Container, Text, Alert } from '@mantine/core'
import { supabase } from '@/lib/supabase'
import { useNavigate, useLocation } from 'react-router-dom'
import { DS } from '@/design-system/tokens'

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      let emailToUse = username
      
      // Se não parece um email, buscar o email pelo username
      if (!username.includes('@')) {
        console.log('[login] Looking up username:', username)
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.toLowerCase())
          .single()
        
        if (profileError || !profile) {
          throw new Error('Usuário não encontrado')
        }
        
        // Buscar o email do usuário na auth.users via função RPC ou usar email fictício
        // Como o Supabase não expõe auth.users diretamente, usamos o padrão: username@razai.local
        emailToUse = `${username.toLowerCase()}@razai.local`
      }
      
      console.log('[login] Attempting login with:', emailToUse)
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: pass,
      })
      console.log('[login] Result:', error ? error.message : 'success', data)
      if (error) throw error
      navigate('/', { replace: true })
    } catch (err: any) {
      console.error('[login] Error:', err)
      const msg = err?.message || 'Erro ao fazer login'
      // Traduzir mensagens comuns do Supabase
      if (msg.includes('Invalid login credentials')) {
        setError('Usuário ou senha incorretos')
      } else if (msg.includes('Email not confirmed')) {
        setError('Email não confirmado. Verifique sua caixa de entrada.')
      } else if (msg.includes('User not found') || msg.includes('Usuário não encontrado')) {
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
              label="Usuário" 
              placeholder="seu nome de usuário" 
              required 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
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
