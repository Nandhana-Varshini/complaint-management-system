"""Pydantic request/response models."""
from pydantic import BaseModel
from typing import Optional


class UserRegister(BaseModel):
    name: str
    email: str
    student_id: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class AdminLogin(BaseModel):
    username: str
    password: str


class ComplaintStatusUpdate(BaseModel):
    status: str


class ComplaintAssign(BaseModel):
    assigned_to: str


class CommentCreate(BaseModel):
    text: str
