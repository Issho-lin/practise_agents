import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './App.css'

interface AgentInfo {
  id: string
  name: string
  description: string
  icon: string
}

/** 有序片段：每项代表模型输出流中的一个视觉块 */
type PartType = 'think' | 'text' | 'tool'

interface Part {
  type: PartType
  /** text/think 的累计内容 */
  content?: string
  /** text 的子类型：工具前中间回复 | 最终回答 */
  subType?: 'pre_tool' | 'answer'
  /** tool 的信息 */
  toolCallId?: string   // 唯一 ID，用于匹配 tool_result
  toolName?: string
  toolArgs?: string
  toolResult?: string
}

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string  // 兼容旧逻辑（最终回答的快捷访问）
  parts: Part[]     // 有序片段列表，严格按接收顺序
  isStreaming?: boolean
  isThinking?: boolean
  thinkExpanded?: boolean
  toolExpanded?: boolean
}

const FALLBACK_AGENTS: AgentInfo[] = [
  { id: 'search', name: '搜索助手', description: '搜索引擎检索信息', icon: '🔍' },
  { id: 'travel', name: '旅行助手', description: '天气查询与景点推荐', icon: '✈️' },
]

function App() {
  const [agents, setAgents] = useState<AgentInfo[]>(FALLBACK_AGENTS)
  const [activeAgentId, setActiveAgentId] = useState<string>('search')
  const [messagesMap, setMessagesMap] = useState<Record<string, Message[]>>({})
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [backendOnline, setBackendOnline] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const activeMessages = messagesMap[activeAgentId] ?? []

  const updateAgentMessages = useCallback(
    (agentId: string, updater: (prev: Message[]) => Message[]) => {
      setMessagesMap((prev) => ({
        ...prev,
        [agentId]: updater(prev[agentId] ?? []),
      }))
    },
    [],
  )

  useEffect(() => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    fetch('/api/agents', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.agents?.length > 0) {
          setAgents(data.agents)
          setActiveAgentId(data.agents[0].id)
          setBackendOnline(true)
        }
      })
      .catch(() => setBackendOnline(false))
      .finally(() => clearTimeout(timeoutId))

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  /** 基于 parts 内容生成滚动签名（排除 UI 状态） */
  const messagesSignature = activeMessages
    .map(
      (m) =>
        `${m.id}:${m.isStreaming}:${m.parts.map((p) =>
          p.type === 'text' || p.type === 'think'
            ? `${p.type}:${(p.content || '').length}`
            : `tool:${p.toolCallId}:${p.toolName}:${(p.toolResult || '').length}`
        ).join(',')}`
    )
    .join('|')

  useEffect(() => {
    scrollToBottom()
  }, [messagesSignature, scrollToBottom])

  /**
   * 向消息的有序 parts 列表追加或创建片段
   * - think/text 类型：追加到最后一个同类型+同subType的片段（流式拼接）
   * - tool_call：新增一个 tool 片段
   * - tool_result：追加到最后一个匹配 toolName 的 tool 片段的 result
   */
  const appendPart = useCallback(
    (
      agentId: string,
      msgId: string,
      updater: (parts: Part[]) => Part[],
      extraFields?: Record<string, unknown>
    ) => {
      updateAgentMessages(agentId, (prev) =>
        prev.map((m) =>
          m.id === msgId ? { ...m, parts: updater(m.parts), ...extraFields } : m
        )
      )
    },
    [updateAgentMessages]
  )

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading || !activeAgentId) return

    const currentAgentId = activeAgentId
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      parts: [],
    }
    const agentMsgId = (Date.now() + 1).toString()
    const agentMsg: Message = {
      id: agentMsgId,
      role: 'agent',
      content: '',
      parts: [],
      isStreaming: true,
      isThinking: true,
    }

    updateAgentMessages(currentAgentId, (prev) => [...prev, userMsg, agentMsg])
    setInput('')
    setIsLoading(true)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const response = await fetch(`/api/agents/${currentAgentId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const dataStr = line.slice(6)
          try {
            const data = JSON.parse(dataStr)

            if (data.type === 'done') {
              appendPart(currentAgentId, agentMsgId, (parts) => parts, {
                isStreaming: false,
                isThinking: false,
                toolExpanded: false,
              })
            } else if (data.type === 'error') {
              appendPart(currentAgentId, agentMsgId, (parts) => [
                ...parts,
                { type: 'text', content: `❌ 错误：${data.content}`, subType: 'answer' as const },
              ], { isStreaming: false, isThinking: false })
            } else if (data.type === 'think') {
              // 追加到最后的 think 块，或新建
              appendPart(currentAgentId, agentMsgId, (parts) => {
                const last = parts[parts.length - 1]
                if (last?.type === 'think') {
                  return [...parts.slice(0, -1), { ...last, content: (last.content || '') + data.content }]
                }
                return [...parts, { type: 'think' as const, content: data.content }]
              }, { isThinking: false })
            } else if (data.type === 'thinking_end') {
              // 仅 UI 状态变更，不改变 parts
              updateAgentMessages(currentAgentId, (prev) =>
                prev.map((m) => (m.id === agentMsgId ? { ...m, thinkExpanded: false } : m))
              )
            } else if (data.type === 'pre_tool_content') {
              // 工具前的文本 → 追加到最后一个 pre_tool 文本块，或新建
              appendPart(currentAgentId, agentMsgId, (parts) => {
                const last = parts[parts.length - 1]
                if (last?.type === 'text' && last.subType === 'pre_tool') {
                  return [...parts.slice(0, -1), { ...last, content: (last.content || '') + data.content }]
                }
                return [...parts, { type: 'text' as const, content: data.content, subType: 'pre_tool' as const }]
              }, { isThinking: false })
            } else if (data.type === 'content') {
              // 最终回答文本 → 追加到最后一个 answer 文本块，或新建
              appendPart(currentAgentId, agentMsgId, (parts) => {
                const last = parts[parts.length - 1]
                if (last?.type === 'text' && last.subType === 'answer') {
                  return [...parts.slice(0, -1), { ...last, content: (last.content || '') + data.content }]
                }
                return [...parts, { type: 'text' as const, content: data.content, subType: 'answer' as const }]
              }, { isThinking: false, content: '' }) // 同时更新 content 字段兼容
            } else if (data.type === 'tool_call') {
              // 新增工具调用条目
              appendPart(currentAgentId, agentMsgId, (parts) => [
                ...parts,
                {
                  type: 'tool' as const,
                  toolCallId: data.tool_call_id || `tc_${Date.now()}_${parts.filter(p => p.type === 'tool').length}`,
                  toolName: data.tool_name,
                  toolArgs: data.tool_args,
                },
              ], { isThinking: false, toolExpanded: true })
            } else if (data.type === 'tool_result') {
              // 工具结果 → 优先用 toolCallId 精确匹配， fallback 到 toolName
              appendPart(currentAgentId, agentMsgId, (parts) =>
                parts.map((p) => {
                  if (p.type !== 'tool' || p.toolResult) return p
                  // 优先按 ID 匹配（精确）
                  if (data.tool_call_id && p.toolCallId === data.tool_call_id) {
                    return { ...p, toolResult: data.content }
                  }
                  // fallback：同名且无 ID 的工具
                  if (!data.tool_call_id && p.toolName === data.tool_name && !p.toolCallId) {
                    return { ...p, toolResult: data.content }
                  }
                  return p
                }), { isThinking: false })
            }
          } catch {
            // 忽略解析失败的行
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        appendPart(currentAgentId, agentMsgId, (parts) => [
          ...parts,
          { type: 'text', content: '❌ 请求失败，请检查后端服务是否启动', subType: 'answer' as const },
        ], { isStreaming: false })
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setIsLoading(false)
    updateAgentMessages(activeAgentId, (prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    )
  }

  const switchAgent = (agentId: string) => {
    setActiveAgentId(agentId)
    setInput('')
  }

  const activeAgent = agents.find((a) => a.id === activeAgentId)

  const toggleThink = (msgId: string) => {
    updateAgentMessages(activeAgentId, (prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, thinkExpanded: !m.thinkExpanded } : m))
    )
  }

  const toggleTool = (msgId: string) => {
    updateAgentMessages(activeAgentId, (prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, toolExpanded: !m.toolExpanded } : m))
    )
  }

  /** 统计消息中 tool 类型的 parts 数量 */
  const countToolParts = (msg: Message) =>
    msg.parts.filter((p) => p.type === 'tool').length

  /** 渲染单个 Part */
  const renderPart = (msg: Message, part: Part, index: number) => {
    switch (part.type) {
      case 'think':
        if (!part.content) return null
        return (
          <div key={index} className={`think-section ${msg.thinkExpanded ? 'expanded' : ''}`}>
            <button className="think-toggle" onClick={() => toggleThink(msg.id)}>
              <span className="think-toggle-icon">{msg.thinkExpanded ? '▾' : '▸'}</span>
              <span className="think-toggle-label">思考过程</span>
            </button>
            {msg.thinkExpanded && (
              <div className="think-content">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>
              </div>
            )}
          </div>
        )

      case 'text':
        if (!part.content) return null
        if (part.subType === 'pre_tool') {
          return (
            <div key={index} className="pre-tool-content">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>
            </div>
          )
        }
        return (
          <div key={index} className="answer-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>
          </div>
        )

      case 'tool':
        return (
          <div key={index} className={`tool-section ${msg.toolExpanded ? 'expanded' : ''}`}>
            <button className="tool-toggle" onClick={() => toggleTool(msg.id)}>
              <span className="tool-toggle-icon">{msg.toolExpanded ? '▾' : '▸'}</span>
              <span className="tool-toggle-label">🔧 {part.toolName}</span>
            </button>
            {msg.toolExpanded && (
              <div className="tool-list">
                <div className="tool-item">
                  <div className="tool-call-header">
                    <span className="tool-call-icon">⚡</span>
                    <span className="tool-call-name">{part.toolName}</span>
                  </div>
                  <div className="tool-call-args">
                    <span className="tool-call-label">参数：</span>
                    <code>{part.toolArgs}</code>
                  </div>
                  {part.toolResult ? (
                    <div className="tool-call-result">
                      <span className="tool-call-label">结果：</span>
                      <pre>{part.toolResult}</pre>
                    </div>
                  ) : (
                    <div className="tool-call-waiting">执行中…</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="app-container">
      {/* 侧边栏 */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>🤖 My Agents</h1>
        </div>
        <div className="agent-list">
          {agents.map((agent) => (
            <button
              key={agent.id}
              className={`agent-item ${agent.id === activeAgentId ? 'active' : ''}`}
              onClick={() => switchAgent(agent.id)}
            >
              <span className="agent-icon">{agent.icon}</span>
              <div className="agent-info">
                <span className="agent-name">{agent.name}</span>
                <span className="agent-desc">{agent.description}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="sidebar-footer">
          <div className={`backend-status ${backendOnline ? 'online' : 'offline'}`}>
            <span className="status-dot" />
            <span>{backendOnline ? '后端已连接' : '后端未连接（使用离线模式）'}</span>
          </div>
          <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">
            📖 API 文档
          </a>
        </div>
      </aside>

      {/* 主聊天区域 */}
      <main className="chat-area">
        <header className="chat-header">
          {activeAgent ? (
            <>
              <span className="chat-header-icon">{activeAgent.icon}</span>
              <div>
                <h2>{activeAgent.name}</h2>
                <p>{activeAgent.description}</p>
              </div>
            </>
          ) : (
            <h2>选择 Agent 开始对话</h2>
          )}
        </header>

        {/* 消息列表 */}
        <div className="messages-container">
          {activeMessages.length === 0 && (
            <div className="empty-state">
              <p className="empty-icon">💬</p>
              <p>选择一个 Agent，输入问题开始对话</p>
            </div>
          )}
          {activeMessages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="message-avatar">
                {msg.role === 'user' ? '👤' : activeAgent?.icon || '🤖'}
              </div>
              <div className="message-content">
                {msg.role === 'user' ? (
                  <div className="user-message-text">{msg.content}</div>
                ) : msg.isThinking ? (
                  <span className="thinking-dots">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </span>
                ) : (
                  <>
                    {/* 严格按照 parts 数组顺序渲染每个片段 */}
                    {msg.parts.map((part, i) => renderPart(msg, part, i))}
                    {/* 流式输出中的光标 */}
                    {msg.isStreaming &&
                      !msg.isThinking &&
                      msg.parts.length > 0 &&
                      msg.parts[msg.parts.length - 1]?.type === 'text' && (
                        <span className="typing-cursor" />
                      )}
                    {msg.isStreaming &&
                      !msg.isThinking &&
                      msg.parts.filter((p) => p.type === 'text' && p.subType === 'answer').length === 0 &&
                      countToolParts(msg) > 0 && (
                        <span>...</span>
                      )}
                  </>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div className="input-area">
          <div className="input-wrapper">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLoading ? 'Agent 正在思考...' : '输入消息，按 Enter 发送...'}
              disabled={isLoading || !activeAgentId}
            />
            {isLoading ? (
              <button className="btn-stop" onClick={handleStop} title="停止生成">
                ⏹
              </button>
            ) : (
              <button
                className="btn-send"
                onClick={sendMessage}
                disabled={!input.trim() || !activeAgentId}
                title="发送"
              >
                ➤
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
