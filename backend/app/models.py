from datetime import datetime, timezone

from sqlalchemy import Column, String, Integer, Text, JSON, ForeignKey, DateTime
from sqlalchemy.orm import relationship

from app.db import Base


class ProjectRow(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    root_dir = Column(String, nullable=False)
    status = Column(String, nullable=False, default="static_analysis")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    file_count = Column(Integer, default=0)
    analyzed_file_count = Column(Integer, default=0)
    class_count = Column(Integer, default=0)
    function_count = Column(Integer, default=0)
    excluded_files = Column(JSON, default=list)
    entry_point = Column(JSON, nullable=True)   # {function_id, reason}
    ai_summary = Column(Text, nullable=True)    # one-sentence purpose, best-effort LLM enrichment
    secret_warnings = Column(JSON, default=list)

    functions = relationship("FunctionRow", back_populates="project", cascade="all, delete-orphan")
    classes = relationship("ClassRow", back_populates="project", cascade="all, delete-orphan")


class ClassRow(Base):
    __tablename__ = "classes"

    id = Column(String, primary_key=True)   # "{project_id}::{file_path}::{name}"
    project_id = Column(String, ForeignKey("projects.id"))
    name = Column(String)
    file_path = Column(String)
    line_start = Column(Integer)
    line_end = Column(Integer)
    bases = Column(JSON, default=list)
    methods = Column(JSON, default=list)

    project = relationship("ProjectRow", back_populates="classes")


class FunctionRow(Base):
    __tablename__ = "functions"

    id = Column(String, primary_key=True)   # "{project_id}::{file_path}::{qualified}"
    project_id = Column(String, ForeignKey("projects.id"))
    name = Column(String)
    qualified_name = Column(String)
    file_path = Column(String)
    class_name = Column(String, nullable=True)
    line_start = Column(Integer)
    line_end = Column(Integer)
    args = Column(JSON, default=list)
    returns = Column(String, nullable=True)
    docstring = Column(String, nullable=True)
    source = Column(Text)
    calls = Column(JSON, default=list)

    analysis_json = Column(JSON, nullable=True)   # cached FunctionAnalysis, filled by LLM call

    project = relationship("ProjectRow", back_populates="functions")
