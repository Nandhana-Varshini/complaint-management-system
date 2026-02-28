"""Notification routes for in-app student notifications."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db, Notification
from auth import get_current_user

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
def get_notifications(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] == "admin":
        return []
    notifs = (
        db.query(Notification)
        .filter(Notification.user_id == current_user["id"])
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": n.id,
            "complaint_id": n.complaint_id,
            "message": n.message,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat() if n.created_at else None,
        }
        for n in notifs
    ]


@router.patch("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == current_user["id"],
        Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}
