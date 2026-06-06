from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timezone

db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    target_exam = db.Column(db.String(100), nullable=False)  # e.g., JEE, NEET, UPSC, Board Exams
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Relationship to MoodLog
    mood_logs = db.relationship('MoodLog', backref='user', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User {self.username}>"

class MoodLog(db.Model):
    __tablename__ = 'mood_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    mood_name = db.Column(db.String(50), nullable=False)  # e.g., Happy, Calm, Anxious, Burned Out, etc.
    mood_score = db.Column(db.Integer, nullable=False)  # 1 (lowest/worst) to 5 (highest/best)
    reflection = db.Column(db.Text, nullable=True)  # Student journal reflection
    
    # Relationship to triggers
    triggers = db.relationship('StressTrigger', backref='mood_log', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<MoodLog {self.mood_name} by user_id {self.user_id}>"

class StressTrigger(db.Model):
    __tablename__ = 'stress_triggers'
    
    id = db.Column(db.Integer, primary_key=True)
    mood_log_id = db.Column(db.Integer, db.ForeignKey('mood_logs.id', ondelete='CASCADE'), nullable=False)
    trigger_name = db.Column(db.String(100), nullable=False)  # e.g., Syllabus Backlog, Mock Test, Peer Pressure

    def __repr__(self):
        return f"<StressTrigger {self.trigger_name}>"

class CommunityPost(db.Model):
    __tablename__ = 'community_posts'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    alias = db.Column(db.String(100), nullable=False)  # e.g. "Anonymous UPSC Aspirant" or "Tranquil Owl"
    content = db.Column(db.Text, nullable=False)
    stress_level = db.Column(db.Integer, nullable=False, default=3)  # 1 to 5 scale
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    
    # Relationships
    reactions = db.relationship('PostReaction', backref='post', lazy=True, cascade="all, delete-orphan")
    replies = db.relationship('PeerMessage', backref='post', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CommunityPost {self.id} by {self.alias}>"

class PostReaction(db.Model):
    __tablename__ = 'post_reactions'
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('community_posts.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    reaction_type = db.Column(db.String(50), nullable=False)  # e.g., "me_too", "hug", "support"

    def __repr__(self):
        return f"<PostReaction {self.reaction_type} on post {self.post_id}>"

class PeerMessage(db.Model):
    __tablename__ = 'peer_messages'
    
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('community_posts.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    alias = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<PeerMessage {self.id} on post {self.post_id}>"
