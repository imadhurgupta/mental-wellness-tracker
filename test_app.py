import os
import unittest
from app import app, db
from models import User, MoodLog, StressTrigger

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
        self.register('student_log', 'pass123', 'UPSC')
        
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

if __name__ == '__main__':
    unittest.main()
