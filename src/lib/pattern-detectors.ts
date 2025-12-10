import { numerosPuxam, getVizinhos, getTerminal, getNumerosComTerminal, mesmoTrio, getNumeroCentralTrio } from './roulette-patterns'

export interface DetectedPattern {
  type: string
  name: string
  description: string
  probability: number
  suggestedNumbers?: number[]
}

// Função auxiliar para expandir números com vizinhos
function expandirComVizinhos(numeros: number[], quantidadeVizinhos: number): number[] {
  const resultado = new Set<number>()
  
  numeros.forEach(num => {
    resultado.add(num)
    if (quantidadeVizinhos > 0) {
      const vizinhos = getVizinhos(num, quantidadeVizinhos)
      vizinhos.forEach(v => resultado.add(v))
    }
  })
  
  return Array.from(resultado).sort((a, b) => a - b)
}

// Função auxiliar para resolver terminais
function resolverTerminal(alvo: number | string): number[] {
  if (typeof alvo === 'number') {
    return [alvo]
  }
  
  // Se for string tipo "terminal_X"
  if (typeof alvo === 'string' && alvo.startsWith('terminal_')) {
    const terminal = parseInt(alvo.split('_')[1])
    return getNumerosComTerminal(terminal)
  }
  
  return []
}

// NOVA FUNÇÃO: Retorna mapa de números que cada número puxa
export function detectarNumerosPuxam(numbers: number[]): Record<number, number[]> {
  const resultado: Record<number, number[]> = {}
  
  // Para cada número de 0 a 36, calcular o que ele puxa
  for (let num = 0; num <= 36; num++) {
    const puxados = numerosPuxam[num]
    
    if (!puxados || puxados.length === 0) {
      resultado[num] = []
      continue
    }
    
    const numerosPuxadosSet = new Set<number>()
    
    puxados.forEach(item => {
      const numerosResolvidos = resolverTerminal(item.alvo)
      
      numerosResolvidos.forEach(numResolvido => {
        // Adicionar apenas o número principal (SEM vizinhos)
        numerosPuxadosSet.add(numResolvido)
      })
    })
    
    resultado[num] = Array.from(numerosPuxadosSet).sort((a, b) => a - b)
  }
  
  return resultado
}

// 1. AUSÊNCIA DO TERMINAL CENTRAL (ATC)
function detectarAusenciaTerminalCentral(numbers: number[]): DetectedPattern | null {
  if (numbers.length < 2) return null
  
  const n1 = numbers[numbers.length - 2]
  const n2 = numbers[numbers.length - 1]
  
  if (mesmoTrio(n1, n2)) {
    const numeroCentral = getNumeroCentralTrio(n1, n2)
    if (numeroCentral !== null && !numbers.includes(numeroCentral)) {
      const aposta = expandirComVizinhos([numeroCentral], 1)
      
      return {
        type: 'ausencia_terminal_central',
        name: 'ATC',
        description: `Trio ${Math.floor(n1/3)}: saiu ${n1} e ${n2}, falta ${numeroCentral}`,
        probability: 78,
        suggestedNumbers: aposta
      }
    }
  }
  
  return null
}

// 2. NÚMERO REPETIDO NA MESA
function detectarNumeroRepetido(numbers: number[]): DetectedPattern | null {
  if (numbers.length < 3) return null
  
  const ultimo = numbers[numbers.length - 1]
  const penultimo = numbers[numbers.length - 2]
  const antepenultimo = numbers[numbers.length - 3]
  
  // Padrão A-B-A (número repetido)
  if (ultimo === antepenultimo && ultimo !== penultimo) {
    const terminal = getTerminal(penultimo)
    const numerosTerminal = getNumerosComTerminal(terminal)
    const aposta = expandirComVizinhos(numerosTerminal, 1)
    
    return {
      type: 'numero_repetido',
      name: 'Número Repetido',
      description: `Padrão ${antepenultimo}-${penultimo}-${ultimo}: apostar terminal ${terminal}`,
      probability: 72,
      suggestedNumbers: aposta
    }
  }
  
  return null
}

// 3. PADRÃO DE ALTERNÂNCIA (A-B-B-A)
function detectarAlternanciaABBA(numbers: number[]): DetectedPattern | null {
  if (numbers.length < 3) return null
  
  const n1 = numbers[numbers.length - 3]
  const n2 = numbers[numbers.length - 2]
  const n3 = numbers[numbers.length - 1]
  
  // Padrão A-B-B detectado, espera A
  if (n1 !== n2 && n2 === n3) {
    const terminal = getTerminal(n1)
    const numerosTerminal = getNumerosComTerminal(terminal)
    const aposta = expandirComVizinhos(numerosTerminal, 1)
    
    return {
      type: 'alternancia_abba',
      name: 'Alternância ABBA',
      description: `Padrão ${n1}-${n2}-${n3}: espera terminal ${terminal}`,
      probability: 68,
      suggestedNumbers: aposta
    }
  }
  
  return null
}

// 4. ALTERNÂNCIA TIPO 2 (A-B-A-B)
function detectarAlternanciaABAB(numbers: number[]): DetectedPattern | null {
  if (numbers.length < 3) return null
  
  const n1 = numbers[numbers.length - 3]
  const n2 = numbers[numbers.length - 2]
  const n3 = numbers[numbers.length - 1]
  
  // Padrão A-B-A detectado, espera B
  if (n1 === n3 && n1 !== n2) {
    const terminal = getTerminal(n2)
    const numerosTerminal = getNumerosComTerminal(terminal)
    const aposta = expandirComVizinhos(numerosTerminal, 1)
    
    return {
      type: 'alternancia_abab',
      name: 'Alternância ABAB',
      description: `Padrão ${n1}-${n2}-${n3}: espera terminal ${terminal}`,
      probability: 70,
      suggestedNumbers: aposta
    }
  }
  
  return null
}

// 5. FORMA CRESCENTE (1 em 1)
function detectarCrescente1em1(numbers: number[]): DetectedPattern | null {
  if (numbers.length < 2) return null
  
  const n1 = numbers[numbers.length - 2]
  const n2 = numbers[numbers.length - 1]
  
  // Verifica se está crescendo de 1 em 1
  if (n2 === n1 + 1 && n2 <= 36) {
    const proximo = n2 + 1
    if (proximo <= 36) {
      const terminal = getTerminal(proximo)
      const numerosTerminal = getNumerosComTerminal(terminal)
      const aposta = expandirComVizinhos(numerosTerminal, 1)
      
      return {
        type: 'crescente_1em1',
        name: 'Crescente 1 em 1',
        description: `${n1}→${n2}: próximo terminal ${terminal}`,
        probability: 65,
        suggestedNumbers: aposta
      }
    }
  }
  
  return null
}

// 6. FORMA CRESCENTE (ultrapassando 9 → 10)
function detectarCrescenteUltrapassando(numbers: number[]): DetectedPattern | null {
  if (numbers.length < 2) return null
  
  const n1 = numbers[numbers.length - 2]
  const n2 = numbers[numbers.length - 1]
  
  // Detecta padrão 8→9 (próximo é 10, terminal 0)
  if (n2 === n1 + 1 && getTerminal(n2) === 9) {
    const numerosTerminal = getNumerosComTerminal(0)
    const aposta = expandirComVizinhos(numerosTerminal, 1)
    
    return {
      type: 'crescente_ultrapassando',
      name: 'Crescente Ultrapassando',
      description: `${n1}→${n2}: próximo é terminal 0`,
      probability: 67,
      suggestedNumbers: aposta
    }
  }
  
  return null
}

// 7. FORMA DECRESCENTE (1 em 1)
function detectarDecrescente1em1(numbers: number[]): DetectedPattern | null {
  if (numbers.length < 2) return null
  
  const n1 = numbers[numbers.length - 2]
  const n2 = numbers[numbers.length - 1]
  
  // Verifica se está decrescendo de 1 em 1
  if (n2 === n1 - 1 && n2 >= 0) {
    const proximo = n2 - 1
    if (proximo >= 0) {
      const terminal = getTerminal(proximo)
      const numerosTerminal = getNumerosComTerminal(terminal)
      const aposta = expandirComVizinhos(numerosTerminal, 1)
      
      return {
        type: 'decrescente_1em1',
        name: 'Decrescente 1 em 1',
        description: `${n1}→${n2}: próximo terminal ${terminal}`,
        probability: 65,
        suggestedNumbers: aposta
      }
    }
  }
  
  return null
}

// 8. CRESCENTE OU DECRESCENTE DE 2 EM 2
function detectarSalto2em2(numbers: number[]): DetectedPattern | null {
  if (numbers.length < 2) return null
  
  const n1 = numbers[numbers.length - 2]
  const n2 = numbers[numbers.length - 1]
  
  // Crescente de 2 em 2
  if (n2 === n1 + 2 && n2 <= 36) {
    const proximo = n2 + 2
    if (proximo <= 36) {
      const terminal = getTerminal(proximo)
      const numerosTerminal = getNumerosComTerminal(terminal)
      const aposta = expandirComVizinhos(numerosTerminal, 1)
      
      return {
        type: 'crescente_2em2',
        name: 'Crescente 2 em 2',
        description: `${n1}→${n2}: próximo terminal ${terminal}`,
        probability: 63,
        suggestedNumbers: aposta
      }
    }
  }
  
  // Decrescente de 2 em 2
  if (n2 === n1 - 2 && n2 >= 0) {
    const proximo = n2 - 2
    if (proximo >= 0) {
      const terminal = getTerminal(proximo)
      const numerosTerminal = getNumerosComTerminal(terminal)
      const aposta = expandirComVizinhos(numerosTerminal, 1)
      
      return {
        type: 'decrescente_2em2',
        name: 'Decrescente 2 em 2',
        description: `${n1}→${n2}: próximo terminal ${terminal}`,
        probability: 63,
        suggestedNumbers: aposta
      }
    }
  }
  
  return null
}

// Função principal que detecta todos os padrões
export function detectAllPatterns(numbers: number[]): DetectedPattern[] {
  const patterns: DetectedPattern[] = []
  
  // Detectar todos os padrões
  const atc = detectarAusenciaTerminalCentral(numbers)
  if (atc) patterns.push(atc)
  
  const repetido = detectarNumeroRepetido(numbers)
  if (repetido) patterns.push(repetido)
  
  const abba = detectarAlternanciaABBA(numbers)
  if (abba) patterns.push(abba)
  
  const abab = detectarAlternanciaABAB(numbers)
  if (abab) patterns.push(abab)
  
  const crescente1 = detectarCrescente1em1(numbers)
  if (crescente1) patterns.push(crescente1)
  
  const crescenteUltra = detectarCrescenteUltrapassando(numbers)
  if (crescenteUltra) patterns.push(crescenteUltra)
  
  const decrescente1 = detectarDecrescente1em1(numbers)
  if (decrescente1) patterns.push(decrescente1)
  
  const salto2 = detectarSalto2em2(numbers)
  if (salto2) patterns.push(salto2)
  
  // Ordenar por probabilidade (maior primeiro)
  return patterns.sort((a, b) => b.probability - a.probability)
}
