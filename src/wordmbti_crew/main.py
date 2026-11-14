#!/usr/bin/env python
import json
import sys
import warnings

from wordmbti_crew.crew import WordmbtiCrew

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

SAMPLE = {
    "text": "我想好了，这毕业证不要了，我只是在错误的路上硬走了两年。明年3月份我就去美国加州，"
            "机票和房租我都算过了，首先把语言考了，其次把作品集整理好。真是浪费时间。",
    "num_questions": 3,
}


def run():
    """本地运行：crewai run"""
    result = WordmbtiCrew().crew().kickoff(inputs=SAMPLE)
    print(result.raw)


def train():
    WordmbtiCrew().crew().train(n_iterations=int(sys.argv[1]), filename=sys.argv[2], inputs=SAMPLE)


def replay():
    WordmbtiCrew().crew().replay(task_id=sys.argv[1])


def test():
    WordmbtiCrew().crew().test(n_iterations=int(sys.argv[1]), eval_llm=sys.argv[2], inputs=SAMPLE)


def run_with_trigger():
    """用触发器传入的 JSON（需要包含 text 字段）运行"""
    if len(sys.argv) < 2:
        raise Exception("No trigger payload provided. Please provide JSON payload as argument.")
    try:
        payload = json.loads(sys.argv[1])
    except json.JSONDecodeError:
        raise Exception("Invalid JSON payload provided as argument")
    return WordmbtiCrew().crew().kickoff(inputs={"crewai_trigger_payload": payload})
