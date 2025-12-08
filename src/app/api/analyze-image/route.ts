import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { image, prompt } = await request.json()

    if (!image) {
      return NextResponse.json(
        { error: 'Imagem não fornecida' },
        { status: 400 }
      )
    }

    // Verificar se a chave da OpenAI está configurada
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { 
          error: 'Chave da OpenAI não configurada',
          message: 'Configure a variável OPENAI_API_KEY nas configurações do projeto'
        },
        { status: 500 }
      )
    }

    console.log('🔍 Iniciando análise de imagem com OpenAI Vision...')

    // Chamar OpenAI Vision API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt || 'Analise esta imagem de uma roleta e extraia APENAS os números que aparecem nos resultados/histórico. Liste os números na ordem em que aparecem (do mais antigo ao mais recente, da esquerda para direita ou de cima para baixo). Retorne apenas os números separados por vírgula, sem texto adicional. Exemplo de resposta: 12, 5, 23, 14, 8'
              },
              {
                type: 'image_url',
                image_url: {
                  url: image,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      })
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error('❌ Erro da OpenAI:', errorData)
      return NextResponse.json(
        { 
          error: 'Erro ao processar imagem com OpenAI',
          details: errorData.error?.message || 'Erro desconhecido'
        },
        { status: response.status }
      )
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content || ''

    console.log('📝 Resposta da OpenAI:', content)

    // Extrair números do texto retornado
    const numbersMatch = content.match(/\d+/g)
    const numbers = numbersMatch 
      ? numbersMatch.map(n => parseInt(n)).filter(n => n >= 0 && n <= 36)
      : []

    console.log('🎯 Números extraídos:', numbers)

    return NextResponse.json({
      success: true,
      numbers,
      rawResponse: content
    })

  } catch (error) {
    console.error('❌ Erro ao processar requisição:', error)
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}
