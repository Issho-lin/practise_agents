


import os
from dotenv import load_dotenv

from requests.models import Response
from typing import cast

from langchain_core.messages import BaseMessage
from langchain_core.tools.base import BaseTool
from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, ModelCallLimitMiddleware, ToolRetryMiddleware
from langchain.chat_models.base import init_chat_model
from langchain.tools import tool

from tavily.client import TavilyClient

load_dotenv()

@tool
def get_weather(city: str) -> str:
    """查询指定城市的实时天气。"""
    import requests
    url: str = f"https://wttr.in/{city}?format=j1"
    try:
        response: Response = requests.get(url)
        response.raise_for_status()
        data = response.json()
        current_condition = data['current_condition'][0]
        weather_desc = current_condition['weatherDesc'][0]['value']
        temp_c = current_condition['temp_C']
        return f"{city}当前天气：{weather_desc}，气温{temp_c}摄氏度"
    except requests.exceptions.RequestException as e:
        return f"错误：查询天气时遇到网络问题 - {e}"
    except (KeyError, IndexError) as e:
        return f"错误：解析天气数据失败，可能是城市名称无效 - {e}"


@tool
def get_attraction(city: str, weather: str) -> str:
    """根据城市和天气，搜索推荐的旅游景点。"""
    from tavily import TavilyClient
    api_key: str | None = os.environ.get("TAVILY_API_KEY")
    if not api_key:
        return "错误：未配置TAVILY_API_KEY。"
    tavily: TavilyClient = TavilyClient(api_key=api_key)
    query: str = f"'{city}' 在'{weather}'天气下最值得去的旅游景点推荐及理由"
    try:
        response = tavily.search(query=query, search_depth="basic", include_answer=True)
        if response.get("answer"):
            return response["answer"]
        formatted_results = []
        for result in response.get("results", []):
            formatted_results.append(f"- {result['title']}: {result['content']}")
        if not formatted_results:
            return "抱歉，没有找到相关的旅游景点推荐。"
        return "根据搜索，为您找到以下信息：\n" + "\n".join(formatted_results)
    except Exception as e:
        return f"错误：执行Tavily搜索时出现问题 - {e}"


tools: list[BaseTool] = [get_weather, get_attraction]

model_name: str | None = os.environ.get("MODEL_NAME")
if not model_name:
    raise ValueError("未配置环境变量 MODEL_NAME")

model = init_chat_model(model_name, model_provider="openai")

agent = create_agent(
    model=model,
    tools=tools,
    system_prompt="你是一个智能旅行助手。你的任务是分析用户的请求，并使用可用工具一步步地解决问题。",
    middleware=cast("list[AgentMiddleware]", [
        ModelCallLimitMiddleware(run_limit=5),
        ToolRetryMiddleware(max_retries=2),
    ]),
)

if __name__ == "__main__":
    for chunk in agent.stream(
        {"messages": [{"role": "user", "content": "你好，请帮我查询一下今天北京的天气，然后根据天气推荐一个合适的旅游景点。"}]},
        stream_mode="messages",
    ):
        # chunk 是 (message, metadata) 元组，只输出有内容的消息块
        msg, metadata = chunk
        if not isinstance(msg, BaseMessage):
            continue
        if msg.content:
            print(msg.content, end="", flush=True)