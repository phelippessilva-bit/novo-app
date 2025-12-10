'use client'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export function createClient() {
  // Validar se as variáveis de ambiente estão configuradas
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas. Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
  
  return createSupabaseClient(supabaseUrl, supabaseAnonKey)
}

// Função auxiliar para verificar se Supabase está configurado
export function isSupabaseConfigured() {
  return !!(supabaseUrl && supabaseAnonKey)
}
