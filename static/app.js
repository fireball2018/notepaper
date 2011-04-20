// jquery.textarea.js
(function($) {
	$.fn.tabby = function(options) {
		//debug(this);
		// build main options before element iteration
		var opts = $.extend({}, $.fn.tabby.defaults, options);
		var pressed = $.fn.tabby.pressed; 
		
		// iterate and reformat each matched element
		return this.each(function() {
			$this = $(this);
			
			// build element specific options
			var options = $.meta ? $.extend({}, opts, $this.data()) : opts;
			
			$this.bind('keydown',function (e) {
				var kc = $.fn.tabby.catch_kc(e);
				if (16 == kc) pressed.shft = true;
				/*
				because both CTRL+TAB and ALT+TAB default to an event (changing tab/window) that 
				will prevent js from capturing the keyup event, we'll set a timer on releasing them.
				*/
				if (17 == kc) {pressed.ctrl = true;	setTimeout("$.fn.tabby.pressed.ctrl = false;",1000);}
				if (18 == kc) {pressed.alt = true; 	setTimeout("$.fn.tabby.pressed.alt = false;",1000);}
					
				if (9 == kc && !pressed.ctrl && !pressed.alt) {
					e.preventDefault; // does not work in O9.63 ??
					pressed.last = kc;	setTimeout("$.fn.tabby.pressed.last = null;",0);
					process_keypress ($(e.target).get(0), pressed.shft, options);
					return false;
				}
				
			}).bind('keyup',function (e) {
				if (16 == $.fn.tabby.catch_kc(e)) pressed.shft = false;
			}).bind('blur',function (e) { // workaround for Opera -- http://www.webdeveloper.com/forum/showthread.php?p=806588
				if (9 == pressed.last) $(e.target).one('focus',function (e) {pressed.last = null;}).get(0).focus();
			});
		
		});
	};
	
	// define and expose any extra methods
	$.fn.tabby.catch_kc = function(e) { return e.keyCode ? e.keyCode : e.charCode ? e.charCode : e.which; };
	$.fn.tabby.pressed = {shft : false, ctrl : false, alt : false, last: null};
	
	// private function for debugging
	function debug($obj) {
		if (window.console && window.console.log)
		window.console.log('textarea count: ' + $obj.size());
	};

	function process_keypress (o,shft,options) {
		var scrollTo = o.scrollTop;
		//var tabString = String.fromCharCode(9);
		
		// gecko; o.setSelectionRange is only available when the text box has focus
		if (o.setSelectionRange) gecko_tab (o, shft, options);
		
		// ie; document.selection is always available
		else if (document.selection) ie_tab (o, shft, options);
		
		o.scrollTop = scrollTo;
	}
	
	// plugin defaults
	$.fn.tabby.defaults = {tabString : String.fromCharCode(9)};
	
	function gecko_tab (o, shft, options) {
		var ss = o.selectionStart;
		var es = o.selectionEnd;	
				
		// when there's no selection and we're just working with the caret, we'll add/remove the tabs at the caret, providing more control
		if(ss == es) {
			// SHIFT+TAB
			if (shft) {
				// check to the left of the caret first
				if ("\t" == o.value.substring(ss-options.tabString.length, ss)) {
					o.value = o.value.substring(0, ss-options.tabString.length) + o.value.substring(ss); // put it back together omitting one character to the left
					o.focus();
					o.setSelectionRange(ss - options.tabString.length, ss - options.tabString.length);
				} 
				// then check to the right of the caret
				else if ("\t" == o.value.substring(ss, ss + options.tabString.length)) {
					o.value = o.value.substring(0, ss) + o.value.substring(ss + options.tabString.length); // put it back together omitting one character to the right
					o.focus();
					o.setSelectionRange(ss,ss);
				}
			}
			// TAB
			else {			
				o.value = o.value.substring(0, ss) + options.tabString + o.value.substring(ss);
				o.focus();
	    		o.setSelectionRange(ss + options.tabString.length, ss + options.tabString.length);
			}
		} 
		// selections will always add/remove tabs from the start of the line
		else {
			// split the textarea up into lines and figure out which lines are included in the selection
			var lines = o.value.split("\n");
			var indices = new Array();
			var sl = 0; // start of the line
			var el = 0; // end of the line
			var sel = false;
			for (var i in lines) {
				el = sl + lines[i].length;
				indices.push({start: sl, end: el, selected: (sl <= ss && el > ss) || (el >= es && sl < es) || (sl > ss && el < es)});
				sl = el + 1;// for "\n"
			}
			
			// walk through the array of lines (indices) and add tabs where appropriate						
			var modifier = 0;
			for (var i in indices) {
				if (indices[i].selected) {
					var pos = indices[i].start + modifier; // adjust for tabs already inserted/removed
					// SHIFT+TAB
					if (shft && options.tabString == o.value.substring(pos,pos+options.tabString.length)) { // only SHIFT+TAB if there's a tab at the start of the line
						o.value = o.value.substring(0,pos) + o.value.substring(pos + options.tabString.length); // omit the tabstring to the right
						modifier -= options.tabString.length;
					}
					// TAB
					else if (!shft) {
						o.value = o.value.substring(0,pos) + options.tabString + o.value.substring(pos); // insert the tabstring
						modifier += options.tabString.length;
					}
				}
			}
			o.focus();
			var ns = ss + ((modifier > 0) ? options.tabString.length : (modifier < 0) ? -options.tabString.length : 0);
			var ne = es + modifier;
			o.setSelectionRange(ns,ne);
		}
	}
	
	function ie_tab (o, shft, options) {
		var range = document.selection.createRange();
		
		if (o == range.parentElement()) {
			// when there's no selection and we're just working with the caret, we'll add/remove the tabs at the caret, providing more control
			if ('' == range.text) {
				// SHIFT+TAB
				if (shft) {
					var bookmark = range.getBookmark();
					//first try to the left by moving opening up our empty range to the left
				    range.moveStart('character', -options.tabString.length);
				    if (options.tabString == range.text) {
				    	range.text = '';
				    } else {
				    	// if that didn't work then reset the range and try opening it to the right
				    	range.moveToBookmark(bookmark);
				    	range.moveEnd('character', options.tabString.length);
				    	if (options.tabString == range.text) 
				    		range.text = '';
				    }
				    // move the pointer to the start of them empty range and select it
				    range.collapse(true);
					range.select();
				}
				
				else {
					// very simple here. just insert the tab into the range and put the pointer at the end
					range.text = options.tabString; 
					range.collapse(false);
					range.select();
				}
			}
			// selections will always add/remove tabs from the start of the line
			else {
			
				var selection_text = range.text;
				var selection_len = selection_text.length;
				var selection_arr = selection_text.split("\r\n");
				
				var before_range = document.body.createTextRange();
				before_range.moveToElementText(o);
				before_range.setEndPoint("EndToStart", range);
				var before_text = before_range.text;
				var before_arr = before_text.split("\r\n");
				var before_len = before_text.length; // - before_arr.length + 1;
				
				var after_range = document.body.createTextRange();
				after_range.moveToElementText(o);
				after_range.setEndPoint("StartToEnd", range);
				var after_text = after_range.text; // we can accurately calculate distance to the end because we're not worried about MSIE trimming a \r\n
				
				var end_range = document.body.createTextRange();
				end_range.moveToElementText(o);
				end_range.setEndPoint("StartToEnd", before_range);
				var end_text = end_range.text; // we can accurately calculate distance to the end because we're not worried about MSIE trimming a \r\n
								
				var check_html = $(o).html();
				$("#r3").text(before_len + " + " + selection_len + " + " + after_text.length + " = " + check_html.length);				
				if((before_len + end_text.length) < check_html.length) {
					before_arr.push("");
					before_len += 2; // for the \r\n that was trimmed	
					if (shft && options.tabString == selection_arr[0].substring(0,options.tabString.length))
						selection_arr[0] = selection_arr[0].substring(options.tabString.length);
					else if (!shft) selection_arr[0] = options.tabString + selection_arr[0];	
				} else {
					if (shft && options.tabString == before_arr[before_arr.length-1].substring(0,options.tabString.length)) 
						before_arr[before_arr.length-1] = before_arr[before_arr.length-1].substring(options.tabString.length);
					else if (!shft) before_arr[before_arr.length-1] = options.tabString + before_arr[before_arr.length-1];
				}
				
				for (var i = 1; i < selection_arr.length; i++) {
					if (shft && options.tabString == selection_arr[i].substring(0,options.tabString.length))
						selection_arr[i] = selection_arr[i].substring(options.tabString.length);
					else if (!shft) selection_arr[i] = options.tabString + selection_arr[i];
				}
				
				if (1 == before_arr.length && 0 == before_len) {
					if (shft && options.tabString == selection_arr[0].substring(0,options.tabString.length))
						selection_arr[0] = selection_arr[0].substring(options.tabString.length);
					else if (!shft) selection_arr[0] = options.tabString + selection_arr[0];
				}

				if ((before_len + selection_len + after_text.length) < check_html.length) {
					selection_arr.push("");
					selection_len += 2; // for the \r\n that was trimmed
				}
				
				before_range.text = before_arr.join("\r\n");
				range.text = selection_arr.join("\r\n");
				
				var new_range = document.body.createTextRange();
				new_range.moveToElementText(o);
				
				if (0 < before_len)	new_range.setEndPoint("StartToEnd", before_range);
				else new_range.setEndPoint("StartToStart", before_range);
				new_range.setEndPoint("EndToEnd", range);
				
				new_range.select();
				
			} 
		}
	}

// end of closure
})(jQuery);

// jquery.observe_field.js
(function( $ ){

  jQuery.fn.observe_field = function(frequency, callback) {

    frequency = frequency * 1000; // translate to milliseconds

    return this.each(function(){
      var $this = $(this);
      var prev = $this.val();

      var check = function() {
        var val = $this.val();
        if(prev != val){
          prev = val;
          $this.map(callback); // invokes the callback on $this
        }
      };

      var reset = function() {
        if(ti){
          clearInterval(ti);
          ti = setInterval(check, frequency);
        }
      };

      check();
      var ti = setInterval(check, frequency); // invoke check periodically

      // reset counter after user interaction
      $this.bind('keyup click mousemove', reset); //mousemove is for selects
    });
  };
})( jQuery );


function htmlspecialchars(string, quote_style, charset, double_encode) {
    // http://kevin.vanzonneveld.net
    // +   original by: Mirek Slugen
    // +   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +   bugfixed by: Nathan
    // +   bugfixed by: Arno
    // +    revised by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // +    bugfixed by: Brett Zamir (http://brett-zamir.me)
    // +      input by: Ratheous
    // +      input by: Mailfaker (http://www.weedem.fr/)
    // +      reimplemented by: Brett Zamir (http://brett-zamir.me)
    // +      input by: felix
    // +    bugfixed by: Brett Zamir (http://brett-zamir.me)
    // %        note 1: charset argument not supported
    // *     example 1: htmlspecialchars("<a href='test'>Test</a>", 'ENT_QUOTES');
    // *     returns 1: '&lt;a href=&#039;test&#039;&gt;Test&lt;/a&gt;'
    // *     example 2: htmlspecialchars("ab\"c'd", ['ENT_NOQUOTES', 'ENT_QUOTES']);
    // *     returns 2: 'ab"c&#039;d'
    // *     example 3: htmlspecialchars("my "&entity;" is still here", null, null, false);
    // *     returns 3: 'my &quot;&entity;&quot; is still here'

    var optTemp = 0, i = 0, noquotes= false;
    if (typeof quote_style === 'undefined' || quote_style === null) {
        quote_style = 2;
    }
    string = string.toString();
    if (double_encode !== false) { // Put this first to avoid double-encoding
        string = string.replace(/&/g, '&amp;');
    }
    string = string.replace(/</g, '&lt;').replace(/>/g, '&gt;');

    var OPTS = {
        'ENT_NOQUOTES': 0,
        'ENT_HTML_QUOTE_SINGLE' : 1,
        'ENT_HTML_QUOTE_DOUBLE' : 2,
        'ENT_COMPAT': 2,
        'ENT_QUOTES': 3,
        'ENT_IGNORE' : 4
    };
    if (quote_style === 0) {
        noquotes = true;
    }
    if (typeof quote_style !== 'number') { // Allow for a single string or an array of string flags
        quote_style = [].concat(quote_style);
        for (i=0; i < quote_style.length; i++) {
            // Resolve string input to bitwise e.g. 'PATHINFO_EXTENSION' becomes 4
            if (OPTS[quote_style[i]] === 0) {
                noquotes = true;
            }
            else if (OPTS[quote_style[i]]) {
                optTemp = optTemp | OPTS[quote_style[i]];
            }
        }
        quote_style = optTemp;
    }
    if (quote_style & OPTS.ENT_HTML_QUOTE_SINGLE) {
        string = string.replace(/'/g, '&#039;');
    }
    if (!noquotes) {
        string = string.replace(/"/g, '&quot;');
    }

    return string;
}

function auto_resize(el) {
    // http://googlecode.blogspot.com/2009/07/gmail-for-mobile-html5-series.html
    
    var TEXTAREA_LINE_HEIGHT = 13;
    
    var textarea = document.getElementById(el);
    var newHeight = textarea.scrollHeight;
    var currentHeight = textarea.clientHeight;

    if (newHeight > currentHeight) {
        textarea.style.height = newHeight + (2 * TEXTAREA_LINE_HEIGHT) + 'px';
    }
}

function unix_timestamp() {
    return Math.round(new Date().getTime() / 1000);
}

function get_caret_position(el) {
    
    el = document.getElementById(el)
    
    if (! el) return false;
    
    if (el.selectionStart) {
        return el.selectionStart;
    } else if (document.selection) {
        el.focus();
        
        var r = document.selection.createRange();
        if (r == null) {
            return 0;
        }
        
        var re = el.createTextRange(),
        rc = re.duplicate();
        re.moveToBookmark(r.getBookmark());
        rc.setEndPoint('EndToStart', re);
        
        return rc.text.length;
    }
    return 0;
}

function set_caret_position(el, pos){
    
    el = document.getElementById(el)
    
    if (! el ) return false;
    
    if (el.setSelectionRange) {
        el.focus();
        el.setSelectionRange(pos, pos);
    } else if (el.createTextRange) {
        var range = el.createTextRange();
        range.collapse(true);
        range.moveEnd('character', pos);
        range.moveStart('character', pos);
        range.select();
    }
}

function get_scroll_position(el) {
    if (! $("#"+el)) return false;

    return $("#"+el).scrollTop();
}

function set_scroll_position(el, pos) {
    if (! $("#"+el)) return false;
    
    $("#"+el).scrollTop(pos);
}

var checking_if_name_exists = false;

function validate_name_exists() {
    just_clicked_bubble = true;
    
    if (! $('#change_url_input')) return false;
    el = $('#change_url_input');
    
    var new_pad_name = el.val();
    new_pad_name = new_pad_name.toLowerCase().replace("'", '').replace(/[^-a-z0-9]/g, '-').replace(/--+/g, '-').replace(/^-+|-+$/g, '').substr(0,50);
    
    if (new_pad_name == '' || new_pad_name == pad_name) {
        $('#bubble_for_change_url').hide();
        $('#message_for_change_url_unavailable').hide();
        
        el.val(pad_name);
    } else {
        if (! checking_if_name_exists) {
            el.addClass('loading');
            
            $.ajax({
               type: "POST",
               url: '/check_if_name_exists/' + new_pad_name,
               success: function(result){
                   checking_if_name_exists = false;
                   if (result == 'false') {
                       $('#message_for_change_url_unavailable').hide();
                       $('#form_for_set_name').submit();
                   } else {
                       $('#bubble_for_change_url').show();
                       $('#message_for_change_url_unavailable').show();
                       el.removeClass('loading');
                       $('#change_url_input').select();
                   }
               }
             });
        }
    }
    
    return false;
}

function _update_contents(contents_value) {
    // Immediately save contents
        
    if (saving_pad || ((last_saved_on + seconds_before_save) > unix_timestamp()) ) {
        return true;
    }
    
    window.clearTimeout(update_contents_timeout);
    
    saving_pad = true;
    unsaved_changes = false;
    last_saved_on = unix_timestamp();
    
    $('#unsaved').hide();
    $('#loading').show();
    
    caret_position = get_caret_position('contents');
    scroll_position = get_scroll_position('contents');
    
    $.ajax({
       type: "POST",
       url: '/' + pad_name,
       data: {contents: contents_value,
           caret_position: caret_position,
           scroll_position: scroll_position
       },
       success: function(result, event){
           if ( result == 'ok') {
               
               chars_on_last_save = contents_value.length;
               saving_pad = false;
               $('#loading').hide();
               return false
               
           } else {
               $('#unsaved').show();
               alert(l10n.save_contents_failed);
           }
       },
       error: function(event){
           $('#unsaved').show();
           if (403 == event.status) {
                alert(l10n.logged_out);
                disable_autosave = true;
                if (contents_observer) contents_observer = false;
                if (update_contents_timeout) update_contents_timeout = false;
            } else {
                alert(l10n.save_contents_failed);
            }
       }
     });
}

function _determine_update_contents(contents_value) {
    window.clearTimeout(update_contents_timeout);
    
    update_contents_timeout = window.setTimeout(function() {
      return _update_contents(contents_value)
    }, seconds_before_save);
    
    if (Math.abs(chars_on_last_save - contents_value.length) > new_chars_before_save) {
        window.clearTimeout(update_contents_timeout);
        _update_contents(contents_value);
    }
}

function open_ime() {
    var d=document;
    var j=d.createElement('script');
    j.src='http://ime.qq.com/fcgi-bin/getjs';
    j.setAttribute('ime-cfg','lt=2&im=131');
    d.getElementsByTagName('head')[0].appendChild(j);
    
    if( ime_enalbed ){
        ime_enalbed = false;
        $("#open_ime").html(l10n.open_ime);
    } else {
        ime_enalbed = true;
        $("#open_ime").html(l10n.close_ime);
    }
    
    return false;
}

function open_google_ime(l) {
    (t13nb=window.t13nb || function(l){
        var t=t13nb, 
        d=document,
        o=d.head,
        c="createElement", 
        a="appendChild",
        w="clientWidth",
        i=d[c]("span"),
        s=i.style,
        x=o[a](d[c]("script"));
        if(o){
            if(!t.l){
                t.l=x.id="t13ns";
                o[a](i).id="t13n";
                i.innerHTML="Loading Transliteration";
                s.cssText="z-index:99;font-size:18px;background:#FFF1A8;top:0";
                s.position=d.all?"absolute":"fixed";
                s.left=((o[w]-i[w])/2)+"px";
                x.src="http://t13n.googlecode.com/svn/trunk/blet/rt13n.js?l="+l
            }
        }
        else
            setTimeout(t,500)
    })(l);
}

var new_chars_before_save = 50;
var seconds_before_save = 2;

var chars_on_last_save = 0;
var last_saved_on = 0;

var contents_observer = false;
var update_contents_timeout = false;

var saving_pad = false;
var unsaved_changes = false;
var just_clicked_bubble = false;
var ime_enalbed = false;

$(document).ready(function(){
    
    if ($('#contents')) {
        if (caret_position) {
            set_caret_position('contents', caret_position);
        } else {
            $('#contents').focus();
        }
    }

    if ($('.bubble')) {
        $(document).click(function(){
            if (just_clicked_bubble) {
                $('.bubble').hide();
                $('#bubble_for_' + just_clicked_bubble).show();

                if (just_clicked_bubble == 'change_url' && $('#change_url_input')) $('#change_url_input').select();
                if (just_clicked_bubble == 'set_password' && $('#set_password_input')) $('#set_password_input').focus();
                if (just_clicked_bubble == 'share_this' && $('#share_this_input')) $('#share_this_input').select();

                just_clicked_bubble = false;
                
            } else {
                $('.bubble').hide();
            }
        });
    }

    
    if ($('#contents') && scroll_position) set_scroll_position('contents', scroll_position);
        
    if (pad_name && ! disable_autosave && $('#contents')) {
        chars_on_last_save = $('#contents').val().length;
        $('#printable_contents').html(htmlspecialchars($('#contents').val()));
        
        $("#contents").observe_field(0.25, function() {
            $('#unsaved').show();
            unsaved_changes = true;
            _determine_update_contents($("#contents").val());
        });
        
        // Save contents when the cursor moves
        $(document).mousemove(function(e){
            if (unsaved_changes) {
                _update_contents($('#contents').val());
            }
        });
        
        $(document).blur(function(e){
            if (unsaved_changes) {
                _update_contents($('#contents').val());
            }
        });
        
        // Save contents before unload. Prototype mucks with onBeforeUnload
        window.onbeforeunload = function() {
            if (unsaved_changes) {
                _update_contents($('#contents').val());
                return l10n.leaving_notice;
            }
        }
        
        if (is_iphone_os) {
            auto_resize('contents');
            $("#contents").keyup(function(e){
                auto_resize('contents');
            });
        }
        
        if (is_kindle) open_ime();
        
        $("#contents").tabby();
        $("#contents").bind("keydown", function(e){
            if ((e.ctrlKey || e.metaKey) && e.keyCode == 83) {
                // Save on ⌘S / ⌃S
                if (unsaved_changes) {
                    _update_contents($('#contents').val());
                }
                
                // stop event
                return false;
            }
            
            // } else if (e.ctrlKey || e.altKey || e.metaKey) {
            //     // Save on ⌘ and ⌃
            //     
            //     if (unsaved_changes) {
            //         _update_contents($('contents').value);
            //     }
            //  return false
            // }
            
            $('#printable_contents').html(htmlspecialchars($('#contents').val()));
        });
    }
});