#!/usr/bin/env python
import json
import sys
import warnings

from wordmbti_crew.crew import WordmbtiCrew

warnings.filterwarnings("ignore", category=SyntaxWarning, module="pysbd")

SAMPLE = {
    "focus": "",  # 留空就用默认重点：最容易判错的几组
    "max_searches": 5,
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
    """用触发器传入的 JSON（可包含 focus、max_searches）运行"""
    if len(sys.argv) < 2:
        raise Exception("No trigger payload provided. Please provide JSON payload as argument.")
    try:
        payload = json.loads(sys.argv[1])
    except json.JSONDecodeError:
        raise Exception("Invalid JSON payload provided as argument")
    return WordmbtiCrew().crew().kickoff(inputs={"crewai_trigger_payload": payload})
