"""Admin-specific routes — stats and staff list."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db, Complaint
from auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])

STAFF_LIST = ["John Smith", "Maria Garcia", "David Lee", "Sarah Wilson", "James Brown"]


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    total = db.query(Complaint).count()
    pending = db.query(Complaint).filter(Complaint.status == "Pending").count()
    in_progress = db.query(Complaint).filter(Complaint.status == "In Progress").count()
    resolved = db.query(Complaint).filter(Complaint.status == "Resolved").count()

    # Category breakdown
    rows = db.query(Complaint.category, func.count(Complaint.id)).group_by(Complaint.category).all()
    by_category = {row[0]: row[1] for row in rows}

    return {
        "total": total,
        "pending": pending,
        "in_progress": in_progress,
        "resolved": resolved,
        "by_category": by_category,
    }


@router.get("/staff")
def get_staff(current_user: dict = Depends(require_admin)):
    return {"staff": STAFF_LIST}
