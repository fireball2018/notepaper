#!/usr/bin/env python
# encoding: utf-8
"""
website.py

Created by Jerry on 2011-04-19.
Copyright (c) 2011 __MyCompanyName__. All rights reserved.
"""
import sys
import os
import logging
import random
import hashlib
import re
from datetime import datetime
from urllib import unquote, quote_plus

sys.path.append(os.path.join(os.path.dirname(__file__), 'lib'))

from google.appengine.ext import webapp
from google.appengine.ext.webapp import util
from google.appengine.ext import db
from google.appengine.api import memcache

from jinja2 import Environment, FileSystemLoader
from cookies import Cookies
from l10n import GetMessages,GetSupportedLanguages
import markdown

class Taskpad(db.Model):
    pad_name = db.StringProperty()
    share_name = db.StringProperty()
    password = db.StringProperty()
    contents = db.TextProperty()
    caret_position = db.IntegerProperty()
    scroll_position = db.IntegerProperty()
    created = db.DateTimeProperty()
    updated = db.DateTimeProperty()

class BaseHandler(webapp.RequestHandler):
    
    blocked_names = ['admin', 'user', 'u', 'login', 'logout', 'password', 'share', 'app', 'rename', 'check_if_name_exists',
            'name', 'taskpad', 'todo', 'tasks', 'ads', 'feed', 'rss', 'auth', 'html', 'xml', 'ajax', 'static', 'data', 'js',
            'search', 'list', 'find']
    
    def write(self, content):
        """docstring for write"""
        
        self.response.out.write(content)
    
    def render(self, template_name, **kargs):
        """docstring for render"""
        
        self.write(self.render_string(template_name, **kargs))
        
    def render_string(self, template_name, **kargs):
        """docstring for render_string"""
        
        template = Environment(loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), 'views'))).get_template(template_name)
        
        host = self.request.headers['HOST']
        
        if not host.startswith("localhost"):
            host = "taskpad.me"
        
        l10n = GetMessages(self, self.accept_lang)
        
        return template.render(
                user_browser=self.user_browser,
                domain = host,
                l10n = l10n,
                **kargs)
    
    @property
    def user_browser(self):
        """docstring for user_browser"""
        try:
            user_agent = self.request.headers['User-Agent']

            if user_agent.lower().find('kindle') > 0:
                return "kindle"
            elif user_agent.lower().find('iphone') > 0:
                return "iphone"
            elif user_agent.lower().find('firefox') > 0:
                return "firefox"
            elif user_agent.lower().find('chrome') > 0:
                return "chrome"
            elif user_agent.lower().find('safari') > 0:
                return "safari"
            elif user_agent.lower().find('MSIE 6.0') > 0:
                return "ie6"
            elif user_agent.lower().find('MSIE 7.0') > 0:
                return "ie7"
            elif user_agent.lower().find('MSIE 8.0') > 0:
                return "ie8"
            elif user_agent.lower().find('MSIE 9.0') > 0:
                return "ie9"
            else:
                return False
        except Exception, e:
            return "unkown"
    
    @property
    def accept_lang(self):
        """docstring for bwr_lang"""

        langs = GetSupportedLanguages()
        lang = self.request.get('lang')

        if lang and lang in langs:
            self.cookies['lang'] = lang
            return lang

        if 'lang' in self.cookies and self.cookies['lang'] in langs:
            return self.cookies['lang']

        try:
            accept_language = self.request.headers['Accept-Language']
        except:
            accept_language = "zh"

        return accept_language
    
    @property
    def cookies(self):
        """docstring for cookies"""

        return Cookies(self, max_age = 315360000, path = '/')
    
    def random_str(self, str_len=5, t=1):
        """docstring for random_str"""
        
        letters = "abcdefghigklmnoporstuvwxyz"
        numbers = "0123456789"
        upper_case = "ABCDEFGHIGKLMNOPORSTUVWXYZ"
        
        if t is 1:
            feed = letters+numbers
        else:
            feed = letters+upper_case+numbers
            
        return "".join(random.sample(feed, str_len))
        
    def new_pad_name(self):
        """docstring for new_pad_name"""
        
        pad_name = self.random_str(random.randint(5,7))
        pad = self.get_by_pad_name(pad_name)
        
        if pad or pad_name in self.blocked_names:
            return self.new_pad_name()
        else:
            return pad_name
    
    def new_share_name(self):
        """docstring for new_share_name"""
        
        share_name = self.random_str(random.randint(6,8))
        pad = self.get_by_share_name(share_name)
        
        if pad or share_name in self.blocked_names:
            return self.new_share_name()
        else:
            return share_name
    
    def get_by_pad_name(self, pad_name):
        """docstring for get_pad_by_name"""
        return Taskpad.get_by_key_name(pad_name)
        
    def get_by_share_name(self, share_name):
        """docstring for get_pad_by_name"""
        
        pad = Taskpad.gql("WHERE share_name =:1", share_name).fetch(limit=1)
        
        if pad:
            return pad[0]
        else:
            return None
    
    def new_pad(self, pad_name=None, share_name=None, caret_position=0,
        scroll_position=0, password='', contents='', created=None, updated=None):
        """docstring for new_pad"""
        
        if pad_name is None:
            pad_name = self.new_pad_name()
        
        if share_name is None:
            share_name = self.new_share_name()
            
        if created is None:
            created = datetime.now()
        
        if updated is None:
            updated = datetime.now()
        
        pad = Taskpad(key_name=pad_name)
        pad.pad_name = pad_name
        pad.share_name = share_name
        pad.caret_position = caret_position
        pad.scroll_position = scroll_position
        pad.password = password
        pad.contents = contents
        pad.created = created
        pad.updated = updated
        
        pad.put()
        
        return pad
        
    def is_auth(self, pad_name, password):
        """docstring for is_auth"""

        if not password:
            return True

        ck = 'pp_%s' % hashlib.sha1( pad_name ).hexdigest()
        
        if ck in self.cookies and self.cookies[ck] == hashlib.sha1( pad_name + password ).hexdigest():
            return True
        else:
            return False
    
    def add_auth(self, pad_name, password):
        """docstring for add_auth"""
        
        ck = 'pp_%s' % hashlib.sha1( pad_name ).hexdigest()
        self.cookies[ck] = hashlib.sha1( pad_name + password ).hexdigest()
        
    def remove_auth(self, pad_name):
        """docstring for remove_auth"""
        
        ck = 'pp_%s' % hashlib.sha1( pad_name ).hexdigest()
        del self.cookies[ck]
        
        
class MainHandler(BaseHandler):
    """docstring for MainHandler"""

    def get(self):
        """docstring for get"""
        
        pad = self.new_pad()
        self.redirect("/%s" % pad.pad_name)

class PadHandler(BaseHandler):
    """docstring for MainHandler"""
    
    def get(self, pad_name):
        """docstring for get"""
        
        pad = self.get_by_pad_name(pad_name)
        
        if not pad:
            pad = self.new_pad(pad_name)
            
        if not self.is_auth(pad.pad_name, pad.password):
            self.redirect("/login/%s" % pad.pad_name)
        
        self.render('taskpad.html', pad_name=pad_name, pad=pad)
    
    def post(self, pad_name):
        """docstring for post"""
        
        pad = self.get_by_pad_name(pad_name)
        
        if not pad:
            self.write("pad_not_exists")
        elif not self.is_auth(pad.pad_name, pad.password):
            self.response.set_status(403)
        else:
            contents = self.request.get('contents')
            caret_position = self.request.get('caret_position', 0)
            scroll_position = self.request.get('scroll_position', 0)
            
            if caret_position.isdigit():
                caret_position = int(caret_position)
            else:
                caret_position = 0
            
            if scroll_position.isdigit():
                scroll_position = int(scroll_position)
            else:
                scroll_position = 0
            
            pad.contents = contents
            pad.caret_position = caret_position
            pad.scroll_position = scroll_position
            pad.updated = datetime.now()
            pad.put()
            
            self.write("ok")

class CheckNameHandler(BaseHandler):
    """docstring for CheckNameHandler"""
    
    def post(self, pad_name):
        """docstring for get"""
        
        pad = self.get_by_pad_name(pad_name)
        
        if pad or len(pad_name) < 3 or pad_name in self.blocked_names:
            self.write("true")
        else:
            self.write("false")

class RenameHandler(BaseHandler):
    """docstring for RenameHandler"""
    
    def post(self, pad_name):
        """docstring for post"""
        
        new_name = self.request.get('new_name')
        
        old_pad = self.get_by_pad_name(pad_name)
        ex_pad = self.get_by_pad_name(new_name)
        
        if ex_pad:
            self.redirect("/%s" % pad_name)
            return
        elif old_pad and new_name != old_pad.pad_name \
            and (not old_pad.password or self.is_auth(old_pad.pad_name, old_pad.password)):
            self.new_pad(
                    pad_name = new_name, 
                    share_name = old_pad.share_name,
                    password = old_pad.password,
                    contents = old_pad.contents,
                    caret_position = old_pad.caret_position,
                    scroll_position = old_pad.scroll_position,
                    created = old_pad.created,
                    updated = datetime.now()
                )
                
            self.remove_auth(pad_name)
            self.add_auth(new_name, old_pad.password)
            
            # remove old pad
            old_pad.delete()
        
        self.redirect("/%s" % new_name)
        
class PasswordHandler(BaseHandler):
    """docstring for PasswordHandler"""
    
    def get(self, action, pad_name):
        """docstring for get"""
        self.post(action, pad_name)
    
    def post(self, action, pad_name):
        """docstring for post"""
        
        pad = self.get_by_pad_name(pad_name)
        
        if pad:
            if action == 'set':
                password = self.request.get('password')
                pad.password = hashlib.md5(password).hexdigest()
                pad.put()
                self.add_auth(pad.pad_name, pad.password)
                
            elif action == 'remove' \
                and (not pad.password or self.is_auth(pad.pad_name, pad.password)):
                
                pad.password = ''
                pad.put()
                self.remove_auth(pad_name)

        self.redirect("/%s" % pad.pad_name)

class ShareHandler(BaseHandler):
    """docstring for ShareHandler"""
    
    def get(self, share_name):
        """docstring for get"""
        
        pad = self.get_by_share_name(share_name)
        
        if pad:
            
            if pad.contents.startswith("!#markdown\n"):
                pad.contents = markdown.markdown(pad.contents[11:])
            
            self.render('share.html', pad_name=False, read_only_mode=True, pad=pad)
        else:
            self.render('error.html')
        
class LoginHandler(BaseHandler):
    """docstring for MainHandler"""

    def get(self, pad_name):
        """docstring for get"""
        
        pad = self.get_by_pad_name(pad_name)
        
        if not pad or not pad.password or self.is_auth(pad.pad_name, pad.password):
            self.redirect("/%s" % pad.pad_name)
        else:
            self.render('login.html', pad_name=pad_name)
    
    def post(self, pad_name):
        """docstring for post"""
        
        pad = self.get_by_pad_name(pad_name)

        if not pad or not pad.password or self.is_auth(pad.pad_name, pad.password):
            self.redirect("/%s" % pad_name)
        else:
            password = self.request.get('pad_password')
            
            if hashlib.md5(password).hexdigest() == pad.password:
                self.add_auth(pad.pad_name, pad.password)
                self.redirect("/%s" % pad.pad_name)
            else:
                self.render('login.html', pad_name=pad_name, error=True)
        
class LogoutHandler(BaseHandler):
    """docstring for LogoutHandler"""
    
    def get(self, pad_name):
        """docstring for get"""
        
        pad = self.get_by_pad_name(pad_name)

        if not pad or not pad.password:
            self.redirect("/%s" % pad_name)
        else:
            self.remove_auth(pad_name)
            self.redirect("/login/%s" % pad.pad_name)
        
class ErrorHandler(BaseHandler):
    """docstring for MainHandler"""

    def get(self):
        """docstring for get"""
        self.render('error.html')

def main():
    logging.getLogger().setLevel(logging.INFO)
    application = webapp.WSGIApplication([
                        ('/', MainHandler),
                        ('/login/([a-zA-Z0-9]+)', LoginHandler),
                        ('/logout/([a-zA-Z0-9]+)', LogoutHandler),
                        ('/share/([a-zA-Z0-9]+)', ShareHandler),
                        ('/check_if_name_exists/([a-zA-Z0-9]+)', CheckNameHandler),
                        ('/rename/([a-zA-Z0-9]+)', RenameHandler),
                        ('/password/(set|remove)/([a-zA-Z0-9]+)', PasswordHandler),
                        ('/(admin|blog|error|logout)', ErrorHandler),
                        ('/([a-zA-Z0-9]+)', PadHandler),
                        ('/.*', ErrorHandler),
                    ], debug=True)
                    
    util.run_wsgi_app(application)

if __name__ == '__main__':
    main()