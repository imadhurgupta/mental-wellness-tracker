import os
import unittest
from app import app, db
from models import User, MoodLog, StressTrigger, CommunityPost, PostReaction, PeerMessage

class WellnessTrackerTestCase(unittest.TestCase):
    def setUp(self):
        # Configure app for testing
        app.config['TESTING'] = True
        app.config['WTF_CSRF_ENABLED'] = False
        
        # Use an in-memory SQLite database for clean test runs
        app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
        self.app = app.test_client()
        
        with app.app_context():
            db.create_all()

    def tearDown(self):
        with app.app_context():
            db.session.remove()
            db.drop_all()

    def register(self, username, password, target_exam='JEE'):
        return self.app.post('/register', data=dict(
            username=username,
            password=password,
            target_exam=target_exam
        ), follow_redirects=True)

    def login(self, username, password):
        return self.app.post('/login', data=dict(
            username=username,
            password=password
        ), follow_redirects=True)

    def logout(self):
        return self.app.get('/logout', follow_redirects=True)

    def test_auth_and_pages(self):
        # 1. Test registration redirects/success
        response = self.register('student1', 'password123', 'NEET')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'student1', response.data)
        self.assertIn(b'NEET Prep', response.data)

        # 2. Test dashboard loads for logged-in user
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Student Sanctum', response.data)

        # 3. Test tools and resources pages
        response = self.app.get('/tools')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Box Breathing', response.data)

        response = self.app.get('/resources')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Exam Wellness Library', response.data)

    def test_mood_logging(self):
        # Register and login first
        self.register('student_log', 'password123', 'UPSC')
        
        # Log a mood
        response = self.app.post('/log_mood', data=dict(
            mood_name='Anxious',
            triggers=['Mock Test Results', 'Syllabus Backlog'],
            reflection='Struggling with history syllabus backlog.'
        ), follow_redirects=True)
        
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Anxiety Calming Protocol', response.data)
        self.assertIn(b'Struggling with history syllabus backlog.', response.data)
        self.assertIn(b'Syllabus Backlog', response.data)

    def test_community_hub(self):
        # 1. Register and login
        self.register('community_stud', 'password123', 'GATE')
        
        # 2. Get community board
        response = self.app.get('/community')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Community Support Circle', response.data)
        self.assertIn(b'guided audio', response.data)
        
        # 3. Post a stress vent loop
        response = self.app.post('/community/post', data=dict(
            content='My math backlog is huge!',
            stress_level='4'
        ), follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'My math backlog is huge!', response.data)
        self.assertIn(b'Stress Level: 4/5', response.data)
        
        # 4. Toggle a peer reaction
        with app.app_context():
            post = db.session.scalar(db.select(CommunityPost))
            post_id = post.id
            
        response = self.app.post(f'/community/react/{post_id}', data=dict(
            reaction_type='me_too'
        ), follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Me Too (<span class="reaction-count">1</span>)', response.data)
        
        # 5. Reply to the post
        response = self.app.post(f'/community/reply/{post_id}', data=dict(
            content='You got this, focus on formulas!'
        ), follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'You got this, focus on formulas!', response.data)
        
        # 6. Delete/withdraw post
        response = self.app.post(f'/community/delete/{post_id}', follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(b'My math backlog is huge!', response.data)
    def test_password_strength_validation(self):
        # Enforces min length of 8 characters and max of 128 characters
        response = self.register('student_short', 'pwd', 'JEE')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Password must be between 8 and 128 characters long.', response.data)
        
        # Valid password (8 characters)
        response = self.register('student_valid', 'password', 'JEE')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(b'Password must be between 8 and 128 characters long.', response.data)


    def test_nonexistent_post_reactions_and_replies(self):
        self.register('test_user_exist', 'password123', 'NEET')
        
        # Reaction to nonexistent post ID 9999
        response = self.app.post('/community/react/9999', data=dict(
            reaction_type='me_too'
        ), follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Post not found.', response.data)
        
        # Reply to nonexistent post ID 9999
        response = self.app.post('/community/reply/9999', data=dict(
            content='This is a comment.'
        ), follow_redirects=True)
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Post not found.', response.data)

    def test_security_headers(self):
        response = self.app.get('/login')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers.get('X-Frame-Options'), 'DENY')
        self.assertEqual(response.headers.get('X-Content-Type-Options'), 'nosniff')
        self.assertEqual(response.headers.get('Referrer-Policy'), 'strict-origin-when-cross-origin')
        self.assertIn("default-src 'self'", response.headers.get('Content-Security-Policy'))
    def test_csrf_protection(self):
        # Register/login first
        self.register('csrf_test_user', 'password123', 'NEET')
        
        # Disable TESTING flag on app temporarily to trigger CSRF validation
        app.config['TESTING'] = False
        try:
            # POST request without CSRF token
            response = self.app.post('/log_mood', data=dict(
                mood_name='Calm'
            ))
            # Should fail with 400 Bad Request
            self.assertEqual(response.status_code, 400)
            self.assertIn(b'CSRF token validation failed.', response.data)
            
            # Send with correct token
            with self.app.session_transaction() as sess:
                token = sess.get('csrf_token')
            
            response = self.app.post('/log_mood', data=dict(
                mood_name='Calm',
                csrf_token=token
            ), follow_redirects=True)
            self.assertEqual(response.status_code, 200)
        finally:
            # Restore testing mode
            app.config['TESTING'] = True


    def test_strict_parameter_validations(self):
        # 1. Test registration: Username length boundary
        response = self.register('a' * 31, 'password123', 'NEET')
        self.assertIn(b'Username must be 3-30 characters', response.data)
        
        response = self.register('ab', 'password123', 'NEET')
        self.assertIn(b'Username must be 3-30 characters', response.data)
        
        # 2. Test registration: Invalid username characters
        response = self.register('user_name@123', 'password123', 'NEET')
        self.assertIn(b'Username must be 3-30 characters', response.data)
        
        # 3. Test registration: Password length limits
        response = self.register('valid_user', 'p' * 129, 'NEET')
        self.assertIn(b'Password must be between 8 and 128 characters long.', response.data)
        
        # 4. Test registration: Invalid exam option
        response = self.register('valid_user2', 'password123', 'NOT_AN_EXAM')
        self.assertIn(b'Invalid target examination selected.', response.data)
        
        # Register valid user for login & mood log validation
        self.register('valid_user_log', 'password123', 'NEET')

        # 5. Test log_mood: Invalid mood name
        response = self.app.post('/log_mood', data=dict(
            mood_name='SuperHappy',
            triggers=[],
            reflection='Good vibes'
        ), follow_redirects=True)
        self.assertIn(b'Invalid mood selection.', response.data)
        
        # 6. Test log_mood: Too long reflection (limit 2000)
        response = self.app.post('/log_mood', data=dict(
            mood_name='Calm',
            triggers=[],
            reflection='a' * 2001
        ), follow_redirects=True)
        self.assertIn(b'Diary reflection must be at most 2000 characters.', response.data)
        
        # 7. Test log_mood: Invalid stress trigger choice
        response = self.app.post('/log_mood', data=dict(
            mood_name='Calm',
            triggers=['NOT_A_TRIGGER'],
            reflection='Good vibes'
        ), follow_redirects=True)
        self.assertIn(b'Invalid stress trigger selection detected.', response.data)

    def test_community_post_parameter_validations(self):
        self.register('comm_post_user', 'password123', 'NEET')
        
        # 1. Test community post: Too long content (> 1000)
        response = self.app.post('/community/post', data=dict(
            content='a' * 1001,
            stress_level='3'
        ), follow_redirects=True)
        self.assertIn(b'Venting content must be between 1 and 1000 characters.', response.data)
        
        # 2. Test community post: Invalid stress level (e.g. 6 or negative)
        response = self.app.post('/community/post', data=dict(
            content='Valid stress content',
            stress_level='6'
        ), follow_redirects=True)
        self.assertIn(b'Stress level must be an integer between 1 and 5.', response.data)
        
        response = self.app.post('/community/post', data=dict(
            content='Valid stress content',
            stress_level='not_integer'
        ), follow_redirects=True)
        self.assertIn(b'Stress level must be an integer between 1 and 5.', response.data)

        # Post a valid community message first
        self.app.post('/community/post', data=dict(
            content='Valid community post content',
            stress_level='3'
        ), follow_redirects=True)
        
        with app.app_context():
            post = db.session.scalar(db.select(CommunityPost))
            post_id = post.id
            
        # 3. Test community reaction: Invalid reaction type
        response = self.app.post(f'/community/react/{post_id}', data=dict(
            reaction_type='angry'
        ), follow_redirects=True)
        self.assertIn(b'Invalid reaction type.', response.data)

        # 4. Test community reply: Too long content (> 250)
        response = self.app.post(f'/community/reply/{post_id}', data=dict(
            content='a' * 251
        ), follow_redirects=True)
        self.assertIn(b'Reply content must be between 1 and 250 characters.', response.data)

    def test_session_fixation_mitigation(self):
        # 1. Register/Login and check if session has user_id
        response = self.register('session_user', 'password123', 'JEE')
        self.assertIn(b'session_user', response.data)
        
        with self.app.session_transaction() as sess:
            self.assertIn('user_id', sess)
            old_user_id = sess['user_id']
            # Put some old session noise
            sess['noise'] = 'old_value'
            
        # 2. Logout should clear session completely
        self.logout()
        with self.app.session_transaction() as sess:
            self.assertNotIn('user_id', sess)
            self.assertNotIn('noise', sess)

        # 3. Login should regenerate/clear session completely and set user_id
        self.login('session_user', 'password123')
        with self.app.session_transaction() as sess:
            self.assertIn('user_id', sess)
            self.assertEqual(sess['user_id'], old_user_id)
            self.assertNotIn('noise', sess)

if __name__ == '__main__':
    unittest.main()
