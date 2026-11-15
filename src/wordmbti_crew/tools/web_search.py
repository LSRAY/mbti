"""用 Claude 自带的网络搜索做研究，只需要 ANTHROPIC_API_KEY，不用另外申请搜索服务的 key。"""
import os

import anthropic
from crewai.tools import BaseTool
from pydantic import BaseModel, Field

SEARCH_MODEL = os.getenv("SEARCH_MODEL", "claude-haiku-5-5")
MAX_SEARCHES = int(os.getenv("MAX_SEARCHES_PER_CALL", "3"))  # 每次调用最多搜几次，控制费用


class SearchInput(BaseModel):
    query: str = Field(description="要研究的问题，例如：INTP 写文章的语言风格和常用句式")


class ClaudeWebSearchTool(BaseTool):
    name: str = "web_search"
    description: str = (
        "上网搜索并总结一个问题，返回带来源网址的要点。"
        "一次只问一个具体问题，比如某个类型的写作风格、口头禅、行文结构。"
    )
    args_schema: type[BaseModel] = SearchInput

    def _run(self, query: str) -> str:
        client = anthropic.Anthropic(max_retries=2)
        messages = [{
            "role": "user",
            "content": (
                f"上网搜索并回答：{query}\n\n"
                "要求：只总结搜索到的内容，不要凭记忆补充；每个要点后面写上来源网址；"
                "注明来源类型（论坛个人经验 / 测评网站 / 学术或荣格原著）；用中文回答，控制在 600 字以内。"
            ),
        }]
        tools = [{"type": "web_search_20250305", "name": "web_search", "max_uses": MAX_SEARCHES}]
        try:
            for _ in range(3):  # 服务器端搜索可能会暂停（pause_turn），最多续两次
                resp = client.messages.create(model=SEARCH_MODEL, max_tokens=4000, tools=tools, messages=messages)
                if resp.stop_reason != "pause_turn":
                    break
                messages = messages[:1] + [{"role": "assistant", "content": resp.content}]
        except anthropic.APIError as e:
            return f"搜索失败：{e.__class__.__name__}"
        if resp.stop_reason == "refusal":
            return "搜索被拒绝，请换一个问法。"

        text, urls = [], []
        for block in resp.content:
            if block.type == "text":
                text.append(block.text)
                for c in getattr(block, "citations", None) or []:
                    url = getattr(c, "url", None)
                    if url and url not in urls:
                        urls.append(url)
        out = "".join(text).strip() or "没有搜到有用的内容。"
        if urls:
            out += "\n\n引用来源：\n" + "\n".join(urls)
        return out
