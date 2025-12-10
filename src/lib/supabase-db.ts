import { createClient, isSupabaseConfigured } from '@/lib/supabase'

export interface RouletteHistoryEntry {
  id: string
  number: number
  color: string
  created_at: string
}

export interface SuggestionResult {
  suggested_numbers: number[]
  probability_score: number
  pattern_detected: string
  confidence: string
}

// Salvar número no histórico
export async function saveNumberToHistory(number: number, color: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado')
  }
  
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('roulette_history')
    .insert([{ number, color }])
    .select()
  
  if (error) {
    console.error('Erro ao salvar número:', error)
    throw error
  }
  
  return data
}

// Buscar últimos N números do histórico
export async function getLastNumbers(limit: number = 100) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado')
  }
  
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('roulette_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Erro ao buscar histórico:', error)
    throw error
  }
  
  return data as RouletteHistoryEntry[]
}

// Buscar todo o histórico
export async function getAllHistory() {
  if (!isSupabaseConfigured()) {
    return [] // Retorna array vazio se não configurado
  }
  
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('roulette_history')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Erro ao buscar histórico completo:', error)
    return [] // Retorna array vazio em caso de erro
  }
  
  return data as RouletteHistoryEntry[]
}

// Limpar histórico
export async function clearHistory() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado')
  }
  
  const supabase = createClient()
  
  const { error } = await supabase
    .from('roulette_history')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000') // Deleta todos
  
  if (error) {
    console.error('Erro ao limpar histórico:', error)
    throw error
  }
  
  return true
}

// Calcular frequência de números
export function calculateFrequency(history: RouletteHistoryEntry[]) {
  const frequency: { [key: number]: number } = {}
  
  history.forEach(entry => {
    frequency[entry.number] = (frequency[entry.number] || 0) + 1
  })
  
  return frequency
}

// Analisar padrões e gerar sugestões
export function generateSuggestions(history: RouletteHistoryEntry[]): SuggestionResult {
  if (history.length < 10) {
    return {
      suggested_numbers: [],
      probability_score: 0,
      pattern_detected: 'Histórico insuficiente (mínimo 10 números)',
      confidence: 'Baixa'
    }
  }
  
  const frequency = calculateFrequency(history)
  const lastNumbers = history.slice(0, 20).map(h => h.number)
  
  // Números mais frequentes (quentes)
  const hotNumbers = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([num]) => parseInt(num))
  
  // Números menos frequentes (frios)
  const allNumbers = Array.from({ length: 37 }, (_, i) => i)
  const coldNumbers = allNumbers
    .filter(num => !frequency[num] || frequency[num] < 2)
    .slice(0, 5)
  
  // Detectar sequências
  const sequences: number[] = []
  for (let i = 0; i < lastNumbers.length - 1; i++) {
    const diff = Math.abs(lastNumbers[i] - lastNumbers[i + 1])
    if (diff <= 3 && diff > 0) {
      const predicted = lastNumbers[i] + (lastNumbers[i] - lastNumbers[i + 1])
      if (predicted >= 0 && predicted <= 36) {
        sequences.push(predicted)
      }
    }
  }
  
  // Números vizinhos dos últimos 5
  const neighbors: number[] = []
  lastNumbers.slice(0, 5).forEach(num => {
    if (num > 0) neighbors.push(num - 1)
    if (num < 36) neighbors.push(num + 1)
  })
  
  // Combinar sugestões (priorizar números quentes e vizinhos)
  const suggested = [
    ...hotNumbers.slice(0, 3),
    ...neighbors.slice(0, 2),
    ...sequences.slice(0, 2),
    ...coldNumbers.slice(0, 1)
  ]
  
  // Remover duplicatas e limitar a 6 números
  const uniqueSuggested = [...new Set(suggested)].slice(0, 6)
  
  // Calcular score de probabilidade baseado na frequência
  const avgFrequency = Object.values(frequency).reduce((a, b) => a + b, 0) / Object.keys(frequency).length
  const maxFrequency = Math.max(...Object.values(frequency))
  const probabilityScore = Math.min(95, (maxFrequency / avgFrequency) * 25)
  
  // Determinar confiança
  let confidence = 'Baixa'
  if (history.length > 50 && probabilityScore > 60) confidence = 'Alta'
  else if (history.length > 30 && probabilityScore > 40) confidence = 'Média'
  
  // Detectar padrão dominante
  let patternDetected = 'Análise estatística'
  if (hotNumbers.length > 0) {
    patternDetected = `Números quentes detectados: ${hotNumbers.slice(0, 3).join(', ')}`
  }
  
  return {
    suggested_numbers: uniqueSuggested,
    probability_score: parseFloat(probabilityScore.toFixed(2)),
    pattern_detected: patternDetected,
    confidence
  }
}

// Salvar sugestão no banco
export async function saveSuggestion(suggestion: SuggestionResult, basedOnLastN: number) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado')
  }
  
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('roulette_suggestions')
    .insert([{
      suggested_numbers: suggestion.suggested_numbers,
      probability_score: suggestion.probability_score,
      pattern_detected: suggestion.pattern_detected,
      based_on_last_n_numbers: basedOnLastN
    }])
    .select()
  
  if (error) {
    console.error('Erro ao salvar sugestão:', error)
    throw error
  }
  
  return data
}

// Buscar últimas sugestões
export async function getLastSuggestions(limit: number = 10) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase não configurado')
  }
  
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('roulette_suggestions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) {
    console.error('Erro ao buscar sugestões:', error)
    throw error
  }
  
  return data
}
