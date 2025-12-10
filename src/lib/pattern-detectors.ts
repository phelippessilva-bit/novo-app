export interface DetectedPattern {
  name: string
  description: string
  probability: number
  suggestedNumbers?: number[]
}

export function detectAllPatterns(numbers: number[]): DetectedPattern[] {
  if (numbers.length < 3) return []

  const patterns: DetectedPattern[] = []

  // Padrão de repetição
  const lastThree = numbers.slice(-3)
  const hasRepetition = new Set(lastThree).size < lastThree.length
  if (hasRepetition) {
    patterns.push({
      name: "Repetição Detectada",
      description: "Números repetidos nos últimos 3 sorteios",
      probability: 70,
      suggestedNumbers: lastThree.filter((n, i) => lastThree.indexOf(n) === i)
    })
  }

  // Padrão de sequência
  const lastFive = numbers.slice(-5)
  const isSequence = lastFive.every((n, i) => i === 0 || Math.abs(n - lastFive[i - 1]) <= 3)
  if (isSequence) {
    patterns.push({
      name: "Sequência Próxima",
      description: "Números próximos em sequência",
      probability: 75,
      suggestedNumbers: lastFive
    })
  }

  // Padrão de cor
  const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
  const lastTenColors = numbers.slice(-10).map(n => 
    n === 0 ? 'green' : redNumbers.includes(n) ? 'red' : 'black'
  )
  const redCount = lastTenColors.filter(c => c === 'red').length
  const blackCount = lastTenColors.filter(c => c === 'black').length

  if (redCount >= 7) {
    patterns.push({
      name: "Tendência Vermelha",
      description: "Muitos números vermelhos recentes",
      probability: 65,
      suggestedNumbers: redNumbers.slice(0, 5)
    })
  } else if (blackCount >= 7) {
    const blackNumbers = [2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]
    patterns.push({
      name: "Tendência Preta",
      description: "Muitos números pretos recentes",
      probability: 65,
      suggestedNumbers: blackNumbers.slice(0, 5)
    })
  }

  return patterns
}

export function detectarNumerosPuxam(numbers: number[]): { [key: number]: number[] } {
  const puxadas: { [key: number]: { [key: number]: number } } = {}

  // Analisar sequências de números
  for (let i = 0; i < numbers.length - 1; i++) {
    const atual = numbers[i]
    const proximo = numbers[i + 1]

    if (!puxadas[atual]) {
      puxadas[atual] = {}
    }

    puxadas[atual][proximo] = (puxadas[atual][proximo] || 0) + 1
  }

  // Converter para array de números mais puxados
  const resultado: { [key: number]: number[] } = {}

  Object.keys(puxadas).forEach(numStr => {
    const num = parseInt(numStr)
    const puxadosOrdenados = Object.entries(puxadas[num])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([n]) => parseInt(n))

    if (puxadosOrdenados.length > 0) {
      resultado[num] = puxadosOrdenados
    }
  })

  return resultado
}
