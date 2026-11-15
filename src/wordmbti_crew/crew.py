import os

from crewai import LLM, Agent, Crew, Process, Task
from crewai.agents.agent_builder.base_agent import BaseAgent
from crewai.project import CrewBase, agent, before_kickoff, crew, task
from pydantic import BaseModel, Field

from wordmbti_crew.method import METHOD
from wordmbti_crew.tools.web_search import ClaudeWebSearchTool

DEFAULT_FOCUS = "文字最容易判错的几组：Ne-Ti 与 Ni-Fe、Fi-Ne 与 Fe-Ni、Ti-Ne 与 Ni-Te，以及各类型劣势功能在文字里的样子"


class Change(BaseModel):
    where: str = Field(description="改在 METHOD 的哪一条")
    before: str = Field(description="原文（新增时写“无”）")
    after: str = Field(description="新文")
    reason: str = Field(description="理由，引用审核通过的发现")


class RuleUpdate(BaseModel):
    changes: list[Change]
    new_method: str = Field(description="修改后的 METHOD 全文")


def _llm() -> LLM:
    return LLM(model=os.getenv("MODEL", "anthropic/claude-haiku-5-5"), temperature=0.3)


@CrewBase
class WordmbtiCrew:
    """三个智能体协作：上网研究文风 → 审核正确性 → 修改判断规则"""

    agents: list[BaseAgent]
    tasks: list[Task]

    @before_kickoff
    def prepare_inputs(self, inputs):
        inputs = dict(inputs or {})
        payload = inputs.get("crewai_trigger_payload")
        if isinstance(payload, dict):
            for k in ("focus", "max_searches"):
                inputs.setdefault(k, payload.get(k))
        inputs["focus"] = str(inputs.get("focus") or DEFAULT_FOCUS).strip()[:500]
        try:
            inputs["max_searches"] = max(1, min(10, int(inputs.get("max_searches") or 5)))
        except (TypeError, ValueError):
            inputs["max_searches"] = 5
        inputs["method"] = METHOD
        return inputs

    @agent
    def researcher(self) -> Agent:
        return Agent(
            config=self.agents_config["researcher"],  # type: ignore[index]
            tools=[ClaudeWebSearchTool()],
            llm=_llm(),
            max_iter=12,  # 限制工具调用轮数，防止搜个没完
            verbose=True,
        )

    @agent
    def validator(self) -> Agent:
        return Agent(config=self.agents_config["validator"], llm=_llm(), verbose=True)  # type: ignore[index]

    @agent
    def rule_editor(self) -> Agent:
        return Agent(config=self.agents_config["rule_editor"], llm=_llm(), verbose=True)  # type: ignore[index]

    @task
    def research_task(self) -> Task:
        return Task(config=self.tasks_config["research_task"])  # type: ignore[index]

    @task
    def validate_task(self) -> Task:
        return Task(config=self.tasks_config["validate_task"])  # type: ignore[index]

    @task
    def edit_task(self) -> Task:
        return Task(config=self.tasks_config["edit_task"], output_pydantic=RuleUpdate)  # type: ignore[index]

    @crew
    def crew(self) -> Crew:
        return Crew(agents=self.agents, tasks=self.tasks, process=Process.sequential, verbose=True)
