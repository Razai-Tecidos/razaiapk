import React, { useState } from 'react'
import { TextInput, PasswordInput, Button, Paper, Title, Container, Text, Alert } from '@mantine/core'
import { useAuth } from '@/context/AuthContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { DS } from '@/design-system/tokens'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect logic will be handled by the ProtectedRoute or useEffect in main, 
  // but we can also force it here after success.
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const { error } = await signIn(email, pass)
      if (error) throw error
      // Navigation happens automatically via AuthStateChange or we can push
      // navigate('/') 
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login')
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
