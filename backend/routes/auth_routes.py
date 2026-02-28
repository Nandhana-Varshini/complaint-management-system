"""Authentication routes — register, login, admin login."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, User
from auth import hash_password, verify_password, create_token
import models

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register")
def register(data: models.UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(400, "An account with this email already exists.")
    user = User(
        name=data.name,
        email=data.email,
        student_id=data.student_id,
        password=hash_password(data.password),
        role="student",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_token({"sub": str(user.id), "role": "student"})
    return {
        "token": token,
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": "student"},
    }


@router.post("/login")
def login(data: models.UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password):
        raise HTTPException(401, "Invalid email or password.")
    token = create_token({"sub": str(user.id), "role": user.role})
    return {
        "token": token,
        "user": {"id": user.id, "name": user.name, "email": user.email, "role": user.role},
    }


@router.post("/admin/login")
def admin_login(data: models.AdminLogin):
    if data.username != "admin" or data.password != "admin123":
        raise HTTPException(401, "Invalid administrator credentials.")
    token = create_token({"sub": "admin", "role": "admin"})
    return {
        "token": token,
        "user": {"id": 0, "name": "Administrator", "role": "admin"},
    }
