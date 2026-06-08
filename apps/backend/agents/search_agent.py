import os
from typing import cast
from dotenv import load_dotenv

from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware, ModelCallLimitMiddleware, ToolRetryMiddleware
from langchain.tools import tool
from langchain_core.messages import BaseMessage

from llm.get_llm import GemAgentsLLM


load_dotenv()

@tool
def search(query: str) -> str:
    """使用serpapi搜索引擎查询问题。"""
    import serpapi

    api_key = os.environ.get("SERPAPI_API_KEY")
    client = serpapi.Client(api_key=api_key)

    params = {
        "engine": "google",
        "q": query,
        "gl": "cn",
        "hl": "zh-cn",
    }

    try:
        results = client.search(params)
    except serpapi.exceptions.HTTPError as e:
        return f"搜索出错：{e}"

    if "error" in results:
        return f"搜索出错：{results['error']}"

    # 搜索概要信息
    search_info = results.get("search_information", {})
    total_results = search_info.get("total_results", "未知")
    output_parts = [f'搜索 "{query}"，约 {total_results} 条结果：\n']

    # 知识图谱（如果有）
    kg = results.get("knowledge_graph")
    if kg:
        output_parts.append(f"📦 知识图谱：{kg.get('title', '')}")
        if kg.get("description"):
            output_parts.append(f"   {kg['description']}")
        if kg.get("website"):
            output_parts.append(f"   官网：{kg['website']}")
        output_parts.append("")

    # 相关问题（如果有）
    related = results.get("related_questions", [])
    if related:
        output_parts.append("❓ 人们还在问：")
        for q in related[:3]:
            output_parts.append(f"   - {q.get('title', '')}")
        output_parts.append("")

    # 自然搜索结果
    organic_results = results.get("organic_results", [])
    if not organic_results:
        return f'没有找到关于"{query}"的搜索结果。'

    output_parts.append("🔍 搜索结果：")
    for i, r in enumerate(organic_results[:5], 1):
        title = r.get("title", "无标题")
        link = r.get("link", "")
        snippet = r.get("snippet", "")
        date = r.get("date", "")
        date_str = f" ({date})" if date else ""
        output_parts.append(f"{i}. {title}{date_str}")
        output_parts.append(f"   链接：{link}")
        if snippet:
            output_parts.append(f"   摘要：{snippet}")
        output_parts.append("")

    return "\n".join(output_parts)


tools = [search]

SYSTEM_PROMPT = """你是一个专业的搜索助手，具备以下能力：

**网络搜索**：通过 Google 搜索引擎检索互联网上的最新信息，包括新闻、技术文档、百科知识等。

使用指南：
- 当用户询问实时信息、事实性问题或你需要不确定的知识时，使用搜索工具获取最新、最准确的答案。
- 基于搜索结果进行总结和回答，不要编造信息。
- 如果搜索失败，如实告知用户并建议稍后重试。
- 搜索语言默认为中文（zh-cn），地区为中国（cn），适合检索中文内容。"""

llm = GemAgentsLLM()

agent = create_agent(
    model=llm.model,
    tools=tools,
    system_prompt=SYSTEM_PROMPT,
    middleware=cast("list[AgentMiddleware]", [
        ModelCallLimitMiddleware(run_limit=5),
        ToolRetryMiddleware(max_retries=2),
    ]),
)

if __name__ == "__main__":
    for chunk in agent.stream(
        {"messages": [{"role": "user", "content": "特斯拉今天的股价是多少"}]},
        stream_mode="messages",
    ):
        # chunk 是 (message, metadata) 元组，只输出有内容的消息块
        msg, metadata = chunk
        if not isinstance(msg, BaseMessage):
            continue
        if msg.content:
            print(msg.content, end="", flush=True)