from pydantic import BaseModel

class PlanOutput(BaseModel):
    steps: list[str]

class GeneratedFile(BaseModel):
    path: str
    content: str

class CodeOutput(BaseModel):
    files: list[GeneratedFile]

class ReviewOutput(BaseModel):
    approved: bool
    notes: str
    issues: list[str]
