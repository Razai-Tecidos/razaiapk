import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://uxjpqavwwuctqndzubha.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4anBxYXZ3d3VjdHFuZHp1YmhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzI5MTgsImV4cCI6MjA3OTU0ODkxOH0.WGKBaJfPOYfU4zzBOWJm_S4fx2e6JeTP93YdtsZ5bQs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
