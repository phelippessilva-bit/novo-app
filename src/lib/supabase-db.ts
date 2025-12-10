export interface RouletteHistoryEntry {
  id?: string
  number: number
  color: 'red' | 'black' | 'green'
  created_at?: string
}

export interface SuggestionResult {
  suggested_numbers: number[]
  probability_score: number
  confidence: 'Alta' | 'Média' | 'Baixa'
  pattern_detected: string
}

// Funções mock para funcionar sem Supabase configurado
export async function saveNumberToHistory(number: number, color: 'red' | 'black' | 'green'): Promise<void> {
  // Salvar em localStorage como fallback
  const history = JSON.parse(localStorage.getItem('roulette-history') || '[]')
  history.push({
    number,
    color,
    created_at: new Date().toISOString()
  })
  localStorage.setItem('roulette-history', JSON.stringify(history))
}

export async function getLastNumbers(limit: number = 50): Promise<RouletteHistoryEntry[]> {
  const history = JSON.parse(localStorage.getItem('roulette-history') || '[]')
  return history.slice(-limit)
}

export async function getAllHistory(): Promise<RouletteHistoryEntry[]> {
  const history = JSON.parse(localStorage.getItem('roulette-history') || '[]')
  return history
}

export async function clearHistory(): Promise<void> {
  localStorage.removeItem('roulette-history')
}

export function generateSuggestions(history: RouletteHistoryEntry[]): SuggestionResult {
  if (history.length < 10) {
    return {
      suggested_numbers: [],
      probability_score: 0,
      confidence: 'Baixa',
      pattern_detected: 'Histórico insuficiente'
    }
  }

  // Análise de frequência
  const frequency: { [key: number]: number } = {}
  history.forEach(entry => {
    frequency[entry.number] = (frequency[entry.number] || 0) + 1
  })

  // Números menos frequentes (teoria da compensação)
  const sortedByFrequency = Object.entries(frequency)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 5)
    .map(([num]) => parseInt(num))

  // Calcular probabilidade baseada no histórico
  const totalNumbers = history.length
  const avgFrequency = totalNumbers / 37
  const probabilityScore = Math.min(
    Math.round((sortedByFrequency.length / 5) * 100),
    85
  )

  const confidence = probabilityScore >= 70 ? 'Alta' : 
                    probabilityScore >= 50 ? 'Média' : 'Baixa'

  return {
    suggested_numbers: sortedByFrequency,
    probability_score: probabilityScore,
    confidence,
    pattern_detected: `Análise de ${totalNumbers} números - Números menos frequentes`
  }
}

export async function saveSuggestion(suggestion: SuggestionResult, historySize: number): Promise<void> {
  // Salvar sugestão em localStorage
  const suggestions = JSON.parse(localStorage.getItem('roulette-suggestions') || '[]')
  suggestions.push({
    ...suggestion,
    historySize,
    created_at: new Date().toISOString()
  })
  localStorage.setItem('roulette-suggestions', JSON.stringify(suggestions.slice(-10)))
}
