"use client"

import { useState, useEffect, useRef } from "react"
import { TrendingUp, TrendingDown, Hash, AlertCircle, Trash2, Plus, Camera, Info, Upload, Loader2, Target, Zap, Database, TrendingUpIcon, Ghost, DollarSign, CheckCircle, XCircle } from "lucide-react"
import { detectAllPatterns, DetectedPattern, detectarNumerosPuxam } from "@/lib/pattern-detectors"
import { 
  saveNumberToHistory, 
  getLastNumbers, 
  getAllHistory, 
  clearHistory,
  generateSuggestions,
  saveSuggestion,
  type SuggestionResult,
  type RouletteHistoryEntry
} from "@/lib/supabase-db"

export default function RouletteAnalyzer() {
  const [numbers, setNumbers] = useState<number[]>([])
  const [inputValue, setInputValue] = useState("")
  const [patterns, setPatterns] = useState<DetectedPattern[]>([])
  const [notifications, setNotifications] = useState<string[]>([])
  const [showHelp, setShowHelp] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [ocrResult, setOcrResult] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Novos estados para banco de dados
  const [dbConnected, setDbConnected] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [suggestions, setSuggestions] = useState<SuggestionResult | null>(null)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Estados para gerenciamento de metas
  const [saldoInicial, setSaldoInicial] = useState<number>(0)
  const [saldoAtual, setSaldoAtual] = useState<number>(0)
  const [stopGreen, setStopGreen] = useState<number>(0)
  const [stopRed, setStopRed] = useState<number>(0)
  const [valorAposta, setValorAposta] = useState<number>(0)
  const [metaAtingida, setMetaAtingida] = useState<"green" | "red" | null>(null)
  const [showMetasConfig, setShowMetasConfig] = useState(false)
  const [metasConfiguradas, setMetasConfiguradas] = useState(false)

  // Carregar histórico do banco ao iniciar
  useEffect(() => {
    loadHistoryFromDB()
    // Carregar metas do localStorage
    const savedMetas = localStorage.getItem('fantasma-metas')
    if (savedMetas) {
      const metas = JSON.parse(savedMetas)
      setSaldoInicial(metas.saldoInicial || 0)
      setSaldoAtual(metas.saldoAtual || 0)
      setStopGreen(metas.stopGreen || 0)
      setStopRed(metas.stopRed || 0)
      setValorAposta(metas.valorAposta || 0)
      setMetasConfiguradas(metas.metasConfiguradas || false)
    }
  }, [])

  // Salvar metas no localStorage
  useEffect(() => {
    if (metasConfiguradas) {
      localStorage.setItem('fantasma-metas', JSON.stringify({
        saldoInicial,
        saldoAtual,
        stopGreen,
        stopRed,
        valorAposta,
        metasConfiguradas
      }))
    }
  }, [saldoInicial, saldoAtual, stopGreen, stopRed, valorAposta, metasConfiguradas])

  // Verificar se meta foi atingida
  useEffect(() => {
    if (!metasConfiguradas) return

    const lucro = saldoAtual - saldoInicial

    // Verificar Stop Green (meta de ganho)
    if (stopGreen > 0 && lucro >= stopGreen) {
      setMetaAtingida("green")
      setNotifications(prev => [
        `🎉 STOP GREEN ATINGIDO! Lucro de R$ ${lucro.toFixed(2)}. Hora de parar!`,
        ...prev
      ].slice(0, 8))
    }
    // Verificar Stop Red (meta de perda)
    else if (stopRed > 0 && lucro <= -stopRed) {
      setMetaAtingida("red")
      setNotifications(prev => [
        `🛑 STOP RED ATINGIDO! Perda de R$ ${Math.abs(lucro).toFixed(2)}. Hora de parar!`,
        ...prev
      ].slice(0, 8))
    }
    else {
      setMetaAtingida(null)
    }
  }, [saldoAtual, saldoInicial, stopGreen, stopRed, metasConfiguradas])

  const configurarMetas = () => {
    if (saldoInicial <= 0 || stopGreen <= 0 || stopRed <= 0 || valorAposta <= 0) {
      alert("Por favor, preencha todos os campos com valores válidos!")
      return
    }

    setSaldoAtual(saldoInicial)
    setMetasConfiguradas(true)
    setShowMetasConfig(false)
    setMetaAtingida(null)
    setNotifications(prev => [
      `✅ Metas configuradas! Stop Green: R$ ${stopGreen} | Stop Red: R$ ${stopRed}`,
      ...prev
    ].slice(0, 8))
  }

  const resetarMetas = () => {
    setSaldoInicial(0)
    setSaldoAtual(0)
    setStopGreen(0)
    setStopRed(0)
    setValorAposta(0)
    setMetasConfiguradas(false)
    setMetaAtingida(null)
    setShowMetasConfig(false)
    localStorage.removeItem('fantasma-metas')
    setNotifications(prev => [
      `🔄 Metas resetadas!`,
      ...prev
    ].slice(0, 8))
  }

  const registrarResultado = (ganhou: boolean) => {
    if (!metasConfiguradas) {
      alert("Configure suas metas primeiro!")
      return
    }

    if (metaAtingida) {
      alert(`Meta ${metaAtingida === 'green' ? 'de ganho' : 'de perda'} já foi atingida! Resetar para continuar.`)
      return
    }

    const novoSaldo = ganhou 
      ? saldoAtual + (valorAposta * 35) // Pagamento 35:1 na roleta
      : saldoAtual - valorAposta

    setSaldoAtual(novoSaldo)

    const lucro = novoSaldo - saldoInicial
    const emoji = ganhou ? "🎉" : "😔"
    const texto = ganhou 
      ? `Ganhou R$ ${(valorAposta * 35).toFixed(2)}!` 
      : `Perdeu R$ ${valorAposta.toFixed(2)}`

    setNotifications(prev => [
      `${emoji} ${texto} | Lucro atual: R$ ${lucro.toFixed(2)}`,
      ...prev
    ].slice(0, 8))
  }

  // Carregar histórico do banco de dados
  const loadHistoryFromDB = async () => {
    try {
      setIsSyncing(true)
      const history = await getAllHistory()
      
      if (history && history.length > 0) {
        const numbersFromDB = history.reverse().map(h => h.number)
        setNumbers(numbersFromDB)
        setDbConnected(true)
        
        // Gerar sugestões automaticamente
        const newSuggestions = generateSuggestions(history)
        setSuggestions(newSuggestions)
      } else {
        setDbConnected(false) // Sem histórico = não conectado ou não configurado
      }
    } catch (error) {
      console.error('Erro ao carregar histórico:', error)
      setDbConnected(false)
    } finally {
      setIsSyncing(false)
    }
  }

  // Detectar padrões
  useEffect(() => {
    if (numbers.length < 1) {
      setPatterns([])
      return
    }

    const detectedPatterns = detectAllPatterns(numbers)
    setPatterns(detectedPatterns)

    // Gerar notificações para novos padrões
    if (detectedPatterns.length > 0 && numbers.length > 1) {
      const newNotifications: string[] = []
      
      detectedPatterns.forEach(pattern => {
        if (pattern.probability >= 75) {
          newNotifications.push(`🔥 ${pattern.description} detectado! (${pattern.probability}%)`)
        } else if (pattern.probability >= 65) {
          newNotifications.push(`⚡ ${pattern.description} ativo (${pattern.probability}%)`)
        }
      })

      if (newNotifications.length > 0) {
        setNotifications(prev => [...newNotifications, ...prev].slice(0, 8))
      }
    }
  }, [numbers])

  // Atualizar sugestões quando números mudarem
  useEffect(() => {
    if (numbers.length >= 10 && dbConnected) {
      updateSuggestions()
    }
  }, [numbers, dbConnected])

  const updateSuggestions = async () => {
    try {
      const history = await getAllHistory()
      if (history && history.length >= 10) {
        const newSuggestions = generateSuggestions(history)
        setSuggestions(newSuggestions)
        
        // Salvar sugestão no banco
        try {
          await saveSuggestion(newSuggestions, history.length)
        } catch (error) {
          console.log('Erro ao salvar sugestão (não crítico):', error)
        }
      }
    } catch (error) {
      console.error('Erro ao atualizar sugestões:', error)
    }
  }

  const addNumber = async () => {
    const num = parseInt(inputValue)
    if (!isNaN(num) && num >= 0 && num <= 36) {
      setNumbers(prev => [...prev, num])
      setInputValue("")
      
      // Salvar no banco de dados
      if (dbConnected) {
        try {
          const color = num === 0 ? 'green' : 
                       [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num) ? 'red' : 'black'
          await saveNumberToHistory(num, color)
        } catch (error) {
          console.error('Erro ao salvar no banco:', error)
        }
      }
    }
  }

  const clearNumbers = async () => {
    setNumbers([])
    setPatterns([])
    setNotifications([])
    setSuggestions(null)
    
    // Limpar banco de dados
    if (dbConnected) {
      try {
        await clearHistory()
      } catch (error) {
        console.error('Erro ao limpar banco:', error)
      }
    }
  }

  const getNumberColor = (num: number) => {
    if (num === 0) return "bg-green-500"
    const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]
    return redNumbers.includes(num) ? "bg-red-500" : "bg-gray-900"
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsAnalyzing(true)
    setOcrResult("")

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success && data.numbers) {
        setOcrResult(`Números detectados: ${data.numbers.join(', ')}`)
        
        // Adicionar números detectados
        const validNumbers = data.numbers.filter((n: number) => n >= 0 && n <= 36)
        if (validNumbers.length > 0) {
          setNumbers(prev => [...prev, ...validNumbers])
          
          // Salvar no banco de dados
          if (dbConnected) {
            for (const num of validNumbers) {
              try {
                const color = num === 0 ? 'green' : 
                             [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num) ? 'red' : 'black'
                await saveNumberToHistory(num, color)
              } catch (error) {
                console.error('Erro ao salvar número do OCR:', error)
              }
            }
          }
        }
      } else {
        setOcrResult(data.error || "Erro ao processar imagem")
      }
    } catch (error) {
      console.error('Erro no OCR:', error)
      setOcrResult("Erro ao processar imagem")
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Calcular estatísticas dos números
  const getNumberStats = () => {
    const frequency: { [key: number]: number } = {}
    numbers.forEach(num => {
      frequency[num] = (frequency[num] || 0) + 1
    })

    const sortedByFrequency = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    return sortedByFrequency
  }

  const topNumbers = getNumberStats()

  // Detectar números que "puxam" outros
  const numerosPuxam = detectarNumerosPuxam(numbers)
  const ultimoNumero = numbers[numbers.length - 1]
  const penultimoNumero = numbers[numbers.length - 2]
  
  const numerosPuxadosUltimo = ultimoNumero !== undefined ? numerosPuxam[ultimoNumero] : null
  const numerosPuxadosPenultimo = penultimoNumero !== undefined ? numerosPuxam[penultimoNumero] : null

  const lucroAtual = saldoAtual - saldoInicial
  const progressoGreen = stopGreen > 0 ? Math.min((lucroAtual / stopGreen) * 100, 100) : 0
  const progressoRed = stopRed > 0 ? Math.min((Math.abs(lucroAtual) / stopRed) * 100, 100) : 0

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <Ghost className="w-12 h-12 text-white animate-pulse" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Fantasma.IA
            </h1>
          </div>
          <p className="text-white/60 text-sm md:text-base">
            Análise avançada de padrões com IA e probabilidade em tempo real
          </p>
          
          {/* Status do Banco de Dados */}
          <div className="flex items-center justify-center gap-2 mt-2">
            <Database className={`w-4 h-4 ${dbConnected ? 'text-green-400' : 'text-red-400'}`} />
            <span className={`text-xs ${dbConnected ? 'text-green-400' : 'text-red-400'}`}>
              {isSyncing ? 'Sincronizando...' : dbConnected ? 'Banco conectado' : 'Banco desconectado'}
            </span>
          </div>
        </div>

        {/* Gerenciamento de Metas */}
        <div className={`bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-lg rounded-2xl p-6 border-2 shadow-2xl ${
          metaAtingida === 'green' ? 'border-green-500 animate-pulse' :
          metaAtingida === 'red' ? 'border-red-500 animate-pulse' :
          'border-blue-500/50'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <DollarSign className="w-6 h-6 text-purple-400" />
              <h2 className="text-lg font-bold text-blue-400">Gerenciamento de Metas</h2>
            </div>
            <div className="flex gap-2">
              {!metasConfiguradas ? (
                <button
                  onClick={() => setShowMetasConfig(!showMetasConfig)}
                  className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg font-semibold transition-all text-sm"
                >
                  Configurar Metas
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setShowMetasConfig(!showMetasConfig)}
                    className="bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-all text-xs"
                  >
                    {showMetasConfig ? 'Ocultar' : 'Editar'}
                  </button>
                  <button
                    onClick={resetarMetas}
                    className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 px-3 py-2 rounded-lg transition-all text-xs"
                  >
                    Resetar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Configuração de Metas */}
          {showMetasConfig && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 mb-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Saldo Inicial (R$)</label>
                  <input
                    type="number"
                    value={saldoInicial || ''}
                    onChange={(e) => setSaldoInicial(parseFloat(e.target.value) || 0)}
                    placeholder="Ex: 1000"
                    className="w-full bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60 mb-1 block">Valor por Aposta (R$)</label>
                  <input
                    type="number"
                    value={valorAposta || ''}
                    onChange={(e) => setValorAposta(parseFloat(e.target.value) || 0)}
                    placeholder="Ex: 10"
                    className="w-full bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60 mb-1 block">Stop Green - Meta de Ganho (R$)</label>
                  <input
                    type="number"
                    value={stopGreen || ''}
                    onChange={(e) => setStopGreen(parseFloat(e.target.value) || 0)}
                    placeholder="Ex: 500"
                    className="w-full bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/60 mb-1 block">Stop Red - Meta de Perda (R$)</label>
                  <input
                    type="number"
                    value={stopRed || ''}
                    onChange={(e) => setStopRed(parseFloat(e.target.value) || 0)}
                    placeholder="Ex: 300"
                    className="w-full bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <button
                onClick={configurarMetas}
                className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105"
              >
                Salvar Configurações
              </button>
            </div>
          )}

          {/* Dashboard de Metas */}
          {metasConfiguradas && (
            <div className="space-y-4">
              {/* Alerta de Meta Atingida */}
              {metaAtingida && (
                <div className={`p-4 rounded-xl border-2 ${
                  metaAtingida === 'green' 
                    ? 'bg-green-500/20 border-green-500' 
                    : 'bg-red-500/20 border-red-500'
                } animate-pulse`}>
                  <div className="flex items-center gap-3">
                    {metaAtingida === 'green' ? (
                      <CheckCircle className="w-8 h-8 text-green-400" />
                    ) : (
                      <XCircle className="w-8 h-8 text-red-400" />
                    )}
                    <div>
                      <p className="font-bold text-lg">
                        {metaAtingida === 'green' ? '🎉 STOP GREEN ATINGIDO!' : '🛑 STOP RED ATINGIDO!'}
                      </p>
                      <p className="text-sm text-white/80">
                        {metaAtingida === 'green' 
                          ? 'Parabéns! Você atingiu sua meta de ganho. Hora de parar e garantir o lucro!'
                          : 'Você atingiu sua meta de perda. Pare agora para evitar perdas maiores!'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Saldo e Lucro */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-xs text-white/60 mb-1">Saldo Inicial</p>
                  <p className="text-2xl font-bold text-white">R$ {saldoInicial.toFixed(2)}</p>
                </div>

                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-xs text-white/60 mb-1">Saldo Atual</p>
                  <p className="text-2xl font-bold text-white">R$ {saldoAtual.toFixed(2)}</p>
                </div>

                <div className={`rounded-xl p-4 border-2 ${
                  lucroAtual > 0 ? 'bg-green-500/10 border-green-500/50' :
                  lucroAtual < 0 ? 'bg-red-500/10 border-red-500/50' :
                  'bg-white/5 border-white/10'
                }`}>
                  <p className="text-xs text-white/60 mb-1">Lucro/Prejuízo</p>
                  <p className={`text-2xl font-bold ${
                    lucroAtual > 0 ? 'text-green-400' :
                    lucroAtual < 0 ? 'text-red-400' :
                    'text-white'
                  }`}>
                    {lucroAtual >= 0 ? '+' : ''}R$ {lucroAtual.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Progresso das Metas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Stop Green */}
                <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-green-400">Stop Green (Meta de Ganho)</p>
                    <p className="text-xs text-green-400">R$ {stopGreen.toFixed(2)}</p>
                  </div>
                  <div className="bg-white/10 rounded-full h-3 overflow-hidden mb-2">
                    <div 
                      className="bg-gradient-to-r from-green-400 to-green-600 h-full transition-all duration-500"
                      style={{ width: `${lucroAtual > 0 ? progressoGreen : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/60">
                    Faltam R$ {Math.max(0, stopGreen - lucroAtual).toFixed(2)} para atingir
                  </p>
                </div>

                {/* Stop Red */}
                <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-red-400">Stop Red (Meta de Perda)</p>
                    <p className="text-xs text-red-400">R$ {stopRed.toFixed(2)}</p>
                  </div>
                  <div className="bg-white/10 rounded-full h-3 overflow-hidden mb-2">
                    <div 
                      className="bg-gradient-to-r from-red-400 to-red-600 h-full transition-all duration-500"
                      style={{ width: `${lucroAtual < 0 ? progressoRed : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-white/60">
                    Faltam R$ {Math.max(0, stopRed - Math.abs(lucroAtual)).toFixed(2)} para atingir
                  </p>
                </div>
              </div>

              {/* Botões de Registro */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => registrarResultado(true)}
                  disabled={!!metaAtingida}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-green-500/30 disabled:cursor-not-allowed px-6 py-4 rounded-xl font-bold transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Ganhou (35:1)
                </button>

                <button
                  onClick={() => registrarResultado(false)}
                  disabled={!!metaAtingida}
                  className="bg-red-500 hover:bg-red-600 disabled:bg-red-500/30 disabled:cursor-not-allowed px-6 py-4 rounded-xl font-bold transition-all transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  Perdeu
                </button>
              </div>

              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <p className="text-xs text-white/60">
                  💡 <strong>Dica:</strong> Registre cada resultado para acompanhar seu progresso. 
                  Quando atingir o Stop Green, você alcançou sua meta de ganho. 
                  Se atingir o Stop Red, é hora de parar para evitar perdas maiores.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Input Section */}
        <div className="bg-green-500/10 backdrop-blur-lg rounded-2xl p-6 border border-green-500/30 shadow-2xl">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex gap-2">
              <input
                type="number"
                min="0"
                max="36"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addNumber()}
                placeholder="Digite um número (0-36)"
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
              />
              <button
                onClick={addNumber}
                className="bg-white hover:bg-white/90 text-black px-6 py-3 rounded-xl font-semibold transition-all transform hover:scale-105 shadow-lg flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Adicionar
              </button>
            </div>

            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAnalyzing}
                className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Camera className="w-5 h-5" />
                    OCR
                  </>
                )}
              </button>

              <button
                onClick={clearNumbers}
                className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 px-4 py-3 rounded-xl font-semibold transition-all flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Limpar
              </button>

              <button
                onClick={() => setShowHelp(!showHelp)}
                className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-3 rounded-xl transition-all"
              >
                <Info className="w-5 h-5" />
              </button>
            </div>
          </div>

          {ocrResult && (
            <div className="mt-4 p-3 bg-white/10 border border-white/30 rounded-lg text-sm">
              {ocrResult}
            </div>
          )}

          {showHelp && (
            <div className="mt-4 p-4 bg-white/10 border border-white/30 rounded-lg text-sm space-y-2">
              <p className="font-semibold text-white">💡 Como usar:</p>
              <ul className="list-disc list-inside space-y-1 text-white/70">
                <li>Configure suas metas de ganho (Stop Green) e perda (Stop Red)</li>
                <li>Digite números de 0 a 36 que saíram na roleta</li>
                <li>Use a câmera/OCR para detectar números automaticamente</li>
                <li>Registre seus resultados (ganhou/perdeu) para acompanhar o saldo</li>
                <li>Acompanhe padrões em tempo real</li>
                <li>Veja sugestões baseadas em probabilidade e histórico</li>
                <li>Pare quando atingir suas metas!</li>
              </ul>
            </div>
          )}
        </div>

        {/* Sugestões de Jogadas */}
        {suggestions && suggestions.suggested_numbers.length > 0 && (
          <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Zap className="w-6 h-6 text-yellow-400" />
                <h2 className="text-2xl font-bold text-yellow-400">Sugestões Inteligentes</h2>
              </div>
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-all"
              >
                {showSuggestions ? 'Ocultar' : 'Mostrar'} Detalhes
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Números Sugeridos */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <p className="text-white/60 text-sm mb-3">Números Recomendados:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.suggested_numbers.map((num, idx) => (
                    <div
                      key={idx}
                      className={`${getNumberColor(num)} px-4 py-2 rounded-lg font-bold text-lg shadow-lg transform hover:scale-110 transition-all cursor-pointer`}
                    >
                      {num}
                    </div>
                  ))}
                </div>
              </div>

              {/* Estatísticas */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-3">
                <div>
                  <p className="text-white/60 text-xs">Probabilidade:</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-yellow-400 to-orange-400 h-full transition-all duration-500"
                        style={{ width: `${suggestions.probability_score}%` }}
                      />
                    </div>
                    <span className="text-yellow-400 font-bold text-sm">{suggestions.probability_score}%</span>
                  </div>
                </div>

                <div>
                  <p className="text-white/60 text-xs">Confiança:</p>
                  <p className={`font-bold text-sm ${
                    suggestions.confidence === 'Alta' ? 'text-green-400' :
                    suggestions.confidence === 'Média' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {suggestions.confidence}
                  </p>
                </div>

                {showSuggestions && (
                  <div>
                    <p className="text-white/60 text-xs">Padrão Detectado:</p>
                    <p className="text-white text-xs">{suggestions.pattern_detected}</p>
                  </div>
                )}
              </div>
            </div>

            {showSuggestions && (
              <div className="mt-4 p-3 bg-white/5 border border-white/20 rounded-lg text-xs text-white/60">
                <p className="font-semibold text-yellow-400 mb-1">ℹ️ Como funciona:</p>
                <p>As sugestões são baseadas em análise estatística do histórico completo armazenado no banco de dados, 
                incluindo frequência de números, padrões de sequência e números vizinhos. Quanto maior o histórico, 
                mais precisas são as sugestões.</p>
              </div>
            )}
          </div>
        )}

        {/* Numbers Display */}
        {numbers.length > 0 && (
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="w-5 h-5 text-white" />
              <h2 className="text-xl font-bold">Últimos Números ({numbers.length})</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {numbers.slice().reverse().map((num, idx) => (
                <div
                  key={idx}
                  className={`${getNumberColor(num)} px-4 py-2 rounded-lg font-bold text-lg shadow-lg transform hover:scale-110 transition-all`}
                >
                  {num}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Patterns Section */}
        {patterns.length > 0 && (
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h2 className="text-xl font-bold">Padrões Detectados</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {patterns.map((pattern, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-xl border-2 transition-all transform hover:scale-105 ${
                    pattern.probability >= 75
                      ? "bg-green-500/10 border-green-500/50"
                      : pattern.probability >= 65
                      ? "bg-yellow-500/10 border-yellow-500/50"
                      : "bg-blue-500/10 border-blue-500/50"
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-sm">{pattern.name}</h3>
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded ${
                        pattern.probability >= 75
                          ? "bg-green-500/20 text-green-400"
                          : pattern.probability >= 65
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {pattern.probability}%
                    </span>
                  </div>
                  <p className="text-xs text-white/60 mb-2">{pattern.description}</p>
                  {pattern.suggestedNumbers && pattern.suggestedNumbers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {pattern.suggestedNumbers.map((num, i) => (
                        <span
                          key={i}
                          className={`${getNumberColor(num)} px-2 py-1 rounded text-xs font-bold`}
                        >
                          {num}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estatísticas */}
        {numbers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Top 5 Números */}
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUpIcon className="w-5 h-5 text-orange-400" />
                <h2 className="text-xl font-bold">Top 5 Números Mais Frequentes</h2>
              </div>
              <div className="space-y-3">
                {topNumbers.map(([num, count], idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`${getNumberColor(parseInt(num))} px-3 py-2 rounded-lg font-bold text-sm w-12 text-center`}>
                      {num}
                    </div>
                    <div className="flex-1">
                      <div className="bg-white/10 rounded-full h-2 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-orange-400 to-red-400 h-full transition-all"
                          style={{ width: `${(count / numbers.length) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-white/60 text-sm">{count}x</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Números que "Puxam" */}
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-cyan-400" />
                <h2 className="text-xl font-bold">Números que "Puxam"</h2>
              </div>
              <div className="space-y-4">
                {ultimoNumero !== undefined && (
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="text-white/60 text-xs mb-2">Último Número ({ultimoNumero}) Puxa:</p>
                    <div className="flex flex-wrap gap-2">
                      {numerosPuxadosUltimo && numerosPuxadosUltimo.length > 0 ? (
                        numerosPuxadosUltimo.map((num, idx) => (
                          <div key={idx} className={`${getNumberColor(num)} px-3 py-1 rounded-lg font-bold text-sm`}>
                            {num}
                          </div>
                        ))
                      ) : (
                        <p className="text-white/40 text-xs">Nenhum padrão detectado ainda</p>
                      )}
                    </div>
                  </div>
                )}

                {penultimoNumero !== undefined && (
                  <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <p className="text-white/60 text-xs mb-2">Penúltimo Número ({penultimoNumero}) Puxa:</p>
                    <div className="flex flex-wrap gap-2">
                      {numerosPuxadosPenultimo && numerosPuxadosPenultimo.length > 0 ? (
                        numerosPuxadosPenultimo.map((num, idx) => (
                          <div key={idx} className={`${getNumberColor(num)} px-3 py-1 rounded-lg font-bold text-sm`}>
                            {num}
                          </div>
                        ))
                      ) : (
                        <p className="text-white/40 text-xs">Nenhum padrão detectado ainda</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <h2 className="text-xl font-bold">Alertas Recentes</h2>
            </div>
            <div className="space-y-2">
              {notifications.map((notif, idx) => (
                <div
                  key={idx}
                  className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-sm animate-pulse"
                >
                  {notif}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
