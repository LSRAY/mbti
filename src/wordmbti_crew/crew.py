import os

from crewai import LLM, Agent, Crew, Process, Task
from crewai.agents.agent_builder.base_agent import BaseAgent
from crewai.project import CrewBase, agent, before_kickoff, crew, task
from pydantic import BaseModel, Field

from wordmbti_crew.method import METHOD, STACKS

MAX_CHARS = 4000  # 和网站一致：过长的文字截断，控制成本


class TopPair(BaseModel):
    pair: str = Field(description="组合，例如 Ti-Ne")
    dominant: str = Field(description="一句话：主导是什么，依据是什么")
    auxiliary: str = Field(description="一句话：辅助是怎么配合主导展开的")


class Judgement(BaseModel):
    core: str = Field(description="一句话：这段文字在纠结什么核心问题")
    scores: dict[str, float] = Field(description="16 组全部的分数，0 到 10")
    top: list[TopPair] = Field(description="分数最高的 4 组，从高到低")


class Effect(BaseModel):
    pair: str
    delta: float


class Option(BaseModel):
    text: str
    effects: list[Effect]


class Question(BaseModel):
    name: str = Field(description="四到六个字的题名，如“独处验证”")
    q: str
    why: str = Field(description="一句话：这道题在区分谁和谁、依据是什么")
    sep: str = Field(description="例如：区分 INTJ 和 INFJ")
    options: list[Option]


class Questions(BaseModel):
    questions: list[Question]


def _llm() -> LLM:
    return LLM(model=os.getenv("MODEL", "anthropic/claude-haiku-5-5"), temperature=0.3)


@CrewBase
class WordmbtiCrew:
    """四个智能体协作：主导分析 → 写法与劣势分析 → 综合打分 → 出验证题"""

    agents: list[BaseAgent]
    tasks: list[Task]

    @before_kickoff
    def prepare_inputs(self, inputs):
        inputs = dict(inputs or {})
        payload = inputs.get("crewai_trigger_payload")
        if not inputs.get("text") and isinstance(payload, dict):
            inputs["text"] = payload.get("text", "")
        inputs["text"] = str(inputs.get("text", "")).strip()[:MAX_CHARS]
        if not inputs["text"]:
            raise ValueError("缺少输入 text：请传入要分析的文字")
        inputs.setdefault("num_questions", 3)
        inputs["method"] = METHOD
        inputs["stacks"] = STACKS
        return inputs

    @agent
    def content_analyst(self) -> Agent:
        return Agent(config=self.agents_config["content_analyst"], llm=_llm(), verbose=True)  # type: ignore[index]

    @agent
    def style_analyst(self) -> Agent:
        return Agent(config=self.agents_config["style_analyst"], llm=_llm(), verbose=True)  # type: ignore[index]

    @agent
    def judge(self) -> Agent:
        return Agent(config=self.agents_config["judge"], llm=_llm(), verbose=True)  # type: ignore[index]

    @agent
    def question_designer(self) -> Agent:
        return Agent(config=self.agents_config["question_designer"], llm=_llm(), verbose=True)  # type: ignore[index]

    @task
    def content_task(self) -> Task:
        return Task(config=self.tasks_config["content_task"])  # type: ignore[index]

    @task
    def style_task(self) -> Task:
        return Task(config=self.tasks_config["style_task"])  # type: ignore[index]

    @task
    def judge_task(self) -> Task:
        return Task(config=self.tasks_config["judge_task"], output_pydantic=Judgement)  # type: ignore[index]

    @task
    def question_task(self) -> Task:
        return Task(config=self.tasks_config["question_task"], output_pydantic=Questions)  # type: ignore[index]

    @crew
    def crew(self) -> Crew:
        return Crew(agents=self.agents, tasks=self.tasks, process=Process.sequential, verbose=True)
