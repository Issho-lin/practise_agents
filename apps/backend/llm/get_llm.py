import os
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI
from openai import OpenAI

load_dotenv()

class GemAgentsLLM:
    """LLM 模型封装，统一管理模型初始化配置。"""

    def __init__(self) -> None:
        self.model_name: str = os.environ.get("MODEL_NAME", "gpt-4")
        self.client: OpenAI = OpenAI()

    @property
    def model(self) -> ChatOpenAI:
        """返回 LLM 实例，兼容旧版 model 变量的访问方式。"""
        return ChatOpenAI(
            model=self.model_name,
            temperature=0.7,
            extra_body={"thinking": {"type": "enabled"}},
        )

    def stream(self, query: str) -> str:
        print(f"\n\nquery: {query}")
        stream = self.client.chat.completions.create(
            model=self.model_name,
            messages=[{"role": "user", "content": query}],
            stream=True,
        )
        is_thinking = False
        is_answer = False
        collected_content = []
        for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if not delta:
                continue
                
            # print(delta)

            # 推理内容（思考过程）
            reasoning = getattr(delta, "reasoning_content", None)
            if reasoning:
                if not is_thinking:
                    is_thinking = True
                    print('================================================思考过程================================================', '\n')
                print(reasoning, end="", flush=True)
                # yield {"type": "thinking", "content": delta.reasoning_content}

            # 正式回答
            if delta.content:
                if not is_answer:
                    is_answer = True
                    print('\n\n', ' =================================================回答=================================================', '\n')
                print(delta.content, end="", flush=True)
                collected_content.append(delta.content)
                # yield {"type": "answer", "content": delta.content}
            
            # yield chunk
        print()
        return "".join(collected_content)