"use client"

import { useState, useEffect, useRef } from "react"
import { TrendingUp, TrendingDown, Hash, AlertCircle, Trash2, Plus, Camera, Info, Upload, Loader2 } from "lucide-react"

type Pattern = {
  type: "crescente" | "decrescente" | "terminal"
  count: number
  nextExpected: number | string
  probability: number
  active: boolean
}

export default function RouletteAnalyzer() {
  const [numbers, setNumbers] = useState<number[]>([])
  const [inputValue, setInputValue] = useState("")
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [notifications, setNotifications] = useState<string[]>([])
  const [showHelp, setShowHelp] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [ocrResult, setOcrResult] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Detectar padrões
  useEffect(() => {
    if (numbers.length < 2) {
      setPatterns([])
      return
    }

    const detectedPatterns: Pattern[] = []
    const newNotifications: string[] = []

    // 1. Padrão Crescente Normal
    let crescenteCount = 1
    for (let i = numbers.length - 1; i > 0; i--) {
      if (numbers[i] === numbers[i - 1] + 1) {
        crescenteCount++
      } else {
        break
      }
    }

    if (crescenteCount >= 2) {
      const nextExpected = numbers[numbers.length - 1] + 1
      const probability = Math.max(10, 100 - crescenteCount * 15)
      
      detectedPatterns.push({
        type: "crescente",
        count: crescenteCount,
        nextExpected,
        probability,
        active: true
      })

      if (crescenteCount === 2) {
        newNotifications.push(`📈 Padrão crescente iniciado!`)
      } else if (crescenteCount >= 3) {
        newNotifications.push(`🔥 Padrão crescente forte: ${crescenteCount} números seguidos!`)
      }
    }

    // 2. Padrão Decrescente Normal
    let decrescenteCount = 1
    for (let i = numbers.length - 1; i > 0; i--) {
      if (numbers[i] === numbers[i - 1] - 1) {
        decrescenteCount++
      } else {
        break
      }
    }

    if (decrescenteCount >= 2) {
      const nextExpected = numbers[numbers.length - 1] - 1
      const probability = Math.max(10, 100 - decrescenteCount * 15)
      
      detectedPatterns.push({
        type: "decrescente",
        count: decrescenteCount,
        nextExpected,
        probability,
        active: true
      })

      if (decrescenteCount === 2) {
        newNotifications.push(`📉 Padrão decrescente iniciado!`)
      } else if (decrescenteCount >= 3) {
        newNotifications.push(`🔥 Padrão decrescente forte: ${decrescenteCount} números seguidos!`)
      }
    }

    // 3. Padrão de Terminais (MAIS IMPORTANTE)
    let terminalCount = 1
    const getTerminal = (n: number) => n % 10
    
    for (let i = numbers.length - 1; i > 0; i--) {
      const currentTerminal = getTerminal(numbers[i])
      const previousTerminal = getTerminal(numbers[i - 1])
      
      // Verifica se o terminal cresceu (incluindo 9 -> 0)
      const isSequential = 
        currentTerminal === previousTerminal + 1 ||
        (previousTerminal === 9 && currentTerminal === 0)
      
      if (isSequential) {
        terminalCount++
      } else {
        break
      }
    }

    if (terminalCount >= 2) {
      const lastTerminal = getTerminal(numbers[numbers.length - 1])
      const nextTerminal = (lastTerminal + 1) % 10
      const probability = Math.max(15, 100 - terminalCount * 12)
      
      detectedPatterns.push({
        type: "terminal",
        count: terminalCount,
        nextExpected: `Terminal ${nextTerminal}`,
        probability,
        active: true
      })

      if (terminalCount === 2) {
        newNotifications.push(`🔚 Padrão de terminais detectado!`)
      } else if (terminalCount >= 3) {
        newNotifications.push(`⭐ Padrão de terminais FORTE: ${terminalCount} números! Próximo terminal: ${nextTerminal}`)
      }
    }

    setPatterns(detectedPatterns)
    
    // Adiciona notificações apenas se houver mudanças
    if (newNotifications.length > 0) {
      setNotifications(prev => [...newNotifications, ...prev].slice(0, 5))
    }
  }, [numbers])

  const addNumber = () => {
    const num = parseInt(inputValue)
    if (!isNaN(num) && num >= 0 && num <= 36) {
      setNumbers(prev => [...prev, num])
      setInputValue("")
    }
  }

  const removeLastNumber = () => {
    setNumbers(prev => prev.slice(0, -1))
    setNotifications(prev => [...prev, "⚠️ Último número removido"].slice(0, 5))
  }

  const clearAll = () => {
    setNumbers([])
    setPatterns([])
    setNotifications([])
    setOcrResult("")
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      addNumber()
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsAnalyzing(true)
    setOcrResult("")

    try {
      // Converter imagem para base64
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64Image = reader.result as string

        console.log('📤 Enviando imagem para análise...')

        // Chamar API de análise de imagem (OpenAI Vision)
        const response = await fetch('/api/analyze-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image: base64Image,
            prompt: "Analise esta imagem de uma roleta e extraia APENAS os números que aparecem nos resultados/histórico. Liste os números na ordem em que aparecem (do mais antigo ao mais recente, da esquerda para direita ou de cima para baixo). Retorne apenas os números separados por vírgula, sem texto adicional. Exemplo: 12, 5, 23, 14, 8"
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          console.error('❌ Erro na resposta:', data)
          
          if (data.error === 'Chave da OpenAI não configurada') {
            setOcrResult("⚠️ Configure a chave OPENAI_API_KEY nas configurações do projeto para usar o OCR.")
          } else {
            setOcrResult(`❌ Erro ao analisar imagem: ${data.details || data.error || 'Erro desconhecido'}`)
          }
          setIsAnalyzing(false)
          return
        }

        const detectedNumbers = data.numbers || []

        console.log('✅ Números detectados:', detectedNumbers)

        if (detectedNumbers.length > 0) {
          setOcrResult(`✅ Detectados ${detectedNumbers.length} números: ${detectedNumbers.join(', ')}`)
          setNotifications(prev => [`🎯 OCR detectou ${detectedNumbers.length} números!`, ...prev].slice(0, 5))
          
          // Adicionar números automaticamente
          setNumbers(prev => [...prev, ...detectedNumbers])
        } else {
          setOcrResult("⚠️ Nenhum número detectado na imagem. Tente uma imagem mais clara dos resultados da roleta.")
        }

        setIsAnalyzing(false)
      }

      reader.onerror = () => {
        console.error('❌ Erro ao ler arquivo')
        setOcrResult("❌ Erro ao ler o arquivo. Tente novamente.")
        setIsAnalyzing(false)
      }

      reader.readAsDataURL(file)
    } catch (error) {
      console.error('❌ Erro ao processar imagem:', error)
      setOcrResult("❌ Erro ao analisar imagem. Tente novamente.")
      setIsAnalyzing(false)
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-3 tracking-tight">
            🎰 Analisador de Roleta
          </h1>
          <p className="text-lg sm:text-xl text-purple-200">
            Detecte padrões, tendências e comportamentos numéricos em tempo real
          </p>
        </div>

        {/* Botões de Captura de Tela - TOPO */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3 justify-center">
          {/* Botão OCR Principal */}
          <button
            onClick={triggerFileInput}
            disabled={isAnalyzing}
            className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                Analisando imagem...
              </>
            ) : (
              <>
                <Upload className="w-6 h-6" />
                📸 Analisar Imagem (OCR)
              </>
            )}
          </button>

          {/* Input oculto para upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Botão de Ajuda */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
          >
            <Info className="w-5 h-5" />
            Como usar?
          </button>
        </div>

        {/* Resultado OCR */}
        {ocrResult && (
          <div className={`mb-6 backdrop-blur-lg rounded-2xl p-6 border-2 shadow-2xl animate-fadeIn ${
            ocrResult.includes('❌') || ocrResult.includes('⚠️')
              ? 'bg-gradient-to-r from-red-500/20 to-orange-600/20 border-red-400/50'
              : 'bg-gradient-to-r from-green-500/20 to-emerald-600/20 border-green-400/50'
          }`}>
            <div className="flex items-start gap-3">
              <Camera className={`w-6 h-6 flex-shrink-0 mt-1 ${
                ocrResult.includes('❌') || ocrResult.includes('⚠️') ? 'text-red-400' : 'text-green-400'
              }`} />
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">Resultado da Análise OCR</h3>
                <p className="text-white/90">{ocrResult}</p>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Ajuda */}
        {showHelp && (
          <div className="mb-6 bg-gradient-to-r from-blue-500/20 to-cyan-600/20 backdrop-blur-lg rounded-2xl p-6 border-2 border-blue-400/50 shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Camera className="w-6 h-6 text-blue-400" />
                📸 Como usar o OCR Automático
              </h2>
              <button
                onClick={() => setShowHelp(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-white/90">
              <div className="bg-white/10 rounded-xl p-4">
                <h3 className="font-bold text-lg mb-2 text-cyan-300">🎯 Como funciona:</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li><strong>Clique no botão "Analisar Imagem (OCR)"</strong> acima</li>
                  <li><strong>Selecione uma foto/print</strong> da tela da roleta mostrando os números</li>
                  <li><strong>A IA analisa automaticamente</strong> e extrai os números da imagem</li>
                  <li><strong>Os números são adicionados</strong> automaticamente ao analisador</li>
                  <li><strong>Padrões são detectados</strong> instantaneamente!</li>
                </ol>
              </div>

              <div className="bg-white/10 rounded-xl p-4">
                <h3 className="font-bold text-lg mb-2 text-green-300">✅ O que a IA detecta:</h3>
                <ul className="space-y-1 text-sm">
                  <li>✅ Números visíveis na tela da roleta</li>
                  <li>✅ Histórico de resultados recentes</li>
                  <li>✅ Sequências de jogadas</li>
                  <li>✅ Números em tabelas e listas</li>
                  <li>✅ Extração automática e adição ao app</li>
                </ul>
              </div>

              <div className="bg-white/10 rounded-xl p-4">
                <h3 className="font-bold text-lg mb-2 text-yellow-300">📋 Dicas para melhores resultados:</h3>
                <ul className="space-y-1 text-sm">
                  <li>• Tire um print <strong>claro e legível</strong> da área dos números</li>
                  <li>• Certifique-se que os <strong>números estão visíveis</strong> e não cortados</li>
                  <li>• Prefira imagens com <strong>boa iluminação</strong> e <strong>contraste</strong></li>
                  <li>• Evite imagens borradas ou com reflexos</li>
                  <li>• Quanto mais números visíveis, melhor a análise!</li>
                </ul>
              </div>

              <div className="bg-gradient-to-r from-purple-500/20 to-pink-600/20 rounded-xl p-4 border border-purple-400/30">
                <h3 className="font-bold text-lg mb-2 text-purple-300">🚀 Exemplo de uso:</h3>
                <div className="text-sm space-y-2">
                  <p><strong>1.</strong> Tire um print da roleta mostrando: 12, 13, 14, 28</p>
                  <p><strong>2.</strong> Clique em "Analisar Imagem (OCR)"</p>
                  <p><strong>3.</strong> Selecione a imagem</p>
                  <p><strong>4.</strong> IA detecta: "✅ Detectados 4 números: 12, 13, 14, 28"</p>
                  <p><strong>5.</strong> Números são adicionados automaticamente!</p>
                  <p><strong>6.</strong> Padrão crescente é detectado (12→13→14)</p>
                </div>
              </div>

              <div className="text-center pt-2">
                <p className="text-lg font-bold text-cyan-300">
                  📸 Pronto para testar? Clique no botão azul acima e selecione uma imagem!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Input Section */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-6 border border-white/20 shadow-2xl">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="number"
              min="0"
              max="36"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite o número (0-36)"
              className="flex-1 px-6 py-4 text-2xl font-bold bg-white/20 border-2 border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-4 focus:ring-purple-500 focus:border-purple-400 transition-all"
            />
            <button
              onClick={addNumber}
              className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
            >
              <Plus className="w-6 h-6" />
              Adicionar
            </button>
            <button
              onClick={removeLastNumber}
              disabled={numbers.length === 0}
              className="px-6 py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Trash2 className="w-6 h-6" />
            </button>
            <button
              onClick={clearAll}
              disabled={numbers.length === 0}
              className="px-6 py-4 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              Limpar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Últimos Números */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-2xl h-full">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <Hash className="w-6 h-6 text-purple-400" />
                Últimos Números
              </h2>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {numbers.length === 0 ? (
                  <p className="text-white/60 text-center py-8">Nenhum número inserido ainda</p>
                ) : (
                  numbers.slice().reverse().map((num, idx) => (
                    <div
                      key={idx}
                      className={`px-4 py-3 rounded-xl font-bold text-2xl text-center transition-all duration-300 ${
                        idx === 0
                          ? "bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg scale-105"
                          : "bg-white/20 text-white"
                      }`}
                    >
                      {num}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Padrões Detectados */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-2xl mb-6">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-green-400" />
                Padrões Ativos
              </h2>
              
              {patterns.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-white/40 mx-auto mb-4" />
                  <p className="text-white/60 text-lg">Nenhum padrão detectado ainda</p>
                  <p className="text-white/40 text-sm mt-2">Insira pelo menos 2 números para começar a análise</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {patterns.map((pattern, idx) => (
                    <div
                      key={idx}
                      className={`p-6 rounded-xl border-2 transition-all duration-300 ${
                        pattern.type === "crescente"
                          ? "bg-gradient-to-r from-green-500/20 to-emerald-600/20 border-green-400"
                          : pattern.type === "decrescente"
                          ? "bg-gradient-to-r from-orange-500/20 to-red-600/20 border-orange-400"
                          : "bg-gradient-to-r from-purple-500/20 to-pink-600/20 border-purple-400"
                      } ${pattern.count >= 3 ? "shadow-2xl scale-105" : ""}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {pattern.type === "crescente" && <TrendingUp className="w-8 h-8 text-green-400" />}
                          {pattern.type === "decrescente" && <TrendingDown className="w-8 h-8 text-orange-400" />}
                          {pattern.type === "terminal" && <Hash className="w-8 h-8 text-purple-400" />}
                          <div>
                            <h3 className="text-xl font-bold text-white">
                              {pattern.type === "crescente" && "📈 Padrão Crescente"}
                              {pattern.type === "decrescente" && "📉 Padrão Decrescente"}
                              {pattern.type === "terminal" && "🔚 Padrão de Terminais"}
                            </h3>
                            <p className="text-white/70 text-sm">
                              {pattern.count} números seguidos
                            </p>
                          </div>
                        </div>
                        {pattern.count >= 3 && (
                          <span className="px-3 py-1 bg-yellow-500 text-yellow-900 font-bold text-xs rounded-full animate-pulse">
                            FORTE
                          </span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-white/10 rounded-lg p-3">
                          <p className="text-white/60 text-xs mb-1">Próximo Esperado</p>
                          <p className="text-white font-bold text-xl">{pattern.nextExpected}</p>
                        </div>
                        <div className="bg-white/10 rounded-lg p-3">
                          <p className="text-white/60 text-xs mb-1">Probabilidade</p>
                          <p className="text-white font-bold text-xl">{pattern.probability}%</p>
                        </div>
                      </div>

                      {pattern.type === "terminal" && (
                        <div className="mt-3 p-3 bg-purple-500/20 rounded-lg border border-purple-400/30">
                          <p className="text-purple-200 text-sm">
                            💡 Este padrão ignora a dezena e foca apenas no último dígito
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notificações */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-yellow-400" />
                Notificações Recentes
              </h2>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-white/60 text-center py-4">Nenhuma notificação ainda</p>
                ) : (
                  notifications.map((notif, idx) => (
                    <div
                      key={idx}
                      className="px-4 py-3 bg-white/20 rounded-lg text-white text-sm border border-white/10 animate-fadeIn"
                    >
                      {notif}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Estatísticas Rápidas */}
        {numbers.length > 0 && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 text-center">
              <p className="text-white/60 text-sm mb-1">Total de Números</p>
              <p className="text-white font-bold text-3xl">{numbers.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 text-center">
              <p className="text-white/60 text-sm mb-1">Último Número</p>
              <p className="text-white font-bold text-3xl">{numbers[numbers.length - 1]}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 text-center">
              <p className="text-white/60 text-sm mb-1">Padrões Ativos</p>
              <p className="text-white font-bold text-3xl">{patterns.length}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-4 border border-white/20 text-center">
              <p className="text-white/60 text-sm mb-1">Terminal Atual</p>
              <p className="text-white font-bold text-3xl">{numbers[numbers.length - 1] % 10}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
