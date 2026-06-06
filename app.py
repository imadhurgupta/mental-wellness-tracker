import os
import hmac
import re
from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, Response
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from models import db, User, MoodLog, StressTrigger, CommunityPost, PostReaction, PeerMessage
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import selectinload
from typing import Union, Dict, List, Tuple, Any, Optional, Callable

app = Flask(__name__)
# Load secret key from environment variable in production, fall back to safe key locally
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or 'mental_wellness_local_development_fallback_key_123_xyz'

# Session Cookie Policies for XSS/CSRF mitigation
is_prod: bool = os.environ.get('VERCEL') == '1'
app.config.update(
    SESSION_COOKIE_SECURE=is_prod,
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE='Lax'
)

# Configure Database: Use remote Postgres on Vercel/Prod if available, else local SQLite
database_url: Optional[str] = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL')
if database_url:
    # SQLAlchemy 1.4+ requires postgresql:// instead of postgres://
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
else:
    if os.environ.get('VERCEL') == '1':
        db_path = '/tmp/database.db'
    else:
        db_path = os.path.join(os.path.abspath(os.path.dirname(__file__)), 'database.db')
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Create database tables if they don't exist
with app.app_context():
    try:
        db.create_all()
    except Exception as e:
        app.logger.warning(f"Database table creation skipped or failed: {e}")

# Predefined valid choices for parameter validation
VALID_MOODS = {'Happy', 'Motivated', 'Calm', 'Tired', 'Self-Doubt', 'Stressed', 'Anxious', 'Burned Out'}
VALID_TRIGGERS = {
    'Mock Test Results',
    'Syllabus Backlog',
    'Time Management',
    'Parental Expectation',
    'Sleep Deprivation',
    'Peer Pressure',
    'Uncertainty'
}
VALID_EXAMS = {
    'JEE', 'NEET', 'UPSC', 'CAT', 'GATE', 'CUET', 'Board Exams', 'Other Entrance Exams'
}

def is_valid_username(username: str) -> bool:
    return bool(re.match(r'^[a-zA-Z0-9_]{3,30}$', username))

# CSRF validation and token generation hooks
@app.before_request
def csrf_protect():
    # 1. Generate CSRF token if missing
    if 'csrf_token' not in session:
        import secrets
        session['csrf_token'] = secrets.token_hex(32)
        
    # 2. Verify token on all POST requests
    if request.method == "POST":
        if app.config.get('TESTING'):
            return
        token = session.get('csrf_token')
        form_token = request.form.get('csrf_token') or request.headers.get('X-CSRF-Token')
        if not token or token != form_token:
            from flask import abort
            abort(400, "CSRF token validation failed.")

# Inject security response headers globally
@app.after_request
def add_security_headers(response):
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "connect-src 'self'; "
        "img-src 'self' data:;"
    )
    return response

# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Context processor to make target exam and username globally available in templates
@app.context_processor
def inject_user_details():
    if 'user_id' in session:
        user = db.session.get(User, session['user_id'])
        if user:
            return {'current_student': user}
    return {'current_student': None}

# Wellness Feedback Engine
def generate_personalized_advice(mood_name, triggers, target_exam):
    advice = {
        "title": "Your Coping Action Plan",
        "intro": f"Preparing for {target_exam} is an intense journey, and feeling overwhelmed is a natural reaction. Here is customized support based on your log:",
        "points": [],
        "action_step": "Practice 3 cycles of Box Breathing to ground yourself."
    }
    
    # Mood-specific core strategies
    if mood_name in ['Burned Out', 'Tired']:
        advice['title'] = "Rest & Recharge Strategy"
        advice['points'].append("Burnout is a signal that your brain needs complete detachment. Studying in this state leads to low efficiency and high frustration.")
        advice['points'].append("Set a strict 'study curfew' tonight. No books or screens for at least 2 hours before sleep.")
        advice['action_step'] = "Launch the Pomodoro timer, study for just 25 minutes, and take a completely screen-free break."
        
    elif mood_name in ['Anxious', 'Stressed']:
        advice['title'] = "Anxiety Calming Protocol"
        advice['points'].append("Anxiety keeps your nervous system in high alert. This blocks the prefrontal cortex, making logical reasoning and memorization harder.")
        advice['points'].append("Zoom in on the present hour. Write down only one simple topic to revise next. Ignore the rest of the syllabus for now.")
        advice['action_step'] = "Go to the Wellness Tools page and use the Box Breathing bubble for 2 minutes to lower your heart rate."
        
    elif mood_name in ['Self-Doubt', 'Depressed']:
        advice['title'] = "Mindset Reset & Encouragement"
        advice['points'].append("Self-doubt is extremely common when preparing for competitive exams. Remember: test scores measure specific skills under timed conditions, not your cognitive potential or self-worth.")
        advice['points'].append("Remind yourself of a topic you once found difficult but have now mastered. You are capable of growth.")
        advice['action_step'] = "Write down one single positive effort you made today in your reflection diary."
        
    else:  # Happy, Calm, Motivated
        advice['title'] = "Pacing & Growth Strategy"
        advice['points'].append("Excellent! You are in a highly productive state. Pacing is key to sustaining this momentum until exam day.")
        advice['points'].append("Use this focus to tackle a complex or heavier topic, but make sure to drink water and take structured study breaks.")
        advice['action_step'] = "Set a 50-minute focus session on the timer, then treat yourself to a favorite song or a stretch."

    # Trigger-specific adjustments
    trigger_tips = {
        "Syllabus Backlog": "Backlogs happen to everyone. Attempting to catch up in a single day causes panic. Allocate just 1 dedicated hour daily for backlog revision and keep the rest of your study schedule normal.",
        "Mock Test Results": "Mock tests are learning tools, not final scores. An error in a mock test is a gift—it is a concept you can fix now before the actual exam. Catalog your errors analytically, not emotionally.",
        "Time Management": "Time pressure is often task pressure. Break down large chapters into micro-tasks (e.g. 'read 3 pages' instead of 'finish organic chemistry'). This triggers positive feedback loops.",
        "Parental Pressure": "Expectations from loved ones can feel heavy. Remember that their anxiety often stems from care, even if expressed poorly. Focus on your effort, which is the only variable in your control.",
        "Sleep Deprivation": "Memory consolidation occurs during deep sleep. Sacrificing sleep to study is a losing trade: you'll struggle to retrieve what you revised. Commit to 7-8 hours of sleep.",
        "Peer Pressure": "Competitive exams invite comparison. But comparison is a distraction. Your only benchmark is your own yesterday. Protect your energy and study space.",
        "Uncertainty": "Focus entirely on the process, not the outcome. You cannot control the exam difficulty, the cutoffs, or other applicants. Focus only on the next page, page by page."
    }
    
    for trigger in triggers:
        if trigger in trigger_tips:
            advice['points'].append(trigger_tips[trigger])
            
    return advice

# Main Dashboard Route
@app.route('/')
@login_required
def dashboard():
    user = db.session.get(User, session['user_id'])
    
    # Get all logs for current user, descending by date
    logs = db.session.scalars(db.select(MoodLog).filter_by(user_id=user.id).order_by(MoodLog.timestamp.desc())).all()
    
    # Personalized advice based on latest log
    latest_log = logs[0] if logs else None
    latest_advice = None
    if latest_log:
        triggers_list = [t.trigger_name for t in latest_log.triggers]
        latest_advice = generate_personalized_advice(latest_log.mood_name, triggers_list, user.target_exam)
    
    # Prepare Analytics Data
    # 1. Last 7 logs for Mood Chart (reverse to chronological order for line graph)
    chart_logs = db.session.scalars(db.select(MoodLog).filter_by(user_id=user.id).order_by(MoodLog.timestamp.desc()).limit(7)).all()
    chart_logs.reverse()
    
    chart_data = {
        'labels': [log.timestamp.strftime('%d %b, %H:%M') for log in chart_logs],
        'scores': [log.mood_score for log in chart_logs],
        'moods': [log.mood_name for log in chart_logs]
    }
    
    # 2. Trigger Counts for pie/bar chart
    all_user_logs = db.session.scalars(db.select(MoodLog).filter_by(user_id=user.id)).all()
    trigger_counts = {}
    for log in all_user_logs:
        for t in log.triggers:
            trigger_counts[t.trigger_name] = trigger_counts.get(t.trigger_name, 0) + 1
            
    return render_template(
        'dashboard.html', 
        user=user, 
        logs=logs, 
        latest_log=latest_log, 
        latest_advice=latest_advice,
        chart_data=chart_data,
        trigger_counts=trigger_counts
    )

# Log Mood POST Action
@app.route('/log_mood', methods=['POST'])
@login_required
def log_mood():
    mood_name = request.form.get('mood_name')
    reflection = request.form.get('reflection', '').strip()
    selected_triggers = request.form.getlist('triggers')
    
    if not mood_name:
        flash('Please select a mood before saving.', 'danger')
        return redirect(url_for('dashboard'))
        
    # Map mood names to standard scores
    mood_scores = {
        'Happy': 5,
        'Motivated': 5,
        'Calm': 4,
        'Tired': 3,
        'Self-Doubt': 3,
        'Stressed': 2,
        'Anxious': 2,
        'Burned Out': 1
    }
    
    mood_score = mood_scores.get(mood_name, 3)
    
    new_log = MoodLog(
        user_id=session['user_id'],
        mood_name=mood_name,
        mood_score=mood_score,
        reflection=reflection,
        timestamp=datetime.now(timezone.utc)
    )
    
    db.session.add(new_log)
    db.session.flush()  # Gets the new_log.id
    
    # Add stress triggers
    for t_name in selected_triggers:
        trigger_record = StressTrigger(mood_log_id=new_log.id, trigger_name=t_name)
        db.session.add(trigger_record)
        
    try:
        db.session.commit()
        flash('Mood logged successfully!', 'success')
    except Exception as e:
        db.session.rollback()
        flash('Error saving log. Please try again.', 'danger')
        
    return redirect(url_for('dashboard'))

# Delete Log Action
@app.route('/delete_log/<int:log_id>', methods=['POST'])
@login_required
def delete_log(log_id):
    log = db.get_or_404(MoodLog, log_id)
    if log.user_id != session['user_id']:
        flash('Access denied.', 'danger')
        return redirect(url_for('dashboard'))
        
    db.session.delete(log)
    try:
        db.session.commit()
        flash('Log removed.', 'success')
    except Exception as e:
        db.session.rollback()
        flash('Could not delete log.', 'danger')
        
    return redirect(url_for('dashboard'))

# Wellness Tools Route
@app.route('/tools')
@login_required
def tools():
    return render_template('tools.html')

# Resources Route
@app.route('/resources')
@login_required
def resources():
    return render_template('resources.html')

# User Authentication Routes
@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
        
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        target_exam = request.form.get('target_exam', 'Board Exams')
        
        if not username or not password:
            flash('Please fill in all details.', 'danger')
            return render_template('register.html')
            
        if len(password) < 8:
            flash('Password must be at least 8 characters long.', 'danger')
            return render_template('register.html')
            
        existing_user = db.session.scalar(db.select(User).filter_by(username=username))
        if existing_user:
            flash('Username is already taken.', 'danger')
            return render_template('register.html')
            
        # Hash password and create user
        password_hash = generate_password_hash(password)
        new_user = User(username=username, password_hash=password_hash, target_exam=target_exam)
        db.session.add(new_user)
        
        try:
            db.session.commit()
            session['user_id'] = new_user.id
            flash(f'Welcome aboard, {username}! Start tracking your exam wellness.', 'success')
            return redirect(url_for('dashboard'))
        except Exception as e:
            db.session.rollback()
            flash('Registration failed. Please try again.', 'danger')
            
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
        
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        
        user = db.session.scalar(db.select(User).filter_by(username=username))
        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            flash(f'Logged in successfully. Welcome back!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password.', 'danger')
            
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    flash('You have logged out.', 'info')
    return redirect(url_for('login'))

# ==========================================================================
# Community & Peer Resilience Hub Routes
# ==========================================================================
@app.route('/community')
@login_required
def community():
    user = db.session.get(User, session['user_id'])
    
    # Query posts, newest first
    posts = db.session.scalars(db.select(CommunityPost).order_by(CommunityPost.created_at.desc())).all()
    
    # Process reactions and user states for templates
    processed_posts = []
    for post in posts:
        # Group reactions by type
        reaction_groups = {'me_too': 0, 'support': 0, 'hug': 0}
        user_reactions = []
        
        for r in post.reactions:
            reaction_groups[r.reaction_type] = reaction_groups.get(r.reaction_type, 0) + 1
            if r.user_id == user.id:
                user_reactions.append(r.reaction_type)
                
        processed_posts.append({
            'post': post,
            'reactions': reaction_groups,
            'user_reactions': user_reactions,
            'replies': post.replies
        })
        
    return render_template('community.html', posts=processed_posts)

@app.route('/community/post', methods=['POST'])
@login_required
def community_post():
    content = request.form.get('content', '').strip()
    stress_level_str = request.form.get('stress_level', '3')
    
    if not content:
        flash('Venting content cannot be empty.', 'danger')
        return redirect(url_for('community'))
        
    try:
        stress_level = int(stress_level_str)
    except ValueError:
        stress_level = 3
        
    user = db.session.get(User, session['user_id'])
    
    # Select a random calm/mindful avatar name
    import random
    avatars = [
        "Focused Owl", "Steady Phoenix", "Calm Dolphin", "Resilient Panda",
        "Tranquil Koala", "Serene Deer", "Mindful Eagle", "Patient Elephant",
        "Gentle Fox", "Determined Tiger", "Quiet Badger", "Steady Otter"
    ]
    alias = f"{random.choice(avatars)} ({user.target_exam} Aspirant)"
    
    new_post = CommunityPost(
        user_id=user.id,
        alias=alias,
        content=content,
        stress_level=stress_level,
        created_at=datetime.now(timezone.utc)
    )
    
    db.session.add(new_post)
    try:
        db.session.commit()
        flash('Shared with the community support circle.', 'success')
    except Exception as e:
        db.session.rollback()
        flash('Error sharing post.', 'danger')
        
    return redirect(url_for('community'))

@app.route('/community/react/<int:post_id>', methods=['POST'])
@login_required
def community_react(post_id):
    reaction_type = request.form.get('reaction_type')
    if reaction_type not in ['me_too', 'support', 'hug']:
        flash('Invalid reaction type.', 'danger')
        return redirect(url_for('community'))
        
    post = db.session.get(CommunityPost, post_id)
    if not post:
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'error': 'Post not found'}), 404
        flash('Post not found.', 'danger')
        return redirect(url_for('community'))
        
    user_id = session['user_id']
    
    # Check if user already reacted with this type
    existing = db.session.scalar(db.select(PostReaction).filter_by(
        post_id=post_id, 
        user_id=user_id, 
        reaction_type=reaction_type
    ))
    
    if existing:
        db.session.delete(existing)
        action = 'removed'
    else:
        new_reaction = PostReaction(
            post_id=post_id,
            user_id=user_id,
            reaction_type=reaction_type
        )
        db.session.add(new_reaction)
        action = 'added'
        
    try:
        db.session.commit()
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            # Count updated totals
            count = db.session.scalar(db.select(db.func.count(PostReaction.id)).filter_by(post_id=post_id, reaction_type=reaction_type))
            return jsonify({'success': True, 'action': action, 'count': count})
    except Exception as e:
        db.session.rollback()
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return jsonify({'success': False, 'error': 'Database error'})
            
    return redirect(url_for('community'))

@app.route('/community/reply/<int:post_id>', methods=['POST'])
@login_required
def community_reply(post_id):
    post = db.session.get(CommunityPost, post_id)
    if not post:
        flash('Post not found.', 'danger')
        return redirect(url_for('community'))
        
    content = request.form.get('content', '').strip()
    if not content:
        flash('Reply message cannot be empty.', 'danger')
        return redirect(url_for('community'))
        
    user = db.session.get(User, session['user_id'])
    alias = f"Anonymous Peer ({user.target_exam} Aspirant)"
    
    new_reply = PeerMessage(
        post_id=post_id,
        user_id=user.id,
        alias=alias,
        content=content,
        created_at=datetime.now(timezone.utc)
    )
    
    db.session.add(new_reply)
    try:
        db.session.commit()
        flash('Supportive message sent.', 'success')
    except Exception as e:
        db.session.rollback()
        flash('Failed to reply.', 'danger')
        
    return redirect(url_for('community'))

@app.route('/community/delete/<int:post_id>', methods=['POST'])
@login_required
def community_delete(post_id):
    post = db.get_or_404(CommunityPost, post_id)
    if post.user_id != session['user_id']:
        flash('Access denied.', 'danger')
        return redirect(url_for('community'))
        
    db.session.delete(post)
    try:
        db.session.commit()
        flash('Post removed from community board.', 'success')
    except Exception as e:
        db.session.rollback()
        flash('Error removing post.', 'danger')
        
    return redirect(url_for('community'))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
