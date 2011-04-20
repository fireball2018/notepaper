# coding=utf-8

import logging

# About language detecting logic:
#
# Step 1: if member.l10n is not empty/false, use it as the best choice
#
# Step 2: if Accept-Language header has something interesting, use it as the second choice
#
# Step 3: Fallback to site.l10n

def GetMessages(handler, lang='zh' ):
    if lang.startswith('en'):
        from l10n.messages import en as messages
        return messages
    else:
        from l10n.messages import zh as messages
        return messages

def GetSupportedLanguages():
    return ['en', 'zh']

def GetSupportedLanguagesNames():
    return {'en' : 'English', 'zh' : u'简体中文'}
    
def GetLanguageSelect(current):
    lang = GetSupportedLanguages()
    names = GetSupportedLanguagesNames()
    s = '<select name="l10n">'
    for l in lang:
        if l == current:
            s = s + '<option value="' + l + '" selected="selected">' + names[l] + '</option>'
        else:
            s = s + '<option value="' + l + '">' + names[l] + '</option>'
    s = s + '</select>'
    return s