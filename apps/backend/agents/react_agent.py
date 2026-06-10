from typing import Any, cast

import os
from dotenv import load_dotenv

load_dotenv()

model_name: str = os.getenv('MODEL_NAME', 'qwen3.7-plus')


from langchain.agents import create_agent
from langchain_openai import ChatOpenAI
from langchain.agents.middleware import AgentMiddleware, ModelCallLimitMiddleware, ToolRetryMiddleware
from langchain.tools import BaseTool
from langchain_core.messages import BaseMessage

class ReactAgent:
    def __init__(self, name: str = '', model: str = model_name, system_prompt: str = '', tools: list[BaseTool] | None = None):
        self.name: str = name
        self.model: ChatOpenAI = ChatOpenAI(
            model=model,
            temperature=0.7,
            # extra_body={"thinking": {"type": "enabled"}},
        )
        self.agent: Any = create_agent(
            model=self.model,
            system_prompt=system_prompt,
            tools=tools or [],
            middleware=cast("list[AgentMiddleware]", [
                ModelCallLimitMiddleware(run_limit=5),
                ToolRetryMiddleware(max_retries=2),
            ]),
        )
    
    def stream(self, query: str):
        print(f"{self.name}正在为您整理最佳答案...")
        for chunk in self.agent.stream({"messages": [{"role": "user", "content": query}]}, stream_mode="messages"):
            # chunk 是 (message, metadata) 元组，只输出有内容的消息块
            msg, _metadata = chunk
            if not isinstance(msg, BaseMessage):
                continue
            if msg.content:
                print(msg.content, end="", flush=True)