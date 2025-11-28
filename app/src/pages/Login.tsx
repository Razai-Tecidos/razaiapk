import React, { useState } from 'react'
import { TextInput, PasswordInput, Button, Paper, Title, Container, Text, Alert, Box, Group } from '@mantine/core'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import { DS } from '@/design-system/tokens'
import { IconLock, IconUser, IconBrandWindows } from '@tabler/icons-react'

export default function Login() {
  const navigate = useNavigate()
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
      
      if (!username.includes('@')) {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username.toLowerCase())
          .single()
        
        if (profileError || !profile) {
          throw new Error('Usuário não encontrado')
        }
        emailToUse = `${username.toLowerCase()}@razai.local`
      }
      
      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: pass,
      })
      
      if (error) throw error
      navigate('/', { replace: true })
    } catch (err: any) {
      console.error('[login] Error:', err)
      const msg = err?.message || 'Erro ao fazer login'
      if (msg.includes('Invalid login credentials')) {
        setError('Credenciais inválidas')
      } else if (msg.includes('Email not confirmed')) {
        setError('Email não confirmado')
      } else {
        setError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      background: '#f8f9fa',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative Background Elements */}
      <div style={{
        position: 'absolute',
        top: -100,
        right: -100,
        width: 600,
        height: 600,
        background: 'radial-gradient(circle, rgba(37,38,43,0.05) 0%, rgba(255,255,255,0) 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: -100,
        left: -100,
        width: 500,
        height: 500,
        background: 'radial-gradient(circle, rgba(37,38,43,0.05) 0%, rgba(255,255,255,0) 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />

      <Container size="xs" style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center',
        zIndex: 1
      }}>
        <div style={{ marginBottom: DS.spacing(8), textAlign: 'center' }}>
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            width: 64, 
            height: 64, 
            background: DS.color.textPrimary, 
            borderRadius: DS.radius.xl,
            color: '#fff',
            marginBottom: DS.spacing(4),
            boxShadow: DS.shadow.lg
          }}>
            <IconBrandWindows size={32} stroke={1.5} />
          </div>
          <Title order={1} style={{ 
            fontFamily: DS.font.familySans, 
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: DS.color.textPrimary
          }}>
            Razai Tools
          </Title>
          <Text c="dimmed" size="lg" mt="xs">
            Faça login para acessar o sistema
          </Text>
        </div>

        <Paper shadow="xl" p={40} radius="lg" withBorder style={{ background: '#fff' }}>
          <form onSubmit={handleLogin}>
            {error && (
              <Alert color="red" mb="lg" variant="light" title="Atenção" icon={<IconLock size={16} />}>
                {error}
              </Alert>
            )}
            
            <TextInput 
              label="Usuário" 
              placeholder="Ex: piaui" 
              required 
              size="md"
              leftSection={<IconUser size={18} />}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              mb="md"
            />
            
            <PasswordInput 
              label="Senha" 
              placeholder="Sua senha" 
              required 
              size="md"
              leftSection={<IconLock size={18} />}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              mb="xl"
            />
            
            <Button fullWidth size="md" type="submit" loading={loading} color="dark">
              Entrar no Sistema
            </Button>
          </form>
        </Paper>
        
        <Text c="dimmed" size="xs" ta="center" mt="xl">
          &copy; {new Date().getFullYear()} Razai Tecidos. Todos os direitos reservados.
        </Text>
      </Container>
    </Box>
  )
}
