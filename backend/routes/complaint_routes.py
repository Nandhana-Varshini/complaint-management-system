"""
Complaint routes — submit, list, detail, status update, assign, comments.
Auto-generates CF-YYYY-XXXX ticket IDs.
Creates notifications when admin updates a complaint.
"""
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db, Complaint, Comment, Notification, generate_ticket_id, User
from auth import get_current_user, require_admin


# ── JSON body schemas for admin actions ─────────────────
class StatusBody(BaseModel):
    status: str

class AssignBody(BaseModel):
    assigned_to: str

class CommentBody(BaseModel):
    text: str

router = APIRouter(prefix="/api/complaints", tags=["complaints"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

CAMPUS_BUILDINGS = [
    "Xavier Block",
    "Alphonso Block",
    "Administration Block",
    "Canteen",
    "Hostel",
]

STAFF_LIST = ["John Smith", "Maria Garcia", "David Lee", "Sarah Wilson", "James Brown"]


def _complaint_to_dict(c: Complaint) -> dict:
    return {
        "id": c.id,
        "ticket_id": c.ticket_id,
        "student_id": c.student_id,
        "student_name": c.student.name if c.student else "Unknown",
        "student_email": c.student.email if c.student else "",
        "category": c.category,
        "building": c.building,
        "room_number": c.room_number,
        "description": c.description,
        "image_url": c.image_url,
        "status": c.status,
        "assigned_to": c.assigned_to,
        "admin_comment": c.admin_comment,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
        "comments": [
            {
                "id": cm.id,
                "author": cm.author,
                "text": cm.text,
                "created_at": cm.created_at.isoformat() if cm.created_at else None,
            }
            for cm in (c.comments or [])
        ],
    }


def _create_notification(db: Session, user_id: int, complaint: Complaint, message: str):
    notif = Notification(
        user_id=user_id,
        complaint_id=complaint.id,
        message=message,
        is_read=False,
    )
    db.add(notif)


# ── Submit Complaint ────────────────────────────────────
@router.post("")
async def submit_complaint(
    category: str = Form(...),
    building: str = Form(...),
    room_number: str = Form(...),
    description: str = Form(...),
    image: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] == "admin":
        raise HTTPException(403, "Admins cannot submit complaints.")

    image_url = None
    if image and image.filename:
        ext = os.path.splitext(image.filename)[1]
        filename = f"{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}{ext}"
        path = os.path.join(UPLOAD_DIR, filename)
        with open(path, "wb") as f:
            f.write(await image.read())
        image_url = f"/uploads/{filename}"

    ticket_id = generate_ticket_id(db)
    complaint = Complaint(
        ticket_id=ticket_id,
        student_id=current_user["id"],
        category=category,
        building=building,
        room_number=room_number,
        description=description,
        image_url=image_url,
        status="Pending",
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    return _complaint_to_dict(complaint)


# ── List Complaints ─────────────────────────────────────
@router.get("")
def list_complaints(
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    q = db.query(Complaint)
    if current_user["role"] != "admin":
        q = q.filter(Complaint.student_id == current_user["id"])
    if category:
        q = q.filter(Complaint.category == category)
    if status:
        q = q.filter(Complaint.status == status)
    complaints = q.order_by(Complaint.created_at.desc()).all()

    # Apply search filter in Python (ticket_id or student name)
    if search and current_user["role"] == "admin":
        s = search.lower()
        complaints = [
            c for c in complaints
            if s in c.ticket_id.lower()
            or (c.student and s in c.student.name.lower())
            or (c.student and s in c.student.email.lower())
        ]

    return [_complaint_to_dict(c) for c in complaints]


# ── Complaint Detail ────────────────────────────────────
@router.get("/{complaint_id}")
def get_complaint(
    complaint_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(404, "Complaint not found.")
    if current_user["role"] != "admin" and c.student_id != current_user["id"]:
        raise HTTPException(403, "Access denied.")
    return _complaint_to_dict(c)


# ── Update Status ───────────────────────────────────────
@router.patch("/{complaint_id}/status")
def update_status(
    complaint_id: int,
    body: StatusBody,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(404, "Complaint not found.")
    old_status = c.status
    c.status = body.status
    c.updated_at = datetime.utcnow()
    if old_status != body.status:
        _create_notification(
            db, c.student_id, c,
            f"Your complaint {c.ticket_id} status has been updated to '{body.status}'."
        )
    db.commit()
    db.refresh(c)
    return _complaint_to_dict(c)


# ── Assign Complaint ────────────────────────────────────
@router.patch("/{complaint_id}/assign")
def assign_complaint(
    complaint_id: int,
    body: AssignBody,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(404, "Complaint not found.")
    c.assigned_to = body.assigned_to
    c.updated_at = datetime.utcnow()
    _create_notification(
        db, c.student_id, c,
        f"Your complaint {c.ticket_id} has been assigned to {body.assigned_to}."
    )
    db.commit()
    db.refresh(c)
    return _complaint_to_dict(c)


# ── Add Comment ─────────────────────────────────────────
@router.post("/{complaint_id}/comments")
def add_comment(
    complaint_id: int,
    body: CommentBody,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin),
):
    c = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not c:
        raise HTTPException(404, "Complaint not found.")

    comment = Comment(complaint_id=c.id, author="Admin", text=body.text)
    db.add(comment)

    # Also update the main admin_comment field (latest comment visible to student)
    c.admin_comment = body.text
    c.updated_at = datetime.utcnow()

    _create_notification(
        db, c.student_id, c,
        f"Admin added a comment on your complaint {c.ticket_id}: \"{body.text[:80]}{'...' if len(body.text) > 80 else ''}\""
    )
    db.commit()
    db.refresh(c)
    return _complaint_to_dict(c)
