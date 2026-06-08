import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from langchain_core.messages import AIMessage, ToolMessage

router = APIRouter()

# Agent 注册表
AGENTS: dict[str, dict[str, str]] = {
    "search": {
        "id": "search",
        "name": "搜索助手",
        "description": "通过 Google 搜索引擎检索互联网上的最新信息，包括新闻、技术文档、百科知识等。",
        "icon": "🔍",
    },
    "travel": {
        "id": "travel",
        "name": "旅行助手",
        "description": "智能旅行助手，可以查询城市天气并根据天气推荐合适的旅游景点。",
        "icon": "✈️",
    },
}


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/agents")
async def list_agents():
    """列出所有可用的 Agent"""
    return {"agents": list(AGENTS.values())}


class ChatRequest(BaseModel):
    message: str


def _get_agent(agent_id: str):
    """根据 ID 动态加载 Agent 实例"""
    if agent_id not in AGENTS:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' 不存在")
    if agent_id == "search":
        from agents.search_agent import agent
        return agent
    elif agent_id == "travel":
        from agents.travel_agent import agent
        return agent
    raise HTTPException(status_code=500, detail="无法加载 Agent")


@router.post("/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, request: ChatRequest):
    """通过 SSE 流式调用 Agent 进行对话"""
    _get_agent(agent_id)  # 提前校验 agent 是否存在

    async def event_stream():
        try:
            # 发送思考开始事件
            yield f"data: {json.dumps({'type': 'thinking_start'})}\n\n"
            agent = _get_agent(agent_id)
            input_data: Any = {"messages": [{"role": "user", "content": request.message}]}

            # 追踪模型原生的思考/回答阶段
            in_reasoning = True
            has_tool_been_called = False  # 是否已发出过 tool_call 事件

            async for chunk in agent.astream(
                input_data,
                stream_mode="messages",
            ):
                msg, _metadata = chunk

                # 处理工具执行结果（立即全量推送）
                if isinstance(msg, ToolMessage):
                    tool_name = getattr(msg, "name", "unknown")
                    tool_call_id = getattr(msg, "tool_call_id", "")
                    result = str(msg.content)
                    yield f"data: {json.dumps({'type': 'tool_result', 'tool_call_id': tool_call_id, 'tool_name': tool_name, 'content': result}, ensure_ascii=False)}\n\n"
                    in_reasoning = True
                    continue
                if not isinstance(msg, AIMessage):
                    continue

                # 处理工具调用请求（模型决定调用工具）
                if msg.tool_calls:
                    for tc in msg.tool_calls:
                        tool_name = tc.get("name") or tc.get("function", {}).get("name", "unknown")
                        tool_args = tc.get("args") or tc.get("function", {}).get("arguments", {})
                        tool_call_id = tc.get("id", "")
                        # 确保 args 是字符串格式
                        if isinstance(tool_args, dict):
                            args_str = json.dumps(tool_args, ensure_ascii=False)
                        else:
                            args_str = str(tool_args)
                        yield f"data: {json.dumps({'type': 'tool_call', 'tool_call_id': tool_call_id, 'tool_name': tool_name, 'tool_args': args_str}, ensure_ascii=False)}\n\n"
                    in_reasoning = False
                    has_tool_been_called = True
                    continue

                # 提取模型原生的 reasoning_content（深度思考内容）
                reasoning = str(msg.additional_kwargs.get("reasoning_content", ""))
                if reasoning:
                    yield f"data: {json.dumps({'type': 'think', 'content': reasoning})}\n\n"

                # 跳过无内容的纯工具调用消息
                if not msg.content:
                    continue

                # 处理消息内容 —— 注意：reasoning 和 content 是独立分类的，
                # 即使同一条消息同时有两者，content 也应按正常文本处理
                content = msg.content
                if isinstance(content, list):
                    text = "".join(
                        c.get("text", "") if isinstance(c, dict) else str(c)
                        for c in content
                    )
                else:
                    text = str(content)

                if not text:
                    continue

                # 从思考阶段切换到输出阶段：本轮无 reasoning_content 且之前在推理中
                if in_reasoning and not reasoning:
                    in_reasoning = False
                    yield f"data: {json.dumps({'type': 'thinking_end'})}\n\n"

                # 文本分类：根据当前状态决定类型（与是否带 reasoning 无关）
                if has_tool_been_called:
                    # 工具调用后的内容 = 最终回答
                    yield f"data: {json.dumps({'type': 'content', 'content': text})}\n\n"
                elif in_reasoning:
                    # 仍在推理阶段但输出了文本 → 归入思考过程
                    yield f"data: {json.dumps({'type': 'think', 'content': text})}\n\n"
                else:
                    # 工具调用前的正式输出 = 中间回复
                    yield f"data: {json.dumps({'type': 'pre_tool_content', 'content': text})}\n\n"

            # 如果始终处于思考阶段，仍然发送 thinking_end
            if in_reasoning:
                yield f"data: {json.dumps({'type': 'thinking_end'})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except HTTPException:
            pass
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
